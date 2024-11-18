const {
    loadScriptEnv,
    timeNow,
    generateToken,
    updateSystemProcess,
    sleep,
} = require('../../services/shared');

const { batchInsert, batchUpdate } = require('../../services/db');
const dbService = require('../../services/db');
const { keys: systemKeys, getProcess } = require('../../services/system');
const { api } = require('./api');
const { genreMap } = require('./genres_map');
const { loadGenres } = require('./add_genres');

loadScriptEnv();

let genresDict = {};
let artistsDict = {
    byMbId: {},
    bySpotifyId: {},
    genres: {},
};

let prevGenre = null;

async function getArtistsMB() {
    console.log("Get artists: Music Brainz");

    //get all artists in music brainz db
    let totals = {
        artists: {
            added: 0,
            updated: 0,
        },
    };

    let batchSize = api.mb.config.batchSize;

    for (let [id, genreData] of Object.entries(genresDict.byId)) {
        id = parseInt(id);

        let mb_genres;

        if (!genreData.is_active) {
            continue;
        }

        let genre_totals = {
            artists: {
                added: 0,
                updated: 0,
            }
        };

        //redo punk,new age, pop,r&b
        // if (![405,415,416,417].includes(id)) {
        //     continue;
        // }

        if (prevGenre && id <= prevGenre) {
            continue;
        }

        try {
            mb_genres = JSON.parse(genreData.mb_genres);
        } catch (e) {}

        if (!mb_genres) {
            continue;
        }

        console.log({
            starting_genre: genreData.name,
        });

        for (let genre_name of mb_genres) {
            console.log({
                mb_genre: genre_name,
            });

            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                await sleep(500);

                try {
                    const response = await api.mb.makeRequest('/artist', {
                        query: `tag:${genre_name}`,
                        limit: batchSize,
                        offset: offset,
                    });

                    const artists = response.artists || [];

                    hasMore = artists.length === batchSize;

                    let batch_insert_artists = [];
                    let batch_update_artists = [];

                    for (let i = 0; i < artists.length; i++) {
                        const artist = artists[i];
                        let tags = artist.tags || [];
                        tags = tags.slice(0, 10);
                        let tags_arr = [];

                        for(let tag of tags) {
                            if(tag.length > 100) {
                                continue;
                            }

                            tags_arr.push(tag);
                        }

                        const artistData = {
                            name: artist.name.substring(0, 250),
                            sort_name: artist['sort-name'],
                            mb_id: artist.id,
                            mb_score: artist.score,
                            mb_type: artist.type || null,
                            mb_tags: JSON.stringify(tags_arr),
                            updated: timeNow(),
                        };

                        if (!artistsDict.byMbId[artist.id]) {
                            let insert = {
                                ...artistData,
                                token: generateToken(12),
                                created: timeNow(),
                            };

                            batch_insert_artists.push(insert);
                        } else {
                            const existing = artistsDict.byMbId[artist.id];
                            let hasChanges = false;

                            for (const key in artistData) {
                                if (key in existing && existing[key] !== artistData[key]) {
                                    hasChanges = true;
                                    break;
                                }
                            }

                            if (hasChanges) {
                                batch_update_artists.push({
                                    id: existing.id,
                                    ...artistData,
                                });
                            }
                        }
                    }

                    if (batch_insert_artists.length) {
                        await batchInsert('music_artists', batch_insert_artists, true);
                        totals.artists.added += batch_insert_artists.length;
                        genre_totals.artists.added += batch_insert_artists.length;

                        for (const artist of batch_insert_artists) {
                            artistsDict.byMbId[artist.mb_id] = artist;
                        }
                    }

                    if (batch_update_artists.length) {
                        await batchUpdate('music_artists', batch_update_artists);

                        totals.artists.updated += batch_update_artists.length;
                        genre_totals.artists.updated += batch_update_artists.length;
                    }

                    console.log({
                        processed: `${artists.length + offset}/${response.count}`,
                    });

                    offset += batchSize;
                } catch (error) {
                    console.error('Error fetching artists:', error.message);

                    if (error.response?.status === 503) {
                        await new Promise((resolve) => setTimeout(resolve, 5000));
                        continue;
                    }
                    break;
                }
            }
        }

        console.log(genre_totals);

        await updateSystemProcess(systemKeys.music.artists.genre, id);
    }

    console.log(totals);
}

