const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv, sleep } = require('../../../services/shared');
const { batchInsert, batchUpdate } = require('../../../services/db');
const { genreMap } = require('../genres_map');
loadScriptEnv();

const axios = require('axios');

let tokens = {
    input: 0,
    cache_input: 0,
    cache_read_input: 0,
    output: 0
};

async function main() {
    const genreNames = Object.keys(genreMap);

    const conn = await dbService.conn();
    const genres = await conn('music_genres');
    const spotifyGenres = await conn('music_spotify_genres')
        .where('is_merged', 0);
    const genresSpotifyGenres = await conn('music_genres_spotify_genres');

    const genresLookup = genres.reduce((acc, genre) => {
        acc[genre.name] = genre;
        return acc;
    }, {});

    const gsgLookup = genresSpotifyGenres.reduce((acc, genre) => {
        if (!(genre.spotify_genre_id in acc)) {
            acc[genre.spotify_genre_id] = {};
        }
        acc[genre.spotify_genre_id][genre.genre_id] = genre;
        return acc;
    }, {});

    const unprocessedGenres = spotifyGenres.filter(spotifyGenre => !(spotifyGenre.id in gsgLookup));

    for (let i = 0; i < unprocessedGenres.length; ++i) {
        console.log(`${i + 1}/${unprocessedGenres.length}`);

        let spotifyGenre = unprocessedGenres[i];

        try {
            const response = await axios({
                method: 'post',
                url: 'https://api.anthropic.com/v1/messages',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'prompt-caching-2024-07-31'
                },
                data: {
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1024,
                    system: [
                        {
                            type: 'text',
                            text: `Please match Spotify genre names to generic genre names from the following list: ${JSON.stringify(genreNames)}. Respond with JSON only in format: { names: ['Genre Name'] }`
                        },
                        {
                            type: 'text',
                            text: spotifyGenre.name,
                            cache_control: { type: 'ephemeral' }
                        }
                    ],
                    messages: [
                        {
                            role: 'user',
                            content: `Match this Spotify genre: "${spotifyGenre.name}"`
                        }
                    ]
                }
            });

            tokens.input += response.data.usage.input_tokens;
            tokens.cache_input += response.data.usage.cache_creation_input_tokens;
            tokens.cache_read_input += response.data.usage.cache_read_input_tokens;
            tokens.output += response.data.usage.output_tokens;

            const results = JSON.parse(response.data.content[0].text).names;

            console.log({
                spotifyGenre: spotifyGenre.name,
                output: results
            });

            for (let genre_name of results) {
                const genre = genresLookup[genre_name];

                if (genre) {
                    const exists = gsgLookup?.[spotifyGenre.id]?.[genre.id];

                    if (!exists) {
                        await conn('music_genres_spotify_genres').insert({
                            genre_id: genre.id,
                            spotify_genre_id: spotifyGenre.id,
                            created: timeNow(),
                            updated: timeNow()
                        });
                    }
                }
            }

            console.log({
                tokens,
            });

            await conn('music_spotify_genres')
                .where('id', spotifyGenre.id)
                .update({
                    is_merged: true,
                    updated: timeNow()
                });

        } catch (error) {
            if(error.status === 429) {
                console.log("Wait a moment");

                await sleep(parseInt(error.response.headers['retry-after']) * 60000);
            }
            console.error('Error processing genre:', spotifyGenre.name, error);
            continue;
        }
    }

    console.log({
        tokens
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
