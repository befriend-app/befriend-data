const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
const { deleteKeys, keys } = require('../../services/cache');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add kids ages');

        await deleteKeys(keys.relationship_status);

        let conn = await dbService.conn();

        let items = [
            {
                token: '0-2',
                name: '0-2 years',
                age_min: 0,
                age_max: 2,
                sort_position: 1,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: '3-5',
                name: '3-5 years',
                age_min: 3,
                age_max: 5,
                sort_position: 2,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: '6-8',
                name: '6-8 years',
                age_min: 6,
                age_max: 8,
                sort_position: 3,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: '9-12',
                name: '9-12 years',
                age_min: 9,
                age_max: 12,
                sort_position: 4,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: '13-15',
                name: '13-15 years',
                age_min: 13,
                age_max: 15,
                sort_position: 5,
                is_visible: true,
                updated: timeNow(),
            },
            {
                token: '16+',
                name: '16+',
                age_min: 16,
                age_max: 18,
                sort_position: 6,
                is_visible: true,
                updated: timeNow(),
            },
        ];

        for (let item of items) {
            let check = await conn('kids_ages').where('token', item.token).first();

            if (!check) {
                item.created = timeNow();
                await conn('kids_ages').insert(item);
            } else {
                await conn('kids_ages').where('id', check.id).update(item);
            }
        }

        console.log('Kids ages added');

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
