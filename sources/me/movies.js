const axios = require('axios');
const { loadScriptEnv, timeNow, generateToken } = require('../../services/shared');
const dbService = require('../../services/db');
const cacheService = require('../../services/cache');
const { getProcess, systemKeys, saveProcess } = require('../../services/system');

loadScriptEnv();

const MAX_PAGES = 500;
const BATCH_SIZE = 100;
const PARALLEL_PROCESS = 10;
const API_DELAY = 250;

let lastReleaseDate = null;

async function loadSystemProcess() {
    lastReleaseDate = await getProcess(systemKeys.movies.date);
}

async function addMovies() {
    console.log('Add movies');

    await loadSystemProcess();

    const main_table = 'movies';
    let added = 0;
    let updated = 0;
    let batch_insert = [];
    let batch_update = [];
    let latestProcessedDate = null;

    try {
        const conn = await dbService.conn();

        // Movies lookup
        const movies_dict = {};
        const movies = await conn(main_table);

        for (const movie of movies) {
            movies_dict[movie.tmdb_id] = movie;
        }

        // Process by year-month ranges
        let startYear = 1900;
        const currentYear = new Date().getFullYear();

        // If we have a last release date, start from one month prior
        if (lastReleaseDate) {
            const lastDate = new Date(lastReleaseDate);
            lastDate.setMonth(lastDate.getMonth() - 1);
            startYear = lastDate.getFullYear();
        }

        for (let year = startYear; year <= currentYear; year++) {
            console.log(`Processing year ${year}`);
            const months = getMonthRanges(year);

            for (const month of months) {
                // Skip if this month is before our last processed date
                if (lastReleaseDate && month.end < lastReleaseDate) {
                    continue;
                }

                let current_page = 1;
                let hasMorePages = true;

                while (hasMorePages) {
                    const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=${current_page}&sort_by=popularity.desc&primary_release_date.gte=${month.start}&primary_release_date.lte=${month.end}`;

                    try {
                        const response = await axios.get(url, {
                            headers: {
                                accept: 'application/json',
                                Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                            },
                        });

                        const { results, total_pages } = response.data;

                        for (const movie of results) {
                            if (!movie.release_date) continue;

                            // Track the latest release date processed
                            if (!latestProcessedDate || movie.release_date > latestProcessedDate) {
                                latestProcessedDate = movie.release_date;
                            }

                            const existing = movies_dict[movie.id];

                            if (!existing) {
                                batch_insert.push({
                                    tmdb_id: movie.id,
                                    tmdb_poster_path: movie.poster_path,
                                    token: generateToken(10),
                                    name: movie.title,
                                    original_language: movie.original_language,
                                    release_date: movie.release_date,
                                    popularity: movie.popularity,
                                    created: timeNow(),
                                    updated: timeNow(),
                                });

                                added++;

                                if (batch_insert.length >= BATCH_SIZE) {
                                    await dbService.batchInsert(main_table, batch_insert);
                                    batch_insert = [];
                                }
                            } else if (movie.popularity !== existing.popularity) {
                                batch_update.push({
                                    id: existing.id,
                                    popularity: movie.popularity,
                                    updated: timeNow(),
                                });

                                updated++;

                                if (batch_update.length >= BATCH_SIZE) {
                                    await dbService.batchUpdate(main_table, batch_update);
                                    batch_update = [];
                                }
                            }
                        }

                        console.log(
                            `Processed page ${current_page}/${total_pages} for date range ${month.start} to ${month.end}`,
                            { added, updated },
                        );

                        current_page++;
                        hasMorePages = current_page <= Math.min(total_pages, MAX_PAGES);

                        // Add delay to avoid rate limiting
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    } catch (e) {
                        console.error(
                            `Error fetching page ${current_page} for dates ${month.start}-${month.end}:`,
                            e.message,
                        );
                        await new Promise((resolve) => setTimeout(resolve, 5000));
                    }
                }
            }

            // Process remaining batches
            if (batch_insert.length) {
                await dbService.batchInsert(main_table, batch_insert);
                batch_insert = [];
            }

            if (batch_update.length) {
                await dbService.batchUpdate(main_table, batch_update);
                batch_update = [];
            }

            // Update the last processed date
            if (latestProcessedDate) {
                await saveProcess(systemKeys.movies.date, latestProcessedDate);
            }
        }

        console.log({ added, updated });
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function addGenres() {
    console.log('Add genres');

    const main_table = 'movie_genres';
    let added = 0;
    let updated = 0;
    let batch_insert = [];

    try {
        const conn = await dbService.conn();

        // Existing genres lookup
        const genres_dict = {};
        const genres = await conn(main_table);

        for (const genre of genres) {
            genres_dict[genre.tmdb_id] = genre;
        }

        // Fetch all genres from TMDB
        const response = await axios.get('https://api.themoviedb.org/3/genre/movie/list', {
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
            },
        });

        for (const genre of response.data.genres) {
            const existing = genres_dict[genre.id];

            if (!existing) {
                batch_insert.push({
                    tmdb_id: genre.id,
                    token: generateToken(10),
                    name: genre.name,
                    created: timeNow(),
                    updated: timeNow(),
                });
                added++;
            }
        }

        if (batch_insert.length) {
            await dbService.batchInsert(main_table, batch_insert);
        }

        console.log({ added, updated });
    } catch (e) {
        console.error('Error syncing genres:', e);
        throw e;
    }
}

async function addMovieGenres() {
    console.log('Add movie genres');

    const main_table = 'movies_genres';
    let added = 0;
    let batch_insert = [];
    let batch_update_movies = [];

    try {
        const conn = await dbService.conn();

        // Get lookup dictionaries
        const genres = await conn('movie_genres');
        const genres_dict = genres.reduce((acc, g) => {
            acc[g.tmdb_id] = g;
            return acc;
        }, {});

        // Get existing associations
        const existing = await conn(main_table);
        const assoc_dict = existing.reduce((acc, a) => {
            if (!acc[a.movie_id]) acc[a.movie_id] = {};
            acc[a.movie_id][a.genre_id] = true;
            return acc;
        }, {});

        // Get all movies
        const movies_to_process = await conn('movies').where('genre_processed', 0);

        console.log({
            movies_genre_process: movies_to_process.length,
        });

        // Process movies in parallel batches
        for (let i = 0; i < movies_to_process.length; i += PARALLEL_PROCESS) {
            const batch = movies_to_process.slice(i, i + PARALLEL_PROCESS);

            const promises = batch.map(async (movie) => {
                try {
                    const response = await axios.get(
                        `https://api.themoviedb.org/3/movie/${movie.tmdb_id}`,
                        {
                            headers: {
                                accept: 'application/json',
                                Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                            },
                        },
                    );

                    batch_update_movies.push({
                        id: movie.id,
                        genre_processed: true,
                        updated: timeNow(),
                    });

                    const inserts = [];
                    for (const genre of response.data.genres) {
                        const genre_record = genres_dict[genre.id];
                        if (!genre_record) continue;

                        if (!assoc_dict[movie.id]?.[genre_record.id]) {
                            let data = {
                                movie_id: movie.id,
                                genre_id: genre_record.id,
                                created: timeNow(),
                                updated: timeNow(),
                            };

                            inserts.push(data);

                            if (!assoc_dict[movie.id]) {
                                assoc_dict[movie.id] = {};
                            }

                            assoc_dict[movie.id][genre_record.id] = data;
                        }
                    }

                    return inserts;
                } catch (e) {
                    console.error(`Error processing movie ${movie.tmdb_id}:`, e.message);
                    return [];
                }
            });

            const results = await Promise.all(promises);

            // Flatten and add to batch_insert
            const new_inserts = results.flat();

            for (let item of new_inserts) {
                batch_insert.push(item);
            }

            added += new_inserts.length;

            if (batch_insert.length >= BATCH_SIZE) {
                await dbService.batchInsert(main_table, batch_insert);
                batch_insert = [];

                if (batch_update_movies.length >= BATCH_SIZE) {
                    await dbService.batchUpdate('movies', batch_update_movies);
                    batch_update_movies = [];
                }
            }

            console.log(
                `Processed ${i + batch.length}/${movies_to_process.length} movies, added ${added} genre associations`,
            );

            // Rate limiting delay between batches
            await new Promise((resolve) => setTimeout(resolve, API_DELAY * PARALLEL_PROCESS));
        }

        // Process remaining batch
        if (batch_insert.length) {
            await dbService.batchInsert(main_table, batch_insert);
        }

        if (batch_update_movies.length) {
            await dbService.batchUpdate('movies', batch_update_movies);
        }

        console.log({ added });
    } catch (e) {
        console.error('Error syncing movie genres:', e);
        throw e;
    }
}

function getMonthRanges(year) {
    const months = [
        { month: 1, days: 31 },
        { month: 2, days: isLeapYear(year) ? 29 : 28 },
        { month: 3, days: 31 },
        { month: 4, days: 30 },
        { month: 5, days: 31 },
        { month: 6, days: 30 },
        { month: 7, days: 31 },
        { month: 8, days: 31 },
        { month: 9, days: 30 },
        { month: 10, days: 31 },
        { month: 11, days: 30 },
        { month: 12, days: 31 },
    ];

    return months.map(({ month, days }) => ({
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-${days}`,
    }));
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

async function main() {
    try {
        console.log('Process movies');
        await cacheService.init();

        // await addGenres();
        // await addMovies();
        await addMovieGenres();
    } catch (error) {
        console.error('Error in main execution:', error);
        throw error;
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
