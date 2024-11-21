const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add politics');

        let conn = await dbService.conn();

        let items = [
            {
                token: 'liberal',
                name: 'Liberal',
                sort_position: 1,
                is_visible: true,
            },
            {
                token: 'moderate',
                name: 'Moderate',
                sort_position: 2,
                is_visible: true,
            },
            {
                token: 'conservative',
                name: 'Conservative',
                sort_position: 3,
                is_visible: true,
            },
            {
                token: 'not_political',
                name: 'Not Political',
                sort_position: 4,
                is_visible: true,
            }
        ];

        for (let item of items) {
            let check = await conn('politics')
                .where('token', item.token)
                .first();

            if (!check) {
                item.created = timeNow();
                item.updated = timeNow();
                await conn('politics').insert(item);
            }
        }

        console.log('politics added');

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
