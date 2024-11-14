const cacheService = require('./cache');
const dbService = require('./db');
const { isNumeric } = require('./shared');
const { setCache, getObj } = require('./cache');

module.exports = {
    keys: {
        music: {
            genres: 'music_genres_last_country',
            artists: {
                genre: 'music_artists_last_genre'
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
    },
    setLastUpdated: function(key, lastUpdated) {
        return new Promise(async (resolve, reject) => {
            //set cache of last updated timestamp of endpoint data
            if(!key) {
                return reject('key required');
            }

            if(!isNumeric(lastUpdated)) {
                return reject('last_updated is required');
            }

            try {
                 await setCache(key, lastUpdated);
            } catch(e) {
                console.error(e);
                return reject(e);
            }

            resolve();
        });
    },
    getLastUpdated: function(key, table, skip_cache) {
        return new Promise(async (resolve, reject) => {
            try {
                if(!key) {
                    return reject('key required');
                }

                if(!skip_cache) {
                    let cache_data = await getObj(key);

                    if(cache_data) {
                        return resolve(cache_data);
                    }
                }

                 if(!table) {
                     return reject('table is required');
                 }

                 let conn = await dbService.conn();

                 let qry = await conn(table)
                     .orderBy('updated', 'desc')
                     .first();

                 if(qry?.updated) {
                     await module.exports.setLastUpdated(key, qry.updated);
                     return resolve(qry.updated);
                 } else {
                     return resolve(null);
                 }
            } catch(e) {
                console.error(e);
                return reject(e);
            }
        });
    },
    startUpdatesInterval: async function() {
        async function fn() {
            let getLastUpdated = module.exports.getLastUpdated;
            let keys = cacheService.keys.updated;

            try {
                await Promise.all([
                    getLastUpdated(keys.activities.types, 'activity_types', true),
                    getLastUpdated(keys.activities.venues_categories, 'venues_categories', true),
                    getLastUpdated(keys.activities.activity_venues_categories, 'activity_type_venues', true),
                    getLastUpdated(keys.locations.countries, 'open_countries', true),
                    getLastUpdated(keys.locations.states, 'open_states', true),
                    getLastUpdated(keys.locations.cities, 'open_cities', true),
                    getLastUpdated(keys.instruments, 'instruments', true),
                    getLastUpdated(keys.music.genres, 'music_genres', true),
                    getLastUpdated(keys.music.artists, 'music_artists', true),
                    getLastUpdated(keys.music.artists_genres, 'music_artists_genres', true),
                    getLastUpdated(keys.sections, 'me_sections', true),
                    getLastUpdated(keys.schools, 'schools', true)
                ])
            } catch(e) {
                console.error(e);
            }
        }

        await fn();

        setInterval(fn, 60 * 5 * 1000);
    }
}