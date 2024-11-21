const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add drinking');

        let conn = await dbService.conn();

        let drinkings = [
            {
                token: 'never',
                name: 'Never',
                sort_position: 1,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
            {
                token: 'rarely',
                name: 'Rarely',
                sort_position: 2,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
            {
                token: 'socially',
                name: 'Socially',
                sort_position: 3,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
            {
                token: 'regularly',
                name: 'Regularly',
                sort_position: 4,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
        ];

        for (let drink of drinkings) {
            let check = await conn('drinking').where('token', drink.token).first();

            if (!check) {
                await conn('drinking').insert(drink);
            }
        }

        console.log('Drinking added');

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
