const aiService = require('../../../services/ai');
const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
loadScriptEnv();

function addTeams() {
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
                .join('sports AS s', 's.id', '=', 'sl.sport_id')
                .join('sports_leagues_countries as slc', 'sl.id', 'slc.league_id')
                .join('open_countries as oc', 'slc.country_id', 'oc.id')
                .where('s.has_teams', true)
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
                    Exclude:
                    - Tournament names
                    - Equipment manufacturers
                    - Individual athletes
                    - Recreational teams
                    - Historical teams
                    Only return teams if this is a team-based league/sport.
                    If this is not a team sport or the league doesn't have formal teams, return an empty array.
                    Provide ONLY valid JSON in this format:
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

function mergeTeamDuplicates() {
    return new Promise(async (resolve, reject) => {
        try {
            const conn = await dbService.conn();

            // Group teams by sport, name, city and country
            const teams = await conn('sports_teams as st')
                .select(
                    'st.*',
                    'oc.country_code',
                    'oc.country_name'
                )
                .leftJoin('open_countries as oc', 'oc.id', 'st.country_id')
                .whereNull('st.deleted');

            const groups = teams.reduce((acc, team) => {
                const key = `${team.sport_id}_${team.name.toLowerCase()}_${team.city?.toLowerCase()}_${team.country_id}`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(team);
                return acc;
            }, {});

            // Process each group with multiple entries
            for (const [key, duplicates] of Object.entries(groups)) {
                if (duplicates.length <= 1) continue;

                // Sort by popularity and active status to find primary record
                duplicates.sort((a, b) => {
                    if (a.is_active !== b.is_active) return b.is_active - a.is_active;
                    if (a.popularity !== b.popularity) return (b.popularity || 0) - (a.popularity || 0);
                    return a.id - b.id;
                });

                const primaryTeam = duplicates[0];
                const duplicateIds = duplicates.slice(1).map(d => d.id);

                // Begin transaction
                await conn.transaction(async trx => {
                    try {
                        // Update league associations
                        await trx('sports_teams_leagues')
                            .whereIn('team_id', duplicateIds)
                            .whereNull('deleted')
                            .update({
                                team_id: primaryTeam.id,
                                updated: timeNow()
                            });

                        // Soft delete duplicate teams
                        await trx('sports_teams')
                            .whereIn('id', duplicateIds)
                            .update({
                                deleted: timeNow(),
                                updated: timeNow()
                            });

                        // Update primary team's popularity if needed
                        if (!primaryTeam.popularity) {
                            const maxPopularity = Math.max(...duplicates.map(d => d.popularity || 0));
                            if (maxPopularity > 0) {
                                await trx('sports_teams')
                                    .where('id', primaryTeam.id)
                                    .update({
                                        popularity: maxPopularity,
                                        updated: timeNow()
                                    });
                            }
                        }

                        await trx.commit();

                        console.log(`Merged ${duplicateIds.length} duplicates into team ${primaryTeam.id} (${primaryTeam.name})`);
                    } catch (error) {
                        await trx.rollback();
                        throw error;
                    }
                });
            }

            return resolve({
                totalGroups: Object.keys(groups).length,
                mergedGroups: Object.values(groups).filter(g => g.length > 1).length
            });
        } catch(e) {
            console.error(e);
            return reject(e);
        }
    });
}

function deleteInvalidResults() {
    return new Promise(async (resolve, reject) => {
         try {
             let invalid_strings = [
                 'response not possible',
                 'no valid team',
                 'no known active',
                 'no reliable data',
                 'not available',
                 'no verified',
                 'no current team',
                 'no active team'
             ];
            let conn = await dbService.conn();

            let teams = await conn('sports_teams')
                .whereNull('deleted');

            for(let team of teams) {
                let isInvalid = invalid_strings.some(str => team.name.toLowerCase().includes(str));

                if(isInvalid) {
                    await conn('sports_teams')
                        .where('id', team.id)
                        .update({
                            deleted: timeNow(),
                            updated: timeNow()
                        });
                }
            }
         } catch(e) {
             console.error(e);
         }

         resolve();
    });
}

function main() {
    return new Promise(async (resolve, reject) => {
        try {
             await addTeams();

             await mergeTeamDuplicates();

             await deleteInvalidResults();
        } catch(e) {
            console.error(e);
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