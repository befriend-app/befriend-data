const cacheService = require('../services/cache');
const dbService = require('../services/db');
const { timeNow } = require('../services/shared');
const { getObj, setCache } = require('../services/cache');
const { getLastUpdated } = require('../services/system');

module.exports = {
    batchLimit: 50000, //changing this value affects cache
    data: {
        countries: null,
        states: null,
        cities: null,
    },
    getUpdates: function (req, res) {
        return new Promise(async (resolve, reject) => {
            let keys = cacheService.keys.updated;

            //db/cache/code
            // Get last updated timestamps for all endpoints
            const [
                activity_types,
                venues_categories,
                activity_venues_categories,
                countries,
                states,
                cities,
                instruments,
                music_genres,
                music_artists,
                music_artists_genres,
                sections,
                schools,
            ] = await Promise.all([
                getLastUpdated(keys.activities.types, 'activity_types'),
                getLastUpdated(keys.activities.venues_categories, 'venues_categories'),
                getLastUpdated(keys.activities.activity_venues_categories, 'activity_type_venues'),
                getLastUpdated(keys.locations.countries, 'open_countries'),
                getLastUpdated(keys.locations.states, 'open_states'),
                getLastUpdated(keys.locations.cities, 'open_cities'),
                getLastUpdated(keys.instruments, 'instruments'),
                getLastUpdated(keys.music.genres, 'music_genres'),
                getLastUpdated(keys.music.artists, 'music_artists'),
                getLastUpdated(keys.music.artists_genres, 'music_artists_genres'),
                getLastUpdated(keys.sections, 'me_sections'),
                getLastUpdated(keys.schools, 'schools'),
            ]);

            //timestamps of last updated for each endpoint
            let organized = {
                activities: {
                    types: activity_types || null,
                    venues_categories: venues_categories || null,
                    activity_venues_categories: activity_venues_categories || null,
                },
                locations: {
                    countries: countries || null,
                    states: states || null,
                    cities: cities || null,
                },
                instruments: instruments || null,
                music: {
                    genres: music_genres || null,
                    artists: music_artists || null,
                    artists_genres: music_artists_genres || null,
                },
                sections: sections || null,
                schools: schools || null,
            };

            res.json(organized);

            resolve();
        });
    },
    getActivityTypes: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                //use cache
                let cache_data = await getObj(cacheService.keys.activity_types);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

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

                //set cache
                try {
                    await setCache(cacheService.keys.activity_types, items);
                } catch (e) {
                    console.error(e);
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
                //use cache
                let cache_data = await getObj(cacheService.keys.venues_categories);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

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

                //set cache
                try {
                    await setCache(cacheService.keys.venues_categories, items);
                } catch (e) {
                    console.error(e);
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
                //use cache
                let cache_data = await getObj(cacheService.keys.activity_venue_categories);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

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

                //set cache
                try {
                    await setCache(cacheService.keys.activity_venue_categories, items);
                } catch (e) {
                    console.error(e);
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
    getCountries: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                //use cache
                let cache_data = await getObj(cacheService.keys.countries);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

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

                //set cache
                try {
                    await setCache(cacheService.keys.countries, items);
                } catch (e) {
                    console.error(e);
                }

                res.json(
                    {
                        items: items,
                    },
                    200,
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
                //use cache
                let cache_data = await getObj(cacheService.keys.states);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

                let conn = await dbService.conn();

                let items = await conn('open_states AS os')
                    .join('open_countries AS oc', 'oc.id', '=', 'os.country_id')
                    .orderBy('country_code', 'asc')
                    .select(
                        'country_code',
                        'os.token',
                        'state_name',
                        'state_short',
                        'os.population',
                        'os.lat',
                        'os.lon',
                        'os.updated',
                    );

                //set cache
                try {
                    await setCache(cacheService.keys.states, items);
                } catch (e) {
                    console.error(e);
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
    countriesLookup: function () {
        return new Promise(async (resolve, reject) => {
            if (module.exports.data.countries) {
                return resolve(module.exports.data.countries);
            }

            try {
                let conn = await dbService.conn();

                // Countries lookup
                let countries = await conn('open_countries');
                let countries_dict = {};

                for (let country of countries) {
                    countries_dict[country.id] = country;
                }

                module.exports.data.countries = countries_dict;

                return resolve(countries_dict);
            } catch (e) {
                console.error(e);
                return reject();
            }
        });
    },
    statesLookup: function () {
        return new Promise(async (resolve, reject) => {
            if (module.exports.data.states) {
                return resolve(module.exports.data.states);
            }

            try {
                let conn = await dbService.conn();

                // States lookup
                let states = await conn('open_states');
                let states_dict = {};

                for (let state of states) {
                    states_dict[state.id] = state.token;
                }

                module.exports.data.states = states_dict;

                return resolve(states_dict);
            } catch (e) {
                console.error(e);
                return reject();
            }
        });
    },
    citiesLookup: function () {
        return new Promise(async (resolve, reject) => {
            if (module.exports.data.cities) {
                return resolve(module.exports.data.cities);
            }

            try {
                let conn = await dbService.conn();

                let cities = await conn('open_cities').select('id', 'token', 'country_id');

                let cities_dict = {};

                for (let city of cities) {
                    if (!(city.country_id in cities_dict)) {
                        cities_dict[city.country_id] = {};
                    }

                    cities_dict[city.country_id][city.id] = city.token;
                }

                cities = null;

                module.exports.data.cities = cities_dict;

                return resolve(cities_dict);
            } catch (e) {
                console.error(e);
                return reject();
            }
        });
    },
    getCities: function (req, res) {
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

                let countries = await module.exports.countriesLookup();
                let states = await module.exports.statesLookup();

                let conn = await dbService.conn();

                let query = conn('open_cities')
                    .orderBy('id')
                    .select(
                        'token',
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

                    item.state_token = states[item.state_id] || null;

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
    getInstruments: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                //use cache
                let cache_data = await getObj(cacheService.keys.instruments);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

                let conn = await dbService.conn();

                let items = await conn('instruments').select(
                    'token',
                    'name',
                    'popularity',
                    'is_common',
                    'category',
                    'updated',
                );

                try {
                    await setCache(cacheService.keys.instruments, items);
                } catch (e) {
                    console.error(e);
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
    getMusicGenres: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                //use cache
                let cache_data = await getObj(cacheService.keys.music_genres);

                //todo remove
                if (false && cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

                let items = {
                    genres: {},
                };

                let genreDict = {};

                let conn = await dbService.conn();

                // Get all genres
                let genres = await conn('music_genres').select(
                    'id',
                    'token',
                    'name',
                    'parent_id',
                    'is_active',
                    'is_featured',
                    'position',
                    'updated',
                    'deleted',
                );

                // Create genres lookup
                for (let genre of genres) {
                    genreDict[genre.id] = genre;
                }

                // Organize genres with parent tokens
                for (let genre of genres) {
                    items.genres[genre.token] = {
                        token: genre.token,
                        parent_token: genre.parent_id ? genreDict[genre.parent_id]?.token : null,
                        name: genre.name,
                        is_active: genre.is_active,
                        is_featured: genre.is_featured,
                        position: genre.position,
                        updated: genre.updated,
                        deleted: genre.deleted
                    };
                }

                try {
                    await setCache(cacheService.keys.music_genres, items);
                } catch (e) {
                    console.error(e);
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
    getMusicArtists: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                const limit = module.exports.batchLimit;
                let offset = Math.floor((parseInt(req.query.offset) || 0) / limit) * limit;

                const cache_key = cacheService.keys.music_artists_offset(offset);

                if (!req.query.updated) {
                    let cache_data = await cacheService.getObj(cache_key);

                    //todo remove
                    if (false && cache_data) {
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

                let conn = await dbService.conn();

                // Get all artists
                let query = conn('music_artists')
                    .select(
                        'token',
                        'name',
                        'sort_name',
                        'spotify_followers',
                        'spotify_popularity',
                        'spotify_genres',
                        'is_active',
                        'updated',
                        'deleted',
                    )
                    .limit(limit + 1)
                    .offset(offset);

                if (req.query.updated) {
                    query = query.where('updated', '>', req.query.updated);
                }

                let items = await query;

                const hasMore = items.length > limit;

                if (hasMore) {
                    items = items.slice(0, limit);
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
    getMusicArtistsGenres: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                const limit = module.exports.batchLimit;
                let offset = Math.floor((parseInt(req.query.offset) || 0) / limit) * limit;

                const cache_key = cacheService.keys.music_artists_genres_offset(offset);

                if (!req.query.updated) {
                    let cache_data = await cacheService.getObj(cache_key);

                    if (false && cache_data) {
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

                let conn = await dbService.conn();

                // First get genre lookup dictionary
                let genres = await conn('music_genres').select('id', 'token');

                let genreDict = {};
                for (let genre of genres) {
                    genreDict[genre.id] = genre.token;
                }

                // Now get artist lookup dictionary
                let artists = await conn('music_artists').select('id', 'token');

                let artistDict = {};
                for (let artist of artists) {
                    artistDict[artist.id] = artist.token;
                }

                // Get all artist-genre associations with pagination
                let query = conn('music_artists_genres')
                    .select('artist_id', 'genre_id', 'updated', 'deleted')
                    .limit(limit + 1)
                    .offset(offset);

                // On subsequent requests
                if (req.query.updated) {
                    query = query.where('updated', '>', req.query.updated);
                }

                let items = await query;

                // Transform IDs to tokens
                for (let item of items) {
                    item.artist_token = artistDict[item.artist_id];
                    item.genre_token = genreDict[item.genre_id];

                    delete item.artist_id;
                    delete item.genre_id;
                }

                const hasMore = items.length > limit;

                if (hasMore) {
                    items = items.slice(0, limit);
                }

                // Only update cache if no updated timestamp
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
    getMeSections: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                //use cache
                let cache_data = await getObj(cacheService.keys.sections);

                if (cache_data) {
                    res.json(
                        {
                            items: cache_data,
                        },
                        200,
                    );

                    return resolve();
                }

                let conn = await dbService.conn();

                let items = await conn('me_sections').select(
                    'section_key',
                    'section_name',
                    'icon',
                    'position',
                    'active',
                    'updated',
                );

                try {
                    await setCache(cacheService.keys.sections, items);
                } catch (e) {
                    console.error(e);
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
    getSchools: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                const limit = module.exports.batchLimit;
                let offset = Math.floor((parseInt(req.query.offset) || 0) / limit) * limit;

                const cache_key = cacheService.keys.schools_offset(offset);

                //todo remove
                if (false && !req.query.updated) {
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

                let countries = await module.exports.countriesLookup();
                let states = await module.exports.statesLookup();
                let cities = await module.exports.citiesLookup();

                let conn = await dbService.conn();

                let query = conn('schools')
                    .whereNotNull('city_id')
                    .orderBy('id')
                    .select(
                        'token',
                        'name',
                        'country_id',
                        'city_id',
                        'state_id',
                        'student_count',
                        'lat',
                        'lon',
                        'is_grade_school',
                        'is_high_school',
                        'is_college',
                        'updated',
                        'deleted',
                    )
                    .limit(limit + 1)
                    .offset(offset);

                // On subsequent requests
                if (req.query.updated) {
                    query = query.where('updated', '>', req.query.updated);
                }

                let items = await query;

                //replace country/state/city id with token
                for (let item of items) {
                    item.country_code = countries[item.country_id].country_code;

                    item.state_token = states[item.state_id]?.token || null;

                    if (!(item.country_id in cities)) {
                        item.city_token = null;
                    } else {
                        item.city_token = cities[item.country_id][item.city_id] || null;
                    }

                    delete item.country_id;
                    delete item.state_id;
                    delete item.city_id;

                    //remove unused is_{col} to save space
                    if (!item.is_grade_school) {
                        delete item.is_grade_school;
                    }

                    if (!item.is_high_school) {
                        delete item.is_high_school;
                    }

                    if (!item.is_college) {
                        delete item.is_college;
                    }
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
