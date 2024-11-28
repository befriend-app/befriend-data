const aiService = require('../../../services/ai');
const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
const BATCH_SIZE = 60;

loadScriptEnv();

async function getExistingData() {
    const conn = await dbService.conn();

    const [leagues, leaguesCountries, countries, sports] = await Promise.all([
        conn('sports_leagues').whereNull('deleted').select('id', 'token', 'name', 'sport_id'),
        conn('sports_leagues_countries').whereNull('deleted').select('id', 'league_id', 'country_id', 'position'),
        conn('open_countries').orderBy('country_name'),
        conn('sports')
            .where('has_teams', true)
            .whereNull('deleted')
            .select('id', 'token', 'name')
    ]);

    // Create lookup dictionaries
    const leagues_dict = {
        byToken: {},
        byName: {},
        byId: {}
    };

    const countries_dict = {};

    for (let league of leagues) {
        leagues_dict.byToken[league.token] = league;
        leagues_dict.byName[league.name.toLowerCase()] = league;
        leagues_dict.byId[league.id] = league;
    }

    for (let assoc of leaguesCountries) {
        if (!countries_dict[assoc.country_id]) {
            countries_dict[assoc.country_id] = {
                byLeagueId: {}
            };
        }
        countries_dict[assoc.country_id].byLeagueId[assoc.league_id] = assoc;
    }

    return {
        leagues,
        leaguesCountries,
        countries,
        sports,
        leagues_dict,
        countries_dict
    };
}

async function getTopLeaguesForCountry(country, sports) {
    const prompt = `
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
        return await aiService.claude.promptCache(prompt, {
            country: country.country_name
        });
    } catch (e) {
        console.error(`Error getting top leagues for ${country.country_name}:`, e);
        return [];
    }
}

async function updateLeagueShortNames() {
    const conn = await dbService.conn();

    // Get leagues that haven't been processed
    const unprocessedLeagues = await conn('sports_leagues')
        .whereNull('deleted')
        .where('processed_short_name', false)
        .select('id', 'token', 'name', 'short_name');

    if (!unprocessedLeagues.length) {
        console.log('No unprocessed leagues found');
        return 0;
    }

    const batches = [];
    for (let i = 0; i < unprocessedLeagues.length; i += BATCH_SIZE) {
        batches.push(unprocessedLeagues.slice(i, i + BATCH_SIZE));
    }

    let updated = 0;

    for (let i = 0; i < batches.length; i++) {
        let batch = batches[i];

        console.log({
            process_batch: `${i+1}/${batches.length}`
        });

        const prompt = `
            For each sports league in this list, provide a short name or abbreviation.
            The short name should be commonly used and recognized.
            Only return valid JSON in the format: [{token: "league_token", short_name: "abbreviation"}]
            Leagues: ${JSON.stringify(batch.map(l => ({ token: l.token, name: l.name })))}
        `;

        try {
            const shortNames = await aiService.claude.prompt(prompt);

            // Process updates
            const updates = [];
            for (const item of shortNames) {
                if (item.token && item.short_name) {
                    updates.push({
                        token: item.token,
                        short_name: item.short_name,
                        updated: timeNow()
                    });
                }
            }

            // Batch update the database
            if (updates.length) {
                for (const update of updates) {
                    await conn('sports_leagues')
                        .where('token', update.token)
                        .update({
                            short_name: update.short_name,
                            processed_short_name: true,
                            updated: update.updated,
                        });
                    updated++;
                }
            }

            console.log(`Processed ${updates.length} short names`);

            // Add delay between batches
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (e) {
            console.error('Error updating short names for batch:', e);
        }
    }

    return updated;
}

async function processCountryLeagues(country, sports, leagues_dict, countries_dict) {
    const conn = await dbService.conn();
    const table_leagues = 'sports_leagues';
    const table_countries = 'sports_leagues_countries';

    // Check if country has already been processed
    const existing = await conn(table_countries)
        .where('country_id', country.id)
        .whereNull('deleted');

    if (existing.length) {
        return null;
    }

    const top_leagues = await getTopLeaguesForCountry(country, sports);

    // Process leagues
    for (let i = 0; i < top_leagues.length; i++) {
        const league = top_leagues[i];

        // Find corresponding sport
        const sport = sports.find(s => s.token === league.sport_token);
        if (!sport) continue;

        // Check if league exists or needs to be created
        let existingLeague = leagues_dict.byToken[league.token] ||
            leagues_dict.byName[league.name.toLowerCase()];

        let leagueId;

        if (!existingLeague) {
            // Create new league
            const leagueData = {
                token: league.token,
                name: league.name,
                sport_id: sport.id,
                created: timeNow(),
                updated: timeNow()
            };

            // Insert league
            const [id] = await conn(table_leagues).insert(leagueData);
            leagueData.id = id;

            // Add to lookup dict
            leagues_dict.byToken[league.token] = leagueData;
            leagues_dict.byName[league.name.toLowerCase()] = leagueData;

            leagueId = id;
        } else {
            leagueId = existingLeague.id;
        }

        if (countries_dict[country.id]?.byLeagueId[leagueId]) {
            continue;
        }

        // Create country association
        const countryAssocData = {
            country_id: country.id,
            league_id: leagueId,
            position: league.position || (i + 1),
            created: timeNow(),
            updated: timeNow()
        };

        await conn(table_countries).insert(countryAssocData);
    }

    return top_leagues.length;
}

async function main() {
    try {
        console.log('Add and update sports leagues by country');

        // Get all existing data
        const {
            leagues,
            countries,
            sports,
            leagues_dict,
            countries_dict
        } = await getExistingData();

        // Process countries
        for (let i = 0; i < countries.length; i++) {
            const country = countries[i];

            console.log({
                country: country.country_name,
                process: `${i + 1}/${countries.length}`,
            });

            const leaguesAdded = await processCountryLeagues(
                country,
                sports,
                leagues_dict,
                countries_dict
            );

            if (leaguesAdded) {
                console.log(`Added ${leaguesAdded} leagues for ${country.country_name}`);
            }
        }

        // Update short names for all leagues
        console.log('Updating league short names...');
        const updatedCount = await updateLeagueShortNames();
        console.log(`Updated ${updatedCount} league short names`);

        console.log('Sports leagues processing completed');
    } catch (e) {
        console.error('Main error:', e);
        throw e;
    }
}

module.exports = {
    main,
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