const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
const { deleteKeys } = require('../../services/cache');
const cacheService = require('../../services/cache');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add life stages');

        await deleteKeys(cacheService.keys.life_stages);

        let conn = await dbService.conn();

        let life_stages = [
            {
                token: 'student',
                name: 'Student',
                sort_position: 1,
            },
            {
                token: 'starting_career',
                name: 'Starting Career',
                sort_position: 2,
            },
            {
                token: 'established_career',
                name: 'Established Career',
                sort_position: 3,
            },
            {
                token: 'changing_careers',
                name: 'Changing Careers',
                sort_position: 4,
            },
            {
                token: 'starting_business',
                name: 'Starting a Business',
                sort_position: 5,
            },
            {
                token: 'business_owner',
                name: 'Business Owner',
                sort_position: 6,
            },
            {
                token: 'sabbatical',
                name: 'Sabbatical',
                sort_position: 7,
            },
            {
                token: 'retired',
                name: 'Retired',
                sort_position: 8,
            }
        ];

        for (let stage of life_stages) {
            let check = await conn('life_stages')
                .where('token', stage.token)
                .first();

            if (!check) {
                stage.created = timeNow();
                stage.updated = timeNow();
                stage.is_visible = true;

                await conn('life_stages').insert(stage);
            } else {
                stage.updated = timeNow();

                await conn('life_stages')
                    .where('id', check.id)
                    .update(stage);
            }
        }

        console.log('Life stages added');
        resolve();
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
