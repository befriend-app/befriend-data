const aiService = require('../../../services/ai');
const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add sports teams by league');

        const table_teams = 'sports_teams';
        const table_leagues_teams = 'sports_teams_leagues';

        try {
            let conn = await dbService.conn();

            // Get existing data
            let teams = await conn(table_teams)
                .whereNull('deleted')
                .select('id', 'token', 'name', 'sport_id');

            // Get leagues with their sports
            let leagues = await conn('sports_leagues as sl')
                .join('sports_leagues_countries as slc', 'sl.id', 'slc.league_id')
                .join('open_countries as oc', 'slc.country_id', 'oc.id')
                .whereNull('sl.deleted')
                .whereNull('slc.deleted')
                .select(
                    'sl.id',
                    'sl.token',
                    'sl.name as league_name',
                    'sl.sport_id',
                    'oc.id AS country_id',
                    'oc.country_name'
                )
                .orderBy('sl.id');

            // Get existing league associations
            let teams_leagues = await conn(table_leagues_teams)
                .whereNull('deleted')
                .select('id', 'team_id', 'league_id');

            // Create lookup dictionaries
            let teams_dict = {
                byToken: {},
                byLeague: {}
            };

            // Build team lookup by token
            for (let team of teams) {
                teams_dict.byToken[team.token] = team;
            }

            // Build league-specific lookups
            for (let assoc of teams_leagues) {
                let team = teams.find(t => t.id === assoc.team_id);
                if (team) {
                    if (!teams_dict.byLeague[assoc.league_id]) {
                        teams_dict.byLeague[assoc.league_id] = {
                            byName: {},
                            byTeamId: {}
                        };
                    }
                    teams_dict.byLeague[assoc.league_id].byName[team.name.toLowerCase()] = team;
                    teams_dict.byLeague[assoc.league_id].byTeamId[team.id] = assoc;
                }
            }

            // Process each league
            for(let i = 0; i < leagues.length; i++) {
                let league = leagues[i];

                console.log({
                    id: league.id,
                    league: league.league_name,
                    country: league.country_name,
                    process: `${i+1}/${leagues.length}`,
                });

                // Check if league has already been processed
                let check = await conn(table_leagues_teams + ' as lt')
                    .join('sports_teams as t', 'lt.team_id', 't.id')
                    .where('lt.league_id', league.id)
                    .where('t.country_id', league.country_id)
                    .whereNull('lt.deleted')
                    .whereNull('t.deleted');

                if(check.length) {
                    continue;
                }

                let prompt = `
                    Return all the current teams that compete in the ${league.league_name} in ${league.country_name}.
                    Only include actual existing teams, not historical or fictional ones.
                    Do not return any additional information before or after. Provide ONLY valid JSON.
                    Append the country_code and league to each team token.
                    Your response should be an array of items with the following format:
                    [{
                        name: "Full team name",
                        token: "unique_token_for_team",
                        location: "City or region where team is based"
                    }]
                `;

                try {
                    let league_teams = await aiService.claude.promptCache(prompt, {
                        league: league.league_name,
                        country: league.country_name
                    });

                    console.log(`Processing ${league_teams.length} teams for ${league.league_name}`);

                    // Process teams
                    for(let team of league_teams) {
                        // Check if team exists by token or within this league
                        let existingTeam = teams_dict.byToken[team.token] ||
                            teams_dict.byLeague[league.id]?.byName[team.name.toLowerCase()];

                        console.log(`Processing team: ${team.name} (${existingTeam ? 'exists' : 'new'})`);

                        let teamId;

                        if(!existingTeam) {
                            // Create new team
                            let teamData = {
                                token: team.token,
                                name: team.name,
                                city: team.location,
                                sport_id: league.sport_id,
                                country_id: league.country_id,
                                is_active: true,
                                created: timeNow(),
                                updated: timeNow()
                            };

                            // Insert team
                            let [id] = await conn(table_teams).insert(teamData);
                            teamData.id = id;

                            // Add to token lookup
                            teams_dict.byToken[team.token] = teamData;

                            // Initialize league lookup if needed
                            if (!teams_dict.byLeague[league.id]) {
                                teams_dict.byLeague[league.id] = {
                                    byName: {},
                                    byTeamId: {}
                                };
                            }

                            // Add to league lookup
                            teams_dict.byLeague[league.id].byName[team.name.toLowerCase()] = teamData;

                            teamId = id;
                        } else {
                            teamId = existingTeam.id;
                        }

                        // Check if league association already exists
                        if (!teams_dict.byLeague[league.id]?.byTeamId[teamId]) {
                            // Create league association
                            let leagueTeamData = {
                                league_id: league.id,
                                team_id: teamId,
                                created: timeNow(),
                                updated: timeNow()
                            };

                            let [id] = await conn(table_leagues_teams).insert(leagueTeamData);

                            // Add to lookup
                            if (!teams_dict.byLeague[league.id]) {
                                teams_dict.byLeague[league.id] = {
                                    byName: {},
                                    byTeamId: {}
                                };
                            }
                            teams_dict.byLeague[league.id].byTeamId[teamId] = {
                                ...leagueTeamData,
                                id
                            };

                            // console.log(`Created league association for: ${team.name}`);
                        } else {
                            console.log(`League association already exists for: ${team.name}`);
                        }
                    }

                } catch(e) {
                    console.error(`Error processing ${league.league_name}:`, e);
                }
            }

            console.log('Sports teams by league added');
            resolve();

        } catch(e) {
            console.error('Main error:', e);
            reject(e);
        }
    });
}

module.exports = {
    main
};

if (require.main === module) {
    (async function () {
        try {
            await main();
            process.exit();
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    })();
}