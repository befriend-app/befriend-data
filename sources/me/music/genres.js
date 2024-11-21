const { loadScriptEnv, timeNow, generateToken } = require('../../../services/shared');
const { batchInsert, batchUpdate } = require('../../../services/db');
const dbService = require('../../../services/db');
const { keys: systemKeys, getProcess, saveProcess } = require('../../../services/system');
const { api } = require('./api');
const { genreMap } = require('./genres_map');

loadScriptEnv();

let countries = [];

let genresDict = {
    byId: {},
    byName: {},
    byCountry: {},
};

let prevLastCountry = null;

function findMBGenre(genre_name) {
    //creates mapping between Apple Music genres and Music Brainz tags
    if (!genre_name) {
        return null;
    }

    const directMatch = genreMap[genre_name];

    if (directMatch) {
        // No subgenres
        if (Array.isArray(directMatch)) {
            return directMatch;
        }
        // If main/subgenres structure, return main tags
        if (directMatch.main) {
            return directMatch.main;
        }
    }

    // Search in subgenres of regional music
    for (const [mainGenre, value] of Object.entries(genreMap)) {
        if (value.subgenres) {
            const subgenreMatch = value.subgenres[genre_name];

            if (subgenreMatch) {
                return subgenreMatch;
            }
        }
    }

    return null;
}

function findSpotifyGenre(genre_name) {
    for (let k in genreMap) {
        let genre = genreMap[k];

        if (genre.s.includes(genre_name)) {
            return genre;
        }
    }
}

async function getGenres() {
    console.log('Get genres');

    try {
        const response = await api.spotify.makeRequest('/recommendations/available-genre-seeds');

        let spotifyGenres = response.genres;
        let batch_insert = [];

        for (let genreName of spotifyGenres) {
            //find genre
            let genre = findSpotifyGenre(genreName);

            if (!genre) {
                continue;
            }

            if (genre.name in genresDict.byName) {
                continue;
            }

            let data = {
                token: generateToken(10),
                name: genre.name,
                spotify_genres: JSON.stringify(genre.s),
                mb_genres: JSON.stringify(genre.mb),
                is_featured: true,
                position: genre.position,
                created: timeNow(),
                updated: timeNow(),
            };

            batch_insert.push(data);

            genresDict.byName[genre.name] = data;
        }

        if (batch_insert.length) {
            await batchInsert('music_genres', batch_insert);

            console.log(`Added ${batch_insert.length} new genres`);
        }
    } catch (error) {
        console.error('Error fetching Spotify genres:', error.message);
        throw error;
    }
}

async function loadSystemProcess() {
    prevLastCountry = await getProcess(systemKeys.music.genres);

    prevLastCountry = prevLastCountry ? parseInt(prevLastCountry) : null;
}

async function loadCountries() {
    let conn = await dbService.conn();

    countries = await conn('open_countries').orderBy('id');
}

async function loadGenres() {
    let conn = await dbService.conn();

    let genres = await conn('music_genres AS mg')
        .leftJoin('music_genres_countries AS mgc', 'mg.id', 'mgc.genre_id')
        .select(
            'mg.id',
            'mg.token',
            'mg.apple_id',
            'mg.name',
            'mg.is_active',
            'mg.spotify_genres',
            'mg.mb_genres',
            'mgc.country_id',
            'mgc.position',
            'mgc.id AS country_genre_id',
        );

    // Organize lookups
    for (let genre of genres) {
        let data = {
            id: genre.id,
            token: genre.token,
            name: genre.name,
            is_active: genre.is_active,
            spotify_genres: genre.spotify_genres,
            position: genre.position,
            apple_id: genre.apple_id,
            mb_genres: genre.mb_genres,
        };

        if (!genresDict.byId[genre.id]) {
            genresDict.byId[genre.id] = data;
        }

        if (!genresDict.byName[genre.name]) {
            genresDict.byName[genre.name] = data;
        }

        if (genre.country_id) {
            if (!genresDict.byCountry[genre.country_id]) {
                genresDict.byCountry[genre.country_id] = {};
            }

            genresDict.byCountry[genre.country_id][genre.id] = {
                id: genre.country_genre_id,
                genre_id: genre.id,
                position: genre.position,
            };
        }
    }

    return genresDict;
}

async function main() {
    try {
        console.log('Process genres');

        await loadSystemProcess();
        await loadCountries();
        await loadGenres();

        await getGenres();
    } catch (error) {
        console.error('Error in main execution:', error);
    }
}

module.exports = {
    main,
    loadGenres,
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
