const axios = require('axios');
const { loadScriptEnv, timeNow, generateToken } = require('../../services/shared');
const dbService = require('../../services/db');
const cacheService = require('../../services/cache');
const { getProcess, keys: systemKeys, saveProcess } = require('../../services/system');

loadScriptEnv();

let startYear = 1890;

const MAX_PAGES = 500;
const BATCH_SIZE = 100;
const CONCURRENT_REQUESTS = 10;

let lastProcessedDate = null;
let lastReleaseDate = null;

let tables = {
    movies: 'movies',
    genres: 'movie_genres',
    movies_genres: 'movies_genres'
}

let movies_dict = {};
let genres_dict = {};
let movies_genres_dict = {};

let added = 0;
let updated = 0;
let movies_genres_added = 0;

let genres_added = 0;

async function loadSystemProcess() {
    lastProcessedDate = await getProcess(systemKeys.movies.date);
}

async function loadData() {
    try {
        await loadSystemProcess();

        let conn = await dbService.conn();

        const movies = await conn(tables.movies);

        for (const m of movies) {
            movies_dict[m.tmdb_id] = m;
        }

        const genres = await conn(tables.genres);

        genres_dict = genres.reduce((acc, g) => {
            acc[g.tmdb_id] = g;
            return acc;
        }, {});
    } catch(e) {
        console.error(e);
    }
}

async function addMoviesGenres(items) {
    //add genres
    let batch_genres = [];

    for(let movie of items) {
        let movie_genres = movies_genres_dict[movie.tmdb_id];

        if(movie_genres?.length) {
            for(let tmdb_genre_id of movie_genres) {
                let dbGenre = genres_dict[tmdb_genre_id];

                if(dbGenre) {
                    batch_genres.push({
                        movie_id: movie.id,
                        genre_id: dbGenre.id,
                        created: timeNow(),
                        updated: timeNow()
                    });
                }
            }
        }
    }

    if (batch_genres.length) {
        try {
            await dbService.batchInsert(tables.movies_genres, batch_genres);
            movies_genres_added += batch_genres.length;
        } catch(e) {
            console.error(e);
        }
    }
}

async function processMonth(month) {
    let current_page = 1;
    let hasMorePages = true;

    async function processPage(page) {
        const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc&primary_release_date.gte=${month.start}&primary_release_date.lte=${month.end}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                },
            });

            const { results, total_pages } = response.data;

            let pageAdded = 0;
            let pageUpdated = 0;
            let pageBatchInsert = [];
            let pageBatchUpdate = [];

            for (const movie of results) {
                if (!movie.release_date) continue;

                if (!lastReleaseDate || movie.release_date > lastReleaseDate) {
                    lastReleaseDate = movie.release_date;
                }

                movies_genres_dict[movie.id] = Array.from(new Set(movie.genre_ids));

                const existing = movies_dict[movie.id];

                if (!existing) {
                    pageBatchInsert.push({
                        tmdb_id: movie.id,
                        tmdb_poster_path: movie.poster_path,
                        token: generateToken(10),
                        name: movie.title,
                        original_language: movie.original_language,
                        release_date: movie.release_date,
                        vote_average: movie.vote_average,
                        vote_count: movie.vote_count,
                        popularity: movie.popularity,
                        created: timeNow(),
                        updated: timeNow(),
                    });

                    pageAdded++;
                } else if (movie.popularity !== existing.popularity
                    || movie.vote_count !== existing.vote_count) {

                    pageBatchUpdate.push({
                        id: existing.id,
                        vote_average: movie.vote_average,
                        vote_count: movie.vote_count,
                        popularity: movie.popularity,
                        updated: timeNow(),
                    });

                    pageUpdated++;
                }
            }

            return {
                page,
                total_pages,
                batchInsert: pageBatchInsert,
                batchUpdate: pageBatchUpdate,
                added: pageAdded,
                updated: pageUpdated
            };

        } catch (e) {
            console.error(`Error processing page ${page}:`, e.message);
            throw e;
        }
    }

    async function processBatch(startPage) {
        const pagePromises = [];

        for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
            const page = startPage + i;
            pagePromises.push(processPage(page, month));
        }

        try {
            const results = await Promise.all(pagePromises);
            let totalPages = 0;
            let batchInsert = [];
            let batchUpdate = [];
            let totalAdded = 0;
            let totalUpdated = 0;

            for (const result of results) {
                totalPages = Math.max(totalPages, result.total_pages);
                batchInsert = [...batchInsert, ...result.batchInsert];
                batchUpdate = [...batchUpdate, ...result.batchUpdate];
                totalAdded += result.added;
                totalUpdated += result.updated;

                if (batchInsert.length >= BATCH_SIZE) {
                    await dbService.batchInsert(tables.movies, batchInsert, true);
                    await addMoviesGenres(batchInsert);
                    batchInsert = [];
                }

                if (batchUpdate.length >= BATCH_SIZE) {
                    await dbService.batchUpdate(tables.movies, batchUpdate);
                    batchUpdate = [];
                }
            }

            // Handle any remaining items in batches
            if (batchInsert.length > 0) {
                await dbService.batchInsert(tables.movies, batchInsert, true);
                await addMoviesGenres(batchInsert);
            }

            if (batchUpdate.length > 0) {
                await dbService.batchUpdate(tables.movies, batchUpdate);
            }

            return {
                totalPages,
                added: totalAdded,
                updated: totalUpdated
            };

        } catch (e) {
            console.error('Error processing batch:', e);
            throw e;
        }
    }

    while (hasMorePages) {
        try {
            const result = await processBatch(current_page);
            added += result.added;
            updated += result.updated;

            console.log(
                `Processed pages ${current_page}-${current_page + CONCURRENT_REQUESTS - 1}/${result.totalPages}`,
                { added, updated }
            );

            current_page += CONCURRENT_REQUESTS;
            hasMorePages = current_page <= Math.min(result.totalPages, MAX_PAGES);

            // Add a small delay between batches to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (e) {
            console.error('Error in main loop:', e);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    if (lastReleaseDate) {
        await saveProcess(systemKeys.movies.date, lastReleaseDate);
    }
}

async function addMovies() {
    console.log('Add movies');

    try {
        // Process by year-month ranges
        const currentYear = new Date().getFullYear();

        // If we have a last release date, start from a few months prior
        if (lastProcessedDate) {
            const lastDate = new Date(lastProcessedDate);
            lastDate.setMonth(lastDate.getMonth() - 3);
            startYear = lastDate.getFullYear();
        }

        for (let year = startYear; year <= currentYear; year++) {
            console.log(`Processing year ${year}`);
            const months = getMonthRanges(year);

            for (const month of months) {
                // Skip if this month is before our last processed date
                if (lastProcessedDate && month.end < lastProcessedDate) {
                    continue;
                }

                console.log({
                    month
                });

                await processMonth(month);
            }
        }

        console.log({ added, updated, movies_genres_added });
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function addGenres() {
    console.log('Add genres');

    let batch_insert = [];

    try {
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
                genres_added++;
            }
        }

        if (batch_insert.length) {
            await dbService.batchInsert(tables.genres, batch_insert);
        }

        console.log({ genres_added });
    } catch (e) {
        console.error('Error syncing genres:', e);
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

        await loadData();
        await addGenres();
        await addMovies();
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
