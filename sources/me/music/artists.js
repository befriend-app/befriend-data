const {
    loadScriptEnv,
    timeNow,
    generateToken,
    sleep,
} = require('../../../services/shared');

const { batchInsert, batchUpdate } = require('../../../services/db');
const dbService = require('../../../services/db');
const { keys: systemKeys, getProcess, saveProcess } = require('../../../services/system');
const { api } = require('./api');
const { genreMap } = require('./genres_map');
const { loadGenres } = require('./genres');

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

        // redo r&b
        // if (![417].includes(id)) {
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
                            sort_name: artist['sort-name'].substring(0, 250),
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

        await saveProcess(systemKeys.music.artists.genre, id);
    }

    console.log(totals);
}

async function updateArtistsSpotify(parallelCount) {
    console.log("Update artists w/ spotify data");

    async function processArtistBatch(artists) {
        for (let i = 0; i < artists.length; i++) {
            let artist = artists[i];

            try {
                await sleep(100);

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
                    let retryAfter = parseInt(error.response.headers['retry-after']);

                    console.log({
                        slowing_down: `${retryAfter} sec`
                    });

                    await sleep(retryAfter * 1000 + 2000);
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
        .where('spotify_processed', 0)
        .orderBy('mb_score', 'desc');

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
    console.log("Loading existing artists");

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

async function deleteDuplicates() {
    let conn = await dbService.conn();

    // Get all undeleted artists
    let artists = await conn('music_artists')
        .select('id', 'name', 'spotify_id')
        .whereNull('deleted')
        .whereNotNull('spotify_id') // Only consider artists with spotify_id
        .orderBy('id'); // Order by ID to keep earliest entries

    // Group by spotify_id
    let spotifyGroups = {};
    for (let artist of artists) {
        if (!spotifyGroups[artist.spotify_id]) {
            spotifyGroups[artist.spotify_id] = [];
        }
        spotifyGroups[artist.spotify_id].push(artist);
    }

    // Find duplicates (keep first, mark rest for deletion)
    let deleteIds = [];
    let now = timeNow();

    for (let spotify_id in spotifyGroups) {
        let group = spotifyGroups[spotify_id];
        if (group.length > 1) {
            for (let i = 1; i < group.length; i++) {
                deleteIds.push(group[i].id);
            }
        }
    }

    // Perform deletion if we found any duplicates
    if (deleteIds.length) {
        console.log(`Deleting ${deleteIds.length} duplicate artists`);

        try {
            await conn('music_artists')
                .whereIn('id', deleteIds)
                .update({
                    deleted: now,
                    updated: now
                });
        } catch (e) {
            console.error('Error deleting duplicates:', e);
            throw e;
        }
    } else {
        console.log('No duplicates found');
    }
}

async function updateArtistsGenres() {
    const conn = await dbService.conn();

    // Get artists with spotify genres
    let artists = await conn('music_artists')
        .whereNotNull('spotify_genres');

    // Get existing artist/genre relationships
    let artistGenres = await conn('music_artists_genres');

    // Get spotify genre mappings
    let spotifyGenres = await conn('music_genres_spotify_genres AS mgsg')
        .join('music_spotify_genres AS msg', 'msg.id', '=', 'mgsg.spotify_genre_id')
        .join('music_genres AS mg', 'mg.id', '=', 'mgsg.genre_id')
        .select({
            spotify_genre: 'msg.name',
            genre_id: 'mg.id'
        });

    // Create lookup for existing artist/genre relationships
    let artistGenreLookup = artistGenres.reduce((acc, genre) => {
        if(!(genre.artist_id in acc)) {
            acc[genre.artist_id] = {};
        }

        acc[genre.artist_id][genre.genre_id] = genre;
        return acc;
    }, {});

    // Create lookup for spotify genre to genre_id mapping
    let spotifyGenreLookup = spotifyGenres.reduce((acc, mapping) => {
        acc[mapping.spotify_genre.toLowerCase()] = mapping.genre_id;
        return acc;
    }, {});

    let batch_insert = [];

    // Process each artist
    for(let artist of artists) {
        let spotifyGenres = [];

        try {
            spotifyGenres = JSON.parse(artist.spotify_genres || '[]');
        } catch(e) {
            console.error(`Invalid JSON for artist ${artist.id}:`, e);
            continue;
        }

        // Process each spotify genre
        for(let spotifyGenre of spotifyGenres) {
            const genreId = spotifyGenreLookup[spotifyGenre.toLowerCase()];

            // Skip if we don't have a mapping for this spotify genre
            if(!genreId) {
                console.log("Missing genre: " + spotifyGenre);
                continue;
            }

            // Check if this artist/genre relationship already exists
            const existingGenre = artistGenreLookup[artist.id]?.[genreId];

            if(!existingGenre) {
                // New relationship - add to insert batch
                let data = {
                    artist_id: artist.id,
                    genre_id: genreId,
                    created: timeNow(),
                    updated: timeNow()
                };

                batch_insert.push(data);

                if(!(artist.id in artistGenreLookup)) {
                    artistGenreLookup[artist.id] = {};
                }

                artistGenreLookup[artist.id][genreId] = data;
            }
        }
    }

    // Process batches
    if(batch_insert.length) {
        try {
            await batchInsert('music_artists_genres', batch_insert);
        } catch(e) {
            console.error('Error during batch insert:', e);
        }
    }

    console.log({
        added: batch_insert.length
    })
}

async function main() {
    try {
        console.log('Processing artists');

        //load previous process state
        await loadSystemProcess();

        //load existing genres
        genresDict = (await loadGenres());

        //load existing artists
        await loadArtists();

        //get artists from music brainz

        // await getArtistsMB();

        //update artists w/ spotify data
        await updateArtistsSpotify(3);

        //delete duplicate artists
        await deleteDuplicates();

        //add/merge spotify genres
        // await require('./merge').main();

        //link artists to genres
        await updateArtistsGenres();
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