async function updateArtistsSpotify(parallelCount) {
    function mapSpotifyGenres(genres) {
        return genres.reduce((acc, spotifyGenre) => {
            for(let k in genreMap) {
                let genreData = genreMap[k];

                if(genreData.s?.includes(spotifyGenre)) {
                    const ourGenre = genresDict.byName[genreData.name];

                    if(ourGenre) {
                        acc[ourGenre.id] = ourGenre;
                    }
                }
            }

            return acc;
        }, {});
    }

    async function processArtistBatch(artists) {
        for (let i = 0; i < artists.length; i++) {
            let artist = artists[i];

            try {
                await sleep(100); // Respect rate limits

                // Search artist on Spotify
                const response = await api.spotify.makeRequest('/search', {
                    params: {
                        q: artist.name,
                        type: 'artist',
                        limit: 10
                    }
                });

                let updateData = {
                    spotify_processed: 1,
                    updated: timeNow()
                };

                let potential_matches = response.artists.items.filter(item => item.name === artist.name);

                if(!potential_matches.length) {
                    totals.not_found++;
                } else {
                    if(potential_matches.length > 1) {
                        potential_matches.sort(function(a, b) {
                            return b.followers?.total - a.followers?.total;
                        });

                        let duplicate_check = [];

                        for(let m of potential_matches) {
                            duplicate_check.push({
                                name: m.name,
                                followers: m.followers.total,
                                popularity: m.popularity,
                                genres: JSON.stringify(m.genres)
                            })
                        }
                    }

                    let spotifyArtist = potential_matches[0];

                    updateData = {
                        ...updateData,
                        spotify_id: spotifyArtist.id,
                        spotify_type: spotifyArtist.type,
                        spotify_popularity: spotifyArtist.popularity,
                        spotify_followers: spotifyArtist.followers.total,
                        spotify_genres: spotifyArtist.genres.length ? JSON.stringify(spotifyArtist.genres) : null,
                    };

                    // Update genre associations if genres found
                    if (spotifyArtist.genres.length) {
                        const artistGenres = artistsDict.genres[artist.id];

                        const mappedGenres = mapSpotifyGenres(spotifyArtist.genres);

                        const batch_insert_genres = [];

                        // adding genre
                        for(let genre_id in mappedGenres) {
                            if(!(genre_id in artistGenres)) {
                                batch_insert_genres.push({
                                    artist_id: artist.id,
                                    genre_id: genre_id,
                                    created: timeNow(),
                                    updated: timeNow()
                                });
                            }
                        }

                        // deleting genre
                        for(let genre_id in artistGenres) {
                            if(!(genre_id in mappedGenres)) {
                                let item = mappedGenres[genre_id];

                                await conn('music_artists_genres')
                                    .where('id', item.mag_id)
                                    .update({
                                        updated: timeNow(),
                                        deleted: timeNow()
                                    });
                            }
                        }

                        if (batch_insert_genres.length) {
                            await batchInsert('music_artists_genres', batch_insert_genres);
                        }
                    }

                    totals.found++;
                }

                // Update artist with Spotify data
                await conn('music_artists')
                    .where('id', artist.id)
                    .update(updateData);

                totals.processed++;

                if (totals.processed % 100 === 0) {
                    console.log(totals);
                }
            } catch (error) {
                console.error(`Error processing artist ${artist.name}:`, error.message);

                totals.errors++;

                if (error.response?.status === 429) {
                    console.log('Rate limit hit, waiting...');
                    await sleep(5000);
                }
            }
        }
    }

    let totals = {
        processed: 0,
        found: 0,
        not_found: 0,
        errors: 0,
        count: 0
    };

    const conn = await dbService.conn();

    let artists = await conn('music_artists')
        .where('spotify_processed', 0);

    totals.count = artists.length;

    const batchSize = Math.ceil(artists.length / parallelCount);
    const batches = [];

    for(let i = 0; i < parallelCount; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, artists.length);
        const batch = artists.slice(start, end);

        batches.push(processArtistBatch(batch, i + 1, totals));
    }

    await Promise.all(batches);

    console.log('Final totals:', totals);
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
            'ma.spotify_id',
            'ma.spotify_popularity',
            'ma.spotify_followers',
            'ma.spotify_processed',
            'ma.mb_id',
            'ma.mb_type',
            'ma.mb_score',
            'mag.id AS mag_id',
            'mag.genre_id',
        );

    for (const artist of artists) {
        let data = {
            id: artist.id,
            token: artist.token,
            name: artist.name,
            sort_name: artist.sort_name,
            spotify_id: artist.spotify_id,
            spotify_popularity: artist.spotify_popularity,
            spotify_followers: artist.spotify_followers,
            spotify_processed: artist.spotify_processed,
            mb_id: artist.mb_id,
            mb_type: artist.mb_type,
            mb_score: artist.mb_score,
        };

        if (!artistsDict.byMbId[artist.mb_id]) {
            artistsDict.byMbId[artist.mb_id] = data;
        }

        if (!artistsDict.bySpotifyId[artist.spotify_id]) {
            artistsDict.bySpotifyId[artist.spotify_id] = data;
        }

        if (!artistsDict.genres[artist.id]) {
            artistsDict.genres[artist.id] = {};
        }

        if (artist.genre_id) {
            artistsDict.genres[artist.id][artist.genre_id] = {
                artist_id: artist.id,
                genre_id: artist.genre_id,
                mag_id: artist.mag_id,
                popularity: artist.popularity,
            };
        }
    }

    return artistsDict;
}

async function main() {
    try {
        console.log('Processing artists');

        await loadSystemProcess();
        genresDict = (await loadGenres());

        await loadArtists();

        await getArtistsMB();

        await updateArtistsSpotify(2);
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
