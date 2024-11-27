const aiService = require('../../../services/ai');
const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add sports leagues by country');

        const table_leagues = 'sports_leagues';
        const table_countries = 'sports_leagues_countries';

        try {
            let conn = await dbService.conn();

            // Get existing data
            let leagues = await conn(table_leagues)
                .whereNull('deleted')
                .select('id', 'token', 'name', 'sport_id');

            let leagues_countries = await conn(table_countries)
                .whereNull('deleted')
                .select('id', 'league_id', 'country_id', 'position');

            // Create lookup dictionaries
            let leagues_dict = {
                byToken: {},
                byName: {}
            };

            let countries_dict = {};

            for (let league of leagues) {
                leagues_dict.byToken[league.token] = league;
                leagues_dict.byName[league.name.toLowerCase()] = league;
            }

            for (let assoc of leagues_countries) {
                if (!countries_dict[assoc.country_id]) {
                    countries_dict[assoc.country_id] = {
                        byLeagueId: {}
                    };
                }
                countries_dict[assoc.country_id].byLeagueId[assoc.league_id] = assoc;
            }

            // Get list of countries
            let countries = await conn('open_countries')
                .orderBy('country_name');

            // Get sports for context
            let sports = await conn('sports')
                .whereNull('deleted')
                .select('id', 'token', 'name');

            // Process each country
            for(let i = 0; i < countries.length; i++) {
                let country = countries[i];
                console.log({
                    country: country.country_name,
                    process: `${i+1}/${countries.length}`,
                });

                // Check if country has already been processed
                let check = await conn(table_countries)
                    .where('country_id', country.id)
                    .whereNull('deleted');

                if(check.length) {
                    continue;
                }

                let prompt = `
                    Given this list of sports: ${JSON.stringify(sports)},
                    return the top 10 most popular sports leagues in ${country.country_name}.
                    Only include actual existing leagues, not fictional ones.
                    Do not return any additional information before or after. Provide ONLY valid JSON.
                    Your response should be an array of items with the following format:
                    [{
                        name: "Full league name",
                        token: "unique_token_for_league",
                        sport_token: "corresponding_sport_token_from_list",
                        position: "Position number 1-10 indicating popularity rank"
                    }]
                `;

                try {
                    let top_leagues = await aiService.claude.promptCache(prompt, {
                        country: country.country_name
                    });

                    // Process leagues
                    for(let i = 0; i < top_leagues.length; i++) {
                        let league = top_leagues[i];

                        // Find corresponding sport
                        let sport = sports.find(s => s.token === league.sport_token);
                        if(!sport) continue;

                        // Check if league exists or needs to be created
                        let existingLeague = leagues_dict.byToken[league.token] ||
                            leagues_dict.byName[league.name.toLowerCase()];

                        let leagueId;

                        if(!existingLeague) {
                            // Create new league
                            let leagueData = {
                                token: league.token,
                                name: league.name,
                                sport_id: sport.id,
                                created: timeNow(),
                                updated: timeNow()
                            };

                            // Insert league
                            let [id] = await conn(table_leagues).insert(leagueData);
                            leagueData.id = id;

                            // Add to lookup dict
                            leagues_dict.byToken[league.token] = leagueData;
                            leagues_dict.byName[league.name.toLowerCase()] = leagueData;

                            leagueId = id;
                        } else {
                            leagueId = existingLeague.id;
                        }

                        if(countries_dict[country.id]?.byLeagueId[leagueId]) {
                            continue;
                        }

                        // Create country association
                        let countryAssocData = {
                            country_id: country.id,
                            league_id: leagueId,
                            position: league.position || (i + 1),
                            created: timeNow(),
                            updated: timeNow()
                        };

                        await conn(table_countries).insert(countryAssocData);
                    }

                } catch(e) {
                    console.error(`Error processing ${country.country_name}:`, e);
                }
            }

            console.log('Sports leagues by country added');
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