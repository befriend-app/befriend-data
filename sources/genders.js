const dbService = require('../services/db');
const { timeNow, loadScriptEnv } = require('../services/shared');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add genders');

        let conn = await dbService.conn();

        let genders = [
            {
                gender_token: 'female',
                gender_name: 'Female',
                sort_position: 1,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
            {
                gender_token: 'male',
                gender_name: 'Male',
                sort_position: 2,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
            {
                gender_token: 'non-binary',
                gender_name: 'Non-binary',
                sort_position: 3,
                is_visible: true,
                created: timeNow(),
                updated: timeNow(),
            },
        ];

        for (let gender of genders) {
            let gender_check = await conn('genders')
                .where('gender_token', gender.gender_token)
                .first();

            if (!gender_check) {
                await conn('genders').insert(gender);
            } else {
                delete gender.created;

                await conn('genders')
                    .where('id', gender_check.id)
                    .update(gender)
            }
        }

        console.log('Genders added');

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
