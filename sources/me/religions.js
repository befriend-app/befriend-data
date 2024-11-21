const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add religions');

        let conn = await dbService.conn();

        let items = [
            {
                token: 'buddhist',
                name: 'Buddhist',
                sort_position: 30,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'christian',
                name: 'Christian',
                sort_position: 40,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'catholic',
                name: 'Catholic',
                sort_position: 45,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'hindu',
                name: 'Hindu',
                sort_position: 50,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'jain',
                name: 'Jain',
                sort_position: 70,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'jewish',
                name: 'Jewish',
                sort_position: 80,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'muslim',
                name: 'Muslim',
                sort_position: 90,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'sikh',
                name: 'Sikh',
                sort_position: 110,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'taoist',
                name: 'Taoist',
                sort_position: 120,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'other',
                name: 'Other',
                sort_position: 125,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'spiritual',
                name: 'Spiritual',
                sort_position: 130,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'agnostic',
                name: 'Agnostic',
                sort_position: 140,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'atheist',
                name: 'Atheist',
                sort_position: 150,
                is_visible: true,
                updated: timeNow()
            },
            {
                token: 'not_religious',
                name: 'Not Religious',
                sort_position:170,
                is_visible: true,
                updated: timeNow()
            },
        ];

        for (let item of items) {
            let check = await conn('religions')
                .where('token', item.token)
                .first();

            if (!check) {
                item.created = timeNow();
                await conn('religions').insert(item);
            }
        }

        console.log('Religions added');

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
