const { loadScriptEnv, timeNow, generateToken, updateSystemProcess, sleep } = require('../../services/shared');
const { batchInsert, batchUpdate } = require('../../services/db');
const dbService = require('../../services/db');
const {keys: systemKeys, getProcess } = require('../../services/system');
const axios = require('axios');
const { api } = require('./api');
const { loadGenres } = require('./add_genres');

loadScriptEnv();

let genresDict = {};
let countries = [];
let artistsDict = {
    byMbid: {},
    byGenre: {}
};

let prevGenre = null;

async function getArtists() {
    let totals = {
        artists: {
            added: 0,
            updated: 0
        },
        artists_genres: {
            added: 0,
            updated: 0,
            deleted: 0,
            skipped: 0
        }
    };

    let batchSize = api.mb.config.batchSize;

    for (let [id, genreData] of Object.entries(genresDict)) {
        let genre_totals = {
            artists: {
                added: 0,
                updated: 0
            },
            artists_genres: {
                added: 0,
                updated: 0,
                deleted: 0,
                skipped: 0
            }
        };

        if(!(artistsDict.byGenre[id])) {
            artistsDict.byGenre[id] = {}
        }

        id = parseInt(id);

        let mb_genres;

        if (prevGenre && id <= prevGenre) {
            continue;
        }

        try {
            mb_genres = JSON.parse(genreData.mb_genres);
        } catch(e) {

        }

        if(!mb_genres) {
            continue;
        }

        console.log({
            starting_genre: genreData.name
        });

        for (let genre_name of mb_genres) {
            console.log({
                mb_genre: genre_name,
            });

            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                await sleep(1000);

                try {
                    const response = await api.mb.makeRequest('/artist', {
                        query: `tag:${genre_name}`,
                        limit: batchSize,
                        offset: offset
                    });

                    const artists = response.artists || [];

                    hasMore = artists.length === batchSize;

                    let batch_insert_artists = [];
                    let batch_insert_genres = [];
                    let batch_update_artists = [];

                    for (let i = 0; i < artists.length; i++) {
                        const artist = artists[i];
                        let tags = artist.tags || [];
                        tags = tags.slice(0, 20);

                        const artistData = {
                            name: artist.name,
                            mb_id: artist.id,
                            mb_score: artist.score,
                            sort_name: artist['sort-name'],
                            type: artist.type || null,
                            tags: JSON.stringify(tags),
                            updated: timeNow()
                        };

                        if (!artistsDict.byMbid[artist.id]) {
                            let insert = {
                                ...artistData,
                                token: generateToken(12),
                                created: timeNow(),
                            };

                            batch_insert_artists.push(insert);
                        } else {
                            const existing = artistsDict.byMbid[artist.id];
                            let hasChanges = false;

                            for (const key in artistData) {
                                if ((key in existing) && existing[key] !== artistData[key]) {
                                    hasChanges = true;
                                    break;
                                }
                            }

                            if (hasChanges) {
                                batch_update_artists.push({
                                    id: existing.id,
                                    ...artistData
                                });
                            }
                        }

                        if (!artistsDict.byGenre[genreData.id]?.[artist.id]) {
                            let insert = {
                                mb_artist_id: artist.id,
                                genre_id: genreData.id,
                                popularity: artist.score,
                                created: timeNow(),
                                updated: timeNow()
                            };

                            batch_insert_genres.push(insert);

                            artistsDict.byGenre[genreData.id][artist.id] = insert;
                        }
                    }

                    if (batch_insert_artists.length) {
                        await batchInsert('music_artists', batch_insert_artists, true);
                        totals.artists.added += batch_insert_artists.length;
                        genre_totals.artists.added += batch_insert_artists.length;

                        for (const artist of batch_insert_artists) {
                            artistsDict.byMbid[artist.mb_id] = artist;
                        }
                    }

                    if (batch_update_artists.length) {
                        await batchUpdate('music_artists', batch_update_artists);

                        totals.artists.updated += batch_update_artists.length;
                        genre_totals.artists.updated += batch_update_artists.length;
                    }

                    if (batch_insert_genres.length) {
                        for(let item of batch_insert_genres) {
                            item.artist_id = artistsDict.byMbid[item.mb_artist_id].id;
                            delete item.mb_artist_id;
                        }

                        await batchInsert('music_artists_genres', batch_insert_genres);
                        totals.artists_genres.added += batch_insert_genres.length;
                        genre_totals.artists_genres.added += batch_insert_genres.length;
                    }

                    console.log({
                        processed: `${artists.length + offset}/${response.count}`
                    });

                    offset += batchSize;
                } catch (error) {
                    console.error('Error fetching artists:', error.message);

                    if (error.response?.status === 503) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue;
                    }
                    break;
                }
            }
        }

        console.log(genre_totals);

        await updateSystemProcess(
            systemKeys.music.artists.genre,
            id
        );
    }

    console.log(totals);
}

async function loadSystemProcess() {
    prevGenre = await getProcess(systemKeys.music.artists.genre);
    prevGenre = prevGenre ? parseInt(prevGenre) : null;
}

async function loadArtists() {
    const conn = await dbService.conn();

    const artists = await conn('music_artists AS ma')
        .leftJoin('music_artists_genres AS mag', 'ma.id', 'mag.artist_id')
        .select(
            'ma.id',
            'ma.token',
            'ma.name',
            'ma.sort_name',
            'ma.mb_id',
            'ma.type',
            'ma.mb_score',
            'mag.id AS mag_id',
            'mag.genre_id'
        );

    for (const artist of artists) {
        if (!artistsDict.byMbid[artist.mb_id]) {
            artistsDict.byMbid[artist.mb_id] = {
                id: artist.id,
                token: artist.token,
                name: artist.name,
                mb_id: artist.mb_id,
                sort_name: artist.sort_name,
                type: artist.type,
                mb_score: artist.mb_score,
            };
        }

        if (artist.genre_id) {
            if (!artistsDict.byGenre[artist.genre_id]) {
                artistsDict.byGenre[artist.genre_id] = {};
            }

            artistsDict.byGenre[artist.genre_id][artist.mb_id] = {
                id: artist.id,
                mag_id: artist.mag_id,
                popularity: artist.popularity,
            };
        }
    }

    return artistsDict;
}

async function main() {
    try {
        console.log("Processing MusicBrainz artists");

        await loadSystemProcess();
        genresDict = (await loadGenres()).byId;

        await loadArtists();
        await getArtists();
    } catch (error) {
        console.error('Error in main execution:', error);
    }
}

module.exports = {
    main,
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