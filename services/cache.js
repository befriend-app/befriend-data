const redis = require('redis');

module.exports = {
    conn: null,
    keys: {
        activity_types: `data:activity_types`,
        venues_categories: `data:venues_categories`,
        activity_venue_categories: `data:activity_venue_categories`,
        countries: `data:countries`,
        states: `data:states`,
        sections: `data:sections`,
        instruments: `data:instruments`,
        music_genres: `data:music:genres`,
        updated: {
            activities: {
                types: `data:updated:activities:types`,
                venues_categories: `data:updated:activities:venues_categories`,
                activity_venues_categories: `data:updated:activities:activity_venues_categories`,
            },
            locations: {
                countries: `data:updated:locations:countries`,
                states: `data:updated:locations:states`,
                cities: `data:updated:cities:cities`,
            },
            instruments: `data:updated:instruments`,
            music: {
                genres: `data:updated:music:genres`,
                artists: `data:updated:music:artists`,
                artists_genres: `data:updated:music:artists:genres`,
            },
            sections: `data:updated:sections`,
            schools: `data:updated:schools`,
        },
        session: function (session) {
            return `session:data:${session}`;
        },
        cities_offset: function (offset) {
            return `data:cities:offset:${offset}`;
        },
        schools_offset: function (offset) {
            return `data:schools:offset:${offset}`;
        },
        music_artists_offset: function (offset) {
            return `data:music:artists:${offset}`
        },
        music_artists_genres_offset: function(offset) {
            return `data:music:artists:genres:${offset}`;
        },
    },
    init: function () {
        return new Promise(async (resolve, reject) => {
            let redis_ip = process.env.REDIS_HOST;

            module.exports.conn = redis.createClient({
                socket: {
                    host: `${redis_ip}`,
                },
            });

            //connect to redis server
            try {
                await module.exports.conn.connect();
            } catch (e) {
                return reject(e);
            }

            module.exports.conn.on('error', function (er) {
                console.error(er.stack);
            });

            return resolve();
        });
    },
    getKeys: function (pattern) {
        return new Promise(async (resolve, reject) => {
            try {
                let keys = await module.exports.conn.keys(pattern);
                resolve(keys);
            } catch (e) {
                console.error(e);
                reject();
            }
        });
    },
    get: function (key, json) {
        return new Promise(async (resolve, reject) => {
            //init conn in case first time
            if (!module.exports.conn) {
                try {
                    await module.exports.init();
                } catch (e) {
                    return reject(e);
                }
            }

            try {
                let data = await module.exports.conn.get(key);

                if (!json) {
                    return resolve(data);
                }

                try {
                    return resolve(JSON.parse(data));
                } catch (e) {
                    return resolve(null);
                }
            } catch (e) {
                return reject(e);
            }
        });
    },
    getObj: function (key) {
        return new Promise(async (resolve, reject) => {
            //init conn in case first time
            if (!module.exports.conn) {
                try {
                    await module.exports.init();
                } catch (e) {
                    return reject(e);
                }
            }

            try {
                let data = await module.exports.conn.get(key);

                try {
                    return resolve(JSON.parse(data));
                } catch (e) {
                    return resolve(null);
                }
            } catch (e) {
                return reject(e);
            }
        });
    },
    hGetAll: function (key) {
        return new Promise(async (resolve, reject) => {
            //init conn in case first time
            if (!module.exports.conn) {
                try {
                    await module.exports.init();
                } catch (e) {
                    return reject(e);
                }
            }

            try {
                let data = await module.exports.conn.hGetAll(key);

                try {
                    return resolve(data);
                } catch (e) {
                    return resolve(null);
                }
            } catch (e) {
                return reject(e);
            }
        });
    },
    setCache: function (key, data, cache_lifetime = null) {
        return new Promise(async (resolve, reject) => {
            //in case conn not initiated
            if (!module.exports.conn) {
                try {
                    await module.exports.init();
                } catch (e) {
                    return reject(e);
                }
            }

            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }

            try {
                if (cache_lifetime) {
                    await module.exports.conn.set(key, data, {
                        EX: cache_lifetime,
                    });
                } else {
                    await module.exports.conn.set(key, data);
                }
            } catch (e) {
                console.error(e);
            }

            return resolve();
        });
    },
    setHash: function (key, data) {
        return new Promise(async (resolve, reject) => {
            return new Promise(async (resolve, reject) => {
                try {
                    await module.exports.conn.hSet(key, data);
                } catch (e) {
                    console.error(e);
                }

                return resolve();
            });
        });
    },
    formatKeyName: function (key, params = []) {
        let new_key = key;

        if (params) {
            for (let param of params) {
                if (param) {
                    param = JSON.stringify(param);
                    new_key += `-${param}`;
                }
            }
        }

        return new_key.replace(/ /g, '-');
    },
    deleteKeys: function (keys, batchSize = 1000000) {
        return new Promise(async (resolve, reject) => {
            if (!module.exports.conn) {
                try {
                    await module.exports.init();
                } catch (e) {
                    return reject(e);
                }
            }

            if (!keys) {
                return resolve();
            }

            if (!Array.isArray(keys)) {
                keys = [keys];
            }

            try {
                for (let i = 0; i < keys.length; i += batchSize) {
                    const batch = keys.slice(i, i + batchSize);
                    await module.exports.conn.del(batch);
                }
                return resolve();
            } catch (e) {
                console.error(e);
                return reject(e);
            }
        });
    },
    execMulti: function (multi) {
        return new Promise(async (resolve, reject) => {
            try {
                let data = await multi.exec();

                return resolve(data);
            } catch (e) {
                return reject(e);
            }
        });
    },
    addItemToSet(key, item) {
        return new Promise(async (resolve, reject) => {
            try {
                if (typeof item === 'object') {
                    item = JSON.stringify(item);
                } else if (typeof item !== 'string') {
                    item = item.toString();
                }

                await module.exports.conn.sAdd(key, item);
                return resolve();
            } catch (e) {
                return reject(e);
            }
        });
    },
    addItemsToSet(key, items) {
        return new Promise(async (resolve, reject) => {
            if (!items.length) {
                return resolve();
            }

            function addToSet(key_items) {
                for (let i = 0; i < key_items.length; i++) {
                    let item = key_items[i];

                    if (typeof item !== 'string') {
                        key_items[i] = JSON.stringify(item);
                    }
                }

                return new Promise(async (resolve1, reject1) => {
                    try {
                        let data = await module.exports.conn.sAdd(key, key_items);
                        return resolve1(data);
                    } catch (err) {
                        reject1(err);
                    }
                });
            }

            let max_length = 1000000;

            let chunks = require('lodash').chunk(items, max_length);

            for (let chunk of chunks) {
                // chunk.unshift(key);

                try {
                    await addToSet(chunk);
                } catch (e) {
                    return reject(e);
                }
            }

            resolve();
        });
    },
    getSetMembers: function (key) {
        return new Promise(async (resolve, reject) => {
            try {
                let data = await module.exports.conn.sMembers(key);
                return resolve(data);
            } catch (err) {
                reject(err);
            }
        });
    },
    getSetCount: function (key) {
        return new Promise(async (resolve, reject) => {
            try {
                let data = await module.exports.conn.sCard(key);
                resolve(data);
            } catch (e) {
                return reject(e);
            }
        });
    },
    isSetMember: function (key, member) {
        return new Promise(async (resolve, reject) => {
            if (!key || !member) {
                return resolve(false);
            }

            try {
                let data = await module.exports.conn.sIsMember(key, member);
                resolve(data);
            } catch (e) {
                reject(e);
            }
        });
    },
    removeMemberFromSet: function (key, member) {
        return new Promise(async (resolve, reject) => {
            try {
                await module.exports.conn.sRem(key, member);
                return resolve();
            } catch (e) {
                console.error(e);
                return reject(e);
            }
        });
    },
    getRedisLL: function (key) {
        return new Promise(async (resolve, reject) => {
            try {
                let data = await module.exports.conn.lLen(key);

                resolve(data);
            } catch (e) {
                return reject(e);
            }
        });
    },
    addItemToList: function (key, item) {
        return new Promise(async (resolve, reject) => {
            if (typeof item === 'object') {
                item = JSON.stringify(item);
            }

            try {
                await module.exports.conn.lPush(key, item);
                resolve();
            } catch (e) {
                return reject(e);
            }
        });
    },
    rPopLPush: function (key_from, key_to) {
        return new Promise(async (resolve, reject) => {
            try {
                let data = await module.exports.conn.rPopLPush(key_from, key_to);

                resolve(data);
            } catch (e) {
                return reject(e);
            }
        });
    },
    removeListItem: function (key, item) {
        return new Promise(async (resolve, reject) => {
            try {
                if (typeof item === 'object') {
                    item = JSON.stringify(item);
                }

                await module.exports.conn.lRem(key, 0, item);

                resolve();
            } catch (e) {
                return reject(e);
            }
        });
    },
    getSortedSet: function (key, start, end) {
        return new Promise(async (resolve, reject) => {
            if (!key) {
                return reject('No key');
            }

            let results;

            try {
                if (typeof start === 'undefined' || typeof end === 'undefined') {
                    start = 0;
                    end = -1;
                }

                results = await module.exports.conn.zRange(key, start, end);

                return resolve(results);
            } catch (e) {
                console.error(e);
                return reject();
            }
        });
    },
    getSortedSetByScore: function (key, limit, lowest_to_highest) {
        return new Promise(async (resolve, reject) => {
            if (!key) {
                return reject('No key');
            }

            try {
                const multi = module.exports.conn.multi();

                if (limit) {
                    multi.addCommand([
                        'ZRANGE',
                        key,
                        lowest_to_highest ? '-inf' : '+inf',
                        lowest_to_highest ? '+inf' : '-inf',
                        'BYSCORE',
                        !lowest_to_highest ? 'REV' : '',
                        'LIMIT',
                        '0',
                        limit.toString(),
                    ]);
                } else {
                    multi.addCommand([
                        'ZRANGE',
                        key,
                        lowest_to_highest ? '-inf' : '+inf',
                        lowest_to_highest ? '+inf' : '-inf',
                        'BYSCORE',
                        !lowest_to_highest ? 'REV' : '',
                    ]);
                }

                const results = await multi.exec();

                return resolve(results[0]);
            } catch (e) {
                console.error(e);
                return reject();
            }
        });
    },
};
