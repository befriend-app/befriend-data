const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
const { batchInsert, batchUpdate } = require('../../../services/db');

loadScriptEnv();

async function main() {
    console.log("Add spotify genres from artists");

    const conn = await dbService.conn();

    let artists = await conn('music_artists')
        .whereNotNull('spotify_genres');

    let genres = await conn('music_spotify_genres');

    let genresLookup = genres.reduce((acc, genre) => {
        acc[genre.name] = genre;
        return acc;
    }, {});

    let spotify_genres = new Set();

    for(let artist of artists) {
        try {
            let genres = JSON.parse(artist.spotify_genres);

            for(let g of genres) {
                spotify_genres.add(g);
            }
        } catch(e) {
            console.error(e);
        }
    }

    spotify_genres = Array.from(spotify_genres);

    let batch_insert = [];

    for(let genre of spotify_genres) {
        if(!(genre in genresLookup)) {
            batch_insert.push({
                name: genre,
                created: timeNow(),
                updated: timeNow()
            });
        }
    }

    if(batch_insert.length) {
        await batchInsert('music_spotify_genres', batch_insert)
    }

    console.log({
        added: batch_insert.length
    });
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
        }
    })();
}
