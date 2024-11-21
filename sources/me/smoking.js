const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add smoking');

        let conn = await dbService.conn();

        const items = [
            {
                token: 'non_smoker',
                name: 'Non-smoker',
                sort_position: 1,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'trying_to_quit',
                name: 'Trying to quit',
                sort_position: 2,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'social_smoker',
                name: 'Social smoker',
                sort_position: 3,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'regular_smoker',
                name: 'Regular smoker',
                sort_position: 4,
                is_visible: true,
                updated: timeNow(),
            },
        ];

        for (let item of items) {
            let check = await conn('smoking').where('token', item.token).first();

            if (!check) {
                item.created = timeNow();
                await conn('smoking').insert(item);
            }
        }

        console.log('Smoking added');

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
