const dbService = require('./db');

module.exports = {
    keys: {
        music: {
            genres: 'music_genres_last_country',
            artists: {
                country: 'music_artists_last_country',
                country_genre: 'music_artists_last_country_genre'
            }
        }
    },
    getProcess: function(key) {
        return new Promise(async (resolve, reject) => {
            try {
                 let conn = await dbService.conn();

                 let data = await conn('system')
                     .where('system_key', key)
                     .first();

                 resolve(data?.system_value);
            } catch(e) {
                console.error(e);
                reject(e);
            }
        });
    }
}