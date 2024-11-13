const cacheService = require('../services/cache');
const db = require('../services/db');
const { loadScriptEnv, isProdApp } = require('../services/shared');
const {keys: systemKeys} = require('../services/system');

loadScriptEnv();

function main(is_me) {
    return new Promise(async (resolve, reject) => {
        console.log('Delete: music');

        if (isProdApp()) {
            console.error('App env: [prod]', 'exiting');
            return resolve();
        }

        await cacheService.init();

        let dbs = [process.env.DB_NAME];

        for (let db of dbs) {
            let connection = {
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: db,
            };

            if (process.env.DB_PORT) {
                connection.port = parseInt(process.env.DB_PORT);
            }

            let knex = require('knex')({
                client: process.env.DB_CLIENT,
                connection: connection,
            });

            //delete process key
            let db_system_keys = [systemKeys.music.genres, systemKeys.music.artists.country, systemKeys.music.artists.country_genre];

            for(let key of db_system_keys) {
                try {
                     await knex('system')
                         .where('system_key', key)
                         .delete();
                } catch(e) {
                    console.error(e);
                }
            }

            let tables = [
                'music_artists_genres_countries', 'music_artists_genres', 'music_artists',
                'music_genres_countries', 'music_genres'];

            for (let table of tables) {
                try {
                    await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
                    await knex(table).delete();
                } finally {
                    await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
                }
            }

            await cacheService.deleteKeys(cacheService.keys.music_genres);
        }

        if (is_me) {
            process.exit();
        }

        resolve();
    });
}

module.exports = {
    main: main,
};

if (require.main === module) {
    (async function () {
        try {
            await main(true);
            process.exit();
        } catch (e) {
            console.error(e);
        }
    })();
}
