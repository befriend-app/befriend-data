const aiService = require('../../../services/ai');
const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
const { batchInsert } = require('../../../services/db');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add sports by country');

        let table_1 = 'sports';
        let table_2 = 'sports_countries';

        try {
            let conn = await dbService.conn();

            let sports = await conn(table_1)
                .whereNull('deleted')
                .select('id', 'token', 'name');

            let sports_countries = await conn(table_2);

            let sports_dict = sports.reduce((acc, s) => {
                acc[s.token] = s;
                return acc;
            }, {});

            let sports_countries_dict = sports_countries.reduce((acc, sport) => {
                if(!(sport.country_id in acc)) {
                    acc[sport.country_id] = {};
                }

                acc[sport.country_id][sport.sport_id] = sport;

                return acc;
            }, {});

            let countries = await conn('open_countries')
                .orderBy('country_name');

            for(let i = 0; i < countries.length; i++) {
                let country = countries[i];
                console.log({
                    country: country.country_name,
                    process: `${i+1}/${countries.length}`,
                });

                //check if already processed
                let check = await conn(table_2)
                    .where('country_id', country.id);

                if(check.length) {
                    continue;
                }

                let prompt = `
                        Given this list of sports: ${JSON.stringify(sports)},
                        return the 10 most popular sports for given country.
                        Do not return any additional information before or after. Provide ONLY valid JSON.
                        Your response should include the sport name and token.
                        The response should be an array of items with the following format:
                        [{name, token}]
                        `;

                try {
                    let top_sports = await aiService.claude.promptCache(prompt, {
                        country: country.country_name
                    });

                    //organize
                    let batch_insert = [];

                    for(let i = 0; i < top_sports.length; i++) {
                        let s = top_sports[i];

                        if(!(s.token in sports_dict)) {
                            continue;
                        }

                        batch_insert.push({
                            country_id: country.id,
                            sport_id: sports_dict[s.token].id,
                            position: i + 1,
                            created: timeNow(),
                            updated: timeNow()
                        });
                    }

                    await batchInsert(table_2, batch_insert);
                } catch(e) {
                    console.error(e);
                }
            }

            console.log('Sports by country added');

            resolve();
        } catch(e) {
            console.error(e);
            return reject(e);
        }
    });
}

module.exports = {
    main: main,
};

//script executed directly
if (require.main === module) {
    (async function () {
        try {
            await main();
            process.exit();
        } catch (e) {
            console.error(e);
        }
    })();
}