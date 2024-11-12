const axios = require('axios');
const jwt = require('jsonwebtoken');
const { loadScriptEnv, timeNow, generateToken } = require('../../services/shared');
const dbService = require('../../services/db');
const { batchInsert, batchUpdate } = require('../../services/db');

loadScriptEnv();

let countries = [];

let genresDict = {};

let system_process = {
    genres: {
        key: 'music_genres_last_country',
        data: null
    },
    artists: {
        key: 'music_artists_last_country_offset',
        data: null
    }
};

const config = {
    base_url: 'https://api.music.apple.com/v1',
    batch_size: 25,
    keys: {
        team_id: process.env.APPLE_TEAM_ID,
        key_id: process.env.APPLE_MUSIC_KEY_ID,
        private_key: process.env.APPLE_MUSIC_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    request_timeout: 30000
};

let api = {
    client: null,
    setClient: function() {
        const token = jwt.sign({}, config.keys.private_key, {
            algorithm: 'ES256',
            expiresIn: '12h',
            issuer: config.keys.team_id,
            header: {
                alg: 'ES256',
                kid: config.keys.key_id
            }
        });

        this.client = axios.create({
            baseURL: config.base_url,
            timeout: config.request_timeout,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },
    makeRequest: async function(endpoint, params, retries = 3) {
        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                let response = await this.client.get(endpoint, params || {});

                return response.data;
            } catch (error) {
                lastError = error;

                if (error.response?.status === 429) {
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (error.response?.status === 401) {
                    api.setClient();
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    },
    getGenres: async function () {
        console.log("Get genres");

        for(let country of countries) {
            //batch update db by country
            let batch_insert_genres = [];
            let batch_insert_country = [];
            let batch_position_updates = [];
            let batch_deletes = [];

            //skip already processed country
            if(system_process.genres.data && country.id <= system_process.genres.data) {
                continue;
            }

            console.log(`Starting country: ${country.country_name}`);

            try {
                const response = await api.makeRequest(`/catalog/${country.country_code.toLowerCase()}/genres`);
                let genres = response.data;

                let currentGenres = {};
                let missingParents = {};

                // Organize missing parents
                for(let genre of genres) {
                    let parentId = genre.attributes.parentId;
                    let parentName = genre.attributes.parentName;

                    if (parentId && parentName) {
                        // Check if parent exists in our list
                        let parentExists = genres.some(g => g.id === parentId);

                        if (!parentExists && !genresDict.byAppleId[parentId]) {
                            missingParents[parentId] = {
                                id: parentId,
                                name: parentName
                            };
                        }
                    }
                }

                // Insert missing parents first
                for(let apple_id in missingParents) {
                    let parent = missingParents[apple_id];

                    if (!genresDict.byAppleId[parent.id]) {
                        let new_parent = {
                            token: generateToken(10),
                            name: parent.name,
                            apple_id: parent.id,
                            parent_id: null,
                            is_active: true,
                            created: timeNow(),
                            updated: timeNow()
                        };

                        batch_insert_genres.push(new_parent);
                        currentGenres[parent.id] = 1;

                        genresDict.byAppleId[parent.id] = {
                            ...new_parent,
                            countries: {}
                        };
                    }
                }

                // If we inserted any parents, do the batch insert now
                if (batch_insert_genres.length) {
                    await batchInsert('music_genres', batch_insert_genres, true);

                    // Update genresDict with new IDs
                    for(let i = 0; i < batch_insert_genres.length; i++) {
                        let genre = batch_insert_genres[i];
                        genresDict.byAppleId[genre.apple_id] = genre;
                    }

                    batch_insert_genres = []; // Reset for main genres
                }

                // Now process all regular genres
                for(let i = 0; i < genres.length; i++) {
                    let position = i;
                    let genre = genres[i];
                    let name = genre.attributes.name;
                    let apple_id = genre.id;
                    let parent_apple_id = genre.attributes.parentId;

                    currentGenres[apple_id] = 1;

                    // Check if genre exists
                    if(!genresDict.byAppleId[apple_id]) {
                        let parent_id = null;
                        if (parent_apple_id && genresDict.byAppleId[parent_apple_id]) {
                            parent_id = genresDict.byAppleId[parent_apple_id].id;
                        }

                        let new_genre = {
                            token: generateToken(10),
                            name: name,
                            apple_id: apple_id,
                            parent_id: parent_id,
                            is_active: true,
                            created: timeNow(),
                            updated: timeNow()
                        };

                        batch_insert_genres.push(new_genre);

                        genresDict.byAppleId[apple_id] = {
                            ...new_genre,
                            countries: {}
                        };
                    }

                    // Handle country association and positioning
                    let countryGenres = genresDict.byCountry[country.id] || {};
                    let existingAssociation = countryGenres[apple_id];

                    if(!existingAssociation) {
                        batch_insert_country.push({
                            country_id: country.id,
                            apple_id: apple_id,
                            position: position,
                            created: timeNow(),
                            updated: timeNow()
                        });
                    } else if(existingAssociation.position !== position) {
                        batch_position_updates.push({
                            id: existingAssociation.country_genre_id,
                            position: position,
                            updated: timeNow()
                        });
                    }
                }

                // Handle deletions - soft delete genres that are no longer returned
                if(genresDict.byCountry[country.id]) {
                    for(let apple_id in genresDict.byCountry[country.id]) {
                        if(!(apple_id in currentGenres)) {
                            let association = genresDict.byCountry[country.id][apple_id];

                            batch_deletes.push({
                                id: association.country_genre_id,
                                deleted: timeNow(),
                                updated: timeNow()
                            });
                        }
                    }
                }

                //inserts
                if(batch_insert_genres.length) {
                    await batchInsert('music_genres', batch_insert_genres, true);

                    // Update genresDict with new IDs
                    for(let i = 0; i < batch_insert_genres.length; i++) {
                        let genre = batch_insert_genres[i];
                        genresDict.byAppleId[genre.apple_id].id = genre.id;
                    }
                }

                if(batch_insert_country.length) {
                    batch_insert_country = batch_insert_country.map(item => {
                        const { apple_id, ...insert } = item;

                        return {
                            ...insert,
                            genre_id: genresDict.byAppleId[apple_id].id
                        };
                    });

                    await batchInsert('music_genres_countries', batch_insert_country);
                }

                // updates
                if(batch_position_updates.length) {
                    await batchUpdate('music_genres_countries', batch_position_updates);
                }

                // Update parent relationships after all genres are created
                let parent_updates = [];

                for(let genre of genres) {
                    let parent_id = genre.attributes.parentId || null;

                    if(parent_id && genresDict.byAppleId[parent_id] && genresDict.byAppleId[genre.id]) {
                        parent_updates.push({
                            id: genresDict.byAppleId[genre.id].id,
                            parent_id: genresDict.byAppleId[parent_id].id,
                            updated: timeNow()
                        });
                    }
                }

                if(parent_updates.length) {
                    await dbService.batchUpdate('music_genres', parent_updates);
                }

                //deletes
                if(batch_deletes.length) {
                    await dbService.batchUpdate('music_genres_countries', batch_deletes);
                    batch_deletes = [];
                }

                //set as processed
                await updateSystemProcess(system_process.genres.key, country.id);
            } catch (error) {
                //allow continuation on invalid path (i.e. catalog/ad)

                if(['40008', '40009'].includes(error.response?.data?.errors?.[0]?.code)) {
                    await updateSystemProcess(system_process.genres.key, country.id);
                    continue;
                }

                console.error('Error fetching genres:', error.message);
                throw error;
            }
        }
    }
};

async function updateSystemProcess(system_key, value, to_json) {
    let conn = await dbService.conn();

    if(to_json) {
        value = JSON.stringify(value);
    }

    let qry_check = await conn('system')
        .where('system_key', system_key)
        .first();

    if(qry_check) {
        await conn('system')
            .where('id', qry_check.id)
            .update({
                system_value: value,
                updated: timeNow()
            });
    } else {
        await conn('system')
            .insert({
                system_key: system_key,
                system_value: value,
                created: timeNow(),
                updated: timeNow()
            });
    }
}

async function loadSystemProcess() {
    let conn = await dbService.conn();

    //genres
    let genres_qry = await conn('system')
        .where('system_key', system_process.genres.key)
        .first();

    if(genres_qry) {
        //id of last country processed
        system_process.genres.data = parseInt(genres_qry.system_value);
    }

    //artists
    let artists_qry = await conn('system')
        .where('system_key', system_process.artists.key)
        .first();
    
    if(artists_qry) {
        system_process.artists.data = JSON.parse(genres_qry.system_value);
    }
}

async function loadCountries() {
    let conn = await dbService.conn();

    countries = await conn('open_countries')
        .orderBy('id');
}

async function loadGenres() {
    let conn = await dbService.conn();

    genresDict = {
        byAppleId: {},
        byCountry: {}
    };

    let genres = await conn('music_genres AS mg')
        .leftJoin('music_genres_countries AS mgc', 'mg.id', 'mgc.genre_id')
        .select(
            'mg.id',
            'mg.token',
            'mg.apple_id',
            'mgc.country_id',
            'mgc.position',
            'mgc.id AS country_genre_id'
        );

    // Organize lookups
    for(let genre of genres) {
        if(!genresDict.byAppleId[genre.apple_id]) {
            genresDict.byAppleId[genre.apple_id] = {
                id: genre.id,
                token: genre.token,
                apple_id: genre.apple_id,
                countries: {}
            };
        }

        if(genre.country_id) {
            if(!genresDict.byCountry[genre.country_id]) {
                genresDict.byCountry[genre.country_id] = {};
            }

            genresDict.byCountry[genre.country_id][genre.apple_id] = {
                id: genre.id,
                position: genre.position,
                country_genre_id: genre.country_genre_id
            };
        }
    }
}


async function main() {
    try {
        api.setClient();
        await loadSystemProcess();
        await loadCountries();
        await loadGenres();

        await api.getGenres();

    } catch (error) {
        console.error('Error in main execution:', error);
    }
}

module.exports = {
    main
};

if (require.main === module) {
    (async function () {
        try {
            await main();
            process.exit();
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    })();
}