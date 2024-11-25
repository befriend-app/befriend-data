const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
const { deleteKeys, keys } = require('../../services/cache');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add relationship status');

        await deleteKeys(keys.relationship_status);

        let conn = await dbService.conn();

        let items = [
            {
                token: 'single',
                name: 'Single',
                sort_position: 10,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'dating',
                name: 'Dating',
                sort_position: 20,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'in_relationship',
                name: 'In a Relationship',
                sort_position: 30,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'engaged',
                name: 'Engaged',
                sort_position: 40,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'married',
                name: 'Married',
                sort_position: 50,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'divorced',
                name: 'Divorced',
                sort_position: 60,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'separated',
                name: 'Separated',
                sort_position: 70,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: 'widowed',
                name: 'Widowed',
                sort_position: 80,
                is_visible: true,
                updated: timeNow(),
            }
        ];

        for (let item of items) {
            let check = await conn('relationship_status').where('token', item.token).first();

            if (!check) {
                item.created = timeNow();
                await conn('relationship_status').insert(item);
            } else {
                await conn('relationship_status')
                    .where('id', check.id)
                    .update(item);
            }
        }

        console.log('Relationship status added');

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
