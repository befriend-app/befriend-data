const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
const { batchInsert, batchUpdate } = require('../../../services/db');
const { genreMap } = require('../genres_map');
loadScriptEnv();

const OpenAI = require('openai');

const openai = new OpenAI({
    baseURL: 'https://api.deepinfra.com/v1/openai',
    apiKey: process.env.DEEP_INFRA_KEY,
});

async function main() {
    console.log("Match spotify genres");

    const conn = await dbService.conn();

    let genres = await conn('music_genres');
    let spotifyGenres = await conn('music_spotify_genres')
        .where('is_merged', 0);

    let genresSpotifyGenres = await conn('music_genres_spotify_genres');

    let genresLookup = genres.reduce((acc, genre) => {
        acc[genre.name] = genre;
        return acc;
    }, {});

    let gsgLookup = genresSpotifyGenres.reduce((acc, genre) => {
        if(!(genre.spotify_genre_id in acc)) {
            acc[genre.spotify_genre_id] = {};
        }

        acc[genre.spotify_genre_id][genre.genre_id] = genre;
        return acc;
    }, {});

    let genreNames = Object.keys(genreMap);

    for(let spotifyGenre of spotifyGenres) {
        if(spotifyGenre.id in gsgLookup) {
            continue;
        }

        console.log(spotifyGenre);

        try {
            let prompt = `
            Please match this spotify genre name: "${spotifyGenre.name}" to one or more of these generic genre names: ${JSON.stringify(genreNames)}.
            Your response should be in the following JSON format: {
                names: ['Genre Name']
            }
            
            Return json only, no other explanation.
            `;

            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            });

            let response = completion.choices[0].message.content;
            response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

            const results = JSON.parse(response);

            for(let genre_name of results) {
                let genre = genresLookup[genre_name];

                if(genre) {
                    let exists = gsgLookup?.[spotifyGenre.id]?.[genre.id];

                    if(!exists) {
                        await conn('music_genres_spotify_genres')
                            .insert({
                                genre_id: genre.id,
                                spotify_genre_id: spotifyGenre.id,
                                created: timeNow(),
                                updated: timeNow()
                            });
                    }
                }
            }

            await conn('music_spotify_genres')
                .where('id', spotifyGenre.id)
                .update({
                    is_merged: true,
                    updated: timeNow()
                })

        } catch (error) {
            continue;
        }
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
        }
    })();
}
