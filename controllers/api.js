const cacheService = require('../services/cache');
const dbService = require('../services/db');
const { timeNow } = require('../services/shared');

module.exports = {
    batchLimit: 50000, //changing this value affects cache
    cache: {
        countries: null,
        states: null,
    },
    getActivityTypes: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('activity_types');

                let id_token_dict = {};

                // lookup dict
                for (let item of items) {
                    id_token_dict[item.id] = item.activity_type_token;
                }

                //remove fields, set parent token
                for (let item of items) {
                    let parent_token = null;

                    if (item.parent_activity_type_id) {
                        parent_token = id_token_dict[item.parent_activity_type_id];
                    }

                    delete item.created;
                    delete item.id;
                    delete item.parent_activity_type_id;

                    item.parent_token = parent_token;
                }

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch (e) {
                console.error(e);
                res.json('Error retrieving data', 400);
            }

            resolve();
        });
    },
    getVenuesCategories: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('venues_categories');

                let id_token_dict = {};

                // lookup dict
                for (let item of items) {
                    id_token_dict[item.id] = item.category_token;
                }

                //remove fields, set parent token
                for (let item of items) {
                    let parent_token = null;

                    if (item.parent_id) {
                        parent_token = id_token_dict[item.parent_id];
                    }

                    delete item.created;
                    delete item.id;
                    delete item.parent_id;

                    item.parent_token = parent_token;
                }

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch (e) {
                console.error(e);
                res.json('Error retrieving data', 400);
            }

            resolve();
        });
    },
    getActivityVenueCategories: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('activity_type_venues AS atv')
                    .join('activity_types AS at', 'at.id', '=', 'atv.activity_type_id')
                    .join('venues_categories AS vc', 'vc.id', '=', 'atv.venue_category_id')
                    .select(
                        'activity_type_token',
                        'category_token',
                        'atv.sort_position',
                        'atv.is_active',
                        'atv.updated',
                    );

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch (e) {
                console.error(e);
                res.json('Error retrieving data', 400);
            }

            resolve();
        });
    },
    getCountries: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('open_countries')
                    .orderBy('country_name', 'asc')
                    .select(
                        'country_name',
                        'country_code',
                        'emoji',
                        'lat',
                        'lon',
                        'min_lat',
                        'max_lat',
                        'min_lon',
                        'max_lon',
                        'wiki_code',
                        'updated',
                    );

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch (e) {
                console.error(e);
                res.json('Error retrieving data', 400);
            }

            resolve();
        });
    },
    getStates: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();
                let items = await conn('open_states AS os')
                    .join('open_countries AS oc', 'oc.id', '=', 'os.country_id')
                    .orderBy('country_code', 'asc')
                    .select(
                        'country_code',
                        'state_name',
                        'state_short',
                        'os.population',
                        'os.lat',
                        'os.lon',
                        'os.updated',
                    );

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch (e) {
                console.error(e);
                res.json('Error retrieving data', 400);
            }

            resolve();
        });
    },
    getCities: function (req, res) {
        function allCountries() {
            return new Promise(async (resolve, reject) => {
                if (module.exports.cache.countries) {
                    return resolve(module.exports.cache.countries);
                }

                try {
                    let conn = await dbService.conn();

                    // Countries lookup
                    let countries = await conn('open_countries');
                    let countries_dict = {};

                    for (let country of countries) {
                        countries_dict[country.id] = country;
                    }

                    module.exports.cache.countries = countries_dict;

                    return resolve(countries_dict);
                } catch (e) {
                    console.error(e);
                    return reject();
                }
            });
        }

        function allStates() {
            return new Promise(async (resolve, reject) => {
                if (module.exports.cache.states) {
                    return resolve(module.exports.cache.states);
                }

                try {
                    let conn = await dbService.conn();

                    // States lookup
                    let states = await conn('open_states');
                    let states_dict = {};

                    for (let state of states) {
                        states_dict[state.id] = state;
                    }

                    module.exports.cache.states = states_dict;

                    return resolve(states_dict);
                } catch (e) {
                    console.error(e);
                    return reject();
                }
            });
        }

        return new Promise(async (resolve, reject) => {
            try {
                const limit = module.exports.batchLimit;
                let offset = Math.floor((parseInt(req.query.offset) || 0) / limit) * limit;

                const cache_key = cacheService.keys.cities_offset(offset);

                if (!req.query.updated) {
                    let cache_data = await cacheService.getObj(cache_key);

                    if (cache_data) {
                        res.json(
                            {
                                timestamp: timeNow(),
                                next_offset: cache_data.length ? offset + limit : null,
                                has_more: !!cache_data.length,
                                items: cache_data,
                            },
                            200,
                        );

                        return resolve();
                    }
                }

                let countries = await allCountries();
                let states = await allStates();

                let conn = await dbService.conn();

                let query = conn('open_cities')
                    .orderBy('id')
                    .select(
                        'country_id',
                        'state_id',
                        'city_name',
                        'postcode',
                        'population',
                        'lat',
                        'lon',
                        'is_city',
                        'is_town',
                        'is_village',
                        'is_hamlet',
                        'is_administrative',
                        'bbox_lat_min',
                        'bbox_lat_max',
                        'bbox_lon_min',
                        'bbox_lon_max',
                        'bbox_lat_min_1000',
                        'bbox_lat_max_1000',
                        'bbox_lon_min_1000',
                        'bbox_lon_max_1000',
                    )
                    .limit(limit + 1)
                    .offset(offset);

                // On subsequent requests
                if (req.query.updated) {
                    query = query.where('updated', '>', req.query.updated);
                }

                let items = await query;

                //replace country/state id with code/name
                for (let item of items) {
                    item.country_code = countries[item.country_id].country_code;

                    item.state_name = states[item.state_id]?.state_name || null;

                    delete item.country_id;
                    delete item.state_id;
                }

                // Check if there are more records
                const hasMore = items.length > limit;

                if (hasMore) {
                    items = items.slice(0, limit); // Remove the extra item
                }

                //only update cache if no updated timestamp
                if (!req.query.updated && items.length) {
                    await cacheService.setCache(cache_key, items);
                }

                res.json(
                    {
                        timestamp: timeNow(),
                        next_offset: hasMore ? offset + limit : null,
                        has_more: hasMore,
                        items: items,
                    },
                    200,
                );
            } catch (e) {
                console.error(e);
                res.json('Error retrieving data', 400);
            }

            resolve();
        });
    },
};
