const axios = require('axios');
const dayjs = require('dayjs');
const { loadScriptEnv, timeNow, generateToken, sleep } = require('../../services/shared');
const dbService = require('../../services/db');
const cacheService = require('../../services/cache');
const { getProcess, keys: systemKeys, saveProcess } = require('../../services/system');


loadScriptEnv();

let startYear = 1940;
let wholeYearProcessThru = 2020;

const MAX_PAGES = 500;
const BATCH_SIZE = 100;
const CONCURRENT_REQUESTS = 40;

let tables = {
    shows: 'tv_shows',
    genres: 'tv_genres',
    shows_genres: 'tv_shows_genres'
}

let shows_dict = {};
let genres_dict = {};
let shows_genres_dict = {};

let added = {
    shows: 0,
    genres: 0,
    shows_genres: 0
};

let updated = {
    shows: 0,
    genres: 0
};

let lastProcessedDate = null;
let lastAirDate = null;

async function loadSystemProcess() {
    lastProcessedDate = await getProcess(systemKeys.tv.date);
}

async function loadData() {
    await loadSystemProcess();

    try {
        let conn = await dbService.conn();

        const shows = await conn(tables.shows);

        for (const show of shows) {
            shows_dict[show.tmdb_id] = show;
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

async function addShowsGenres(items) {
    let batch_genres = [];

    for(let show of items) {
        let show_genres = shows_genres_dict[show.tmdb_id];

        if(show_genres?.length) {
            for(let tmdb_genre_id of show_genres) {
                let dbGenre = genres_dict[tmdb_genre_id];

                if(dbGenre) {
                    batch_genres.push({
                        show_id: show.id,
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
            await dbService.batchInsert(tables.shows_genres, batch_genres);
            added.shows_genres += batch_genres.length;
        } catch(e) {
            console.error(e);
        }
    }
}

async function processDateRange(dateRange) {
    if (lastProcessedDate) {
        const lastDate = new Date(lastProcessedDate);
        lastDate.setMonth(lastDate.getMonth() - 3);
        let lastDateStr = lastDate.toISOString().split('T')[0];
        if(dateRange.end < lastDateStr) {
            return;
        }
    }

    let current_page = 1;
    let hasMorePages = true;

    async function processPage(page) {
        const url = `https://api.themoviedb.org/3/discover/tv?include_adult=false&language=en-US&page=${page}&sort_by=popularity.desc&first_air_date.gte=${dateRange.start}&first_air_date.lte=${dateRange.end}`;

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

            for (const show of results) {
                if (!show.first_air_date) continue;

                if (!lastAirDate || show.first_air_date > lastAirDate) {
                    lastAirDate = show.first_air_date;
                }

                shows_genres_dict[show.id] = Array.from(new Set(show.genre_ids));

                const yearFrom = new Date(show.first_air_date).getFullYear().toString();
                const existing = shows_dict[show.id];

                if (!existing) {
                    let newShow = {
                        tmdb_id: show.id,
                        tmdb_poster_path: show.poster_path,
                        token: generateToken(10),
                        name: show.name,
                        original_language: show.original_language,
                        first_air_date: show.first_air_date,
                        year_from: yearFrom,
                        year_to: null,
                        popularity: show.popularity,
                        vote_average: show.vote_average,
                        vote_count: show.vote_count,
                        created: timeNow(),
                        updated: timeNow(),
                    };

                    pageBatchInsert.push(newShow);
                    shows_dict[show.id] = newShow;
                    pageAdded++;
                } else if (show.popularity !== existing.popularity ||
                    show.vote_average !== existing.vote_average ||
                    show.vote_count !== existing.vote_count) {

                    if (!existing.id) continue;

                    pageBatchUpdate.push({
                        id: existing.id,
                        popularity: show.popularity,
                        vote_average: show.vote_average,
                        vote_count: show.vote_count,
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
            pagePromises.push(processPage(page));
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
                    await dbService.batchInsert(tables.shows, batchInsert, true);
                    await addShowsGenres(batchInsert);
                    batchInsert = [];
                }

                if (batchUpdate.length >= BATCH_SIZE) {
                    await dbService.batchUpdate(tables.shows, batchUpdate);
                    batchUpdate = [];
                }
            }

            // Handle any remaining items in batches
            if (batchInsert.length > 0) {
                await dbService.batchInsert(tables.shows, batchInsert, true);
                await addShowsGenres(batchInsert);
            }

            if (batchUpdate.length > 0) {
                await dbService.batchUpdate(tables.shows, batchUpdate);
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
            added.shows += result.added;
            updated.shows += result.updated;

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

    if (lastAirDate) {
        await saveProcess(systemKeys.tv.date, lastAirDate);
    }
}

async function addShows() {
    console.log('Add TV shows');

    try {
        const currentYear = new Date().getFullYear();

        if (lastProcessedDate) {
            const lastDate = new Date(lastProcessedDate);
            lastDate.setMonth(lastDate.getMonth() - 1);
            startYear = lastDate.getFullYear();
        }

        for (let year = startYear; year <= currentYear; year++) {
            console.log(`Processing year ${year}`);

            let dateRange;

            if (year < wholeYearProcessThru) {
                dateRange = {
                    start: `${year}-01-01`,
                    end: `${year}-12-31`
                };
                await processDateRange(dateRange);
            } else {
                const months = getMonthRanges(year);
                for (const month of months) {
                    await processDateRange(month);
                }
            }
        }

        console.log({ added, updated });
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function addShowDetails() {
    const parseDate = (dateStr) => {
        return dateStr ? new Date(dateStr).getTime() : -Infinity;
    };

    const sortSeasons = (a, b) => {
        // Primary sort: air_date (nulls last)
        const dateA = parseDate(a.air_date);
        const dateB = parseDate(b.air_date);
        if (dateA !== dateB) {
            return dateB - dateA;
        }

        // Secondary sort: season_number (descending)
        if (a.season_number !== b.season_number) {
            return b.season_number - a.season_number;
        }

        // Tertiary sort: name (descending)
        return b.name.localeCompare(a.name);
    };

    try {
        let conn = await dbService.conn();

        let shows_to_process = await conn(tables.shows)
            .whereNull('is_ended')
            .whereNull('year_to');

        for (let i = 0; i < shows_to_process.length; i += CONCURRENT_REQUESTS) {
            const batch = shows_to_process.slice(i, i + CONCURRENT_REQUESTS);
            let batch_update_shows = [];

            const promises = batch.map(async (show) => {
                try {
                    const response = await axios.get(`https://api.themoviedb.org/3/tv/${show.tmdb_id}`, {
                        headers: {
                            accept: 'application/json',
                            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                        }
                    });

                    let data = response.data;

                    let networks = data.networks?.map((item) => {
                        return item.name;
                    });

                    let origin_country = data.origin_country?.[0] || null;
                    let season_count = data.number_of_seasons || null;
                    let episode_count = data.number_of_episodes || null;
                    let last_air_date = data.last_air_date;
                    let year_to = last_air_date?.substring(0, 4) || null;

                    //in case of large diff between last air date and last season,
                    //use last season's date

                    if(data.seasons?.length) {
                        data.seasons.sort(sortSeasons);

                        let last_season = data.seasons[0];

                        let years_diff = dayjs(last_air_date).diff(last_season.air_date, 'years');

                        if(Math.abs(years_diff) > 0) {
                            year_to = last_season.air_date.substring(0, 4);
                        }
                    }

                    batch_update_shows.push({
                        id: show.id,
                        networks: networks?.length ? JSON.stringify(networks) : null,
                        origin_country: origin_country,
                        year_to: year_to || null,
                        is_ended: data.status.toLowerCase() === 'ended' ? true : null,
                        season_count: season_count,
                        episode_count: episode_count,
                        updated: timeNow()
                    });
                } catch (e) {
                    if(e?.status === 429) {
                        console.log("Rate limited: wait a few moments");

                        await sleep(10000);
                    }

                    if(e?.status === 404) {
                        // Handle 404
                    }
                    console.error(`Error processing show ${show.tmdb_id}:`, e.message);
                }
            });

            await Promise.all(promises);

            if (batch_update_shows.length) {
                await dbService.batchUpdate(tables.shows, batch_update_shows);
            }

            console.log(
                `Processed ${i + batch.length}/${shows_to_process.length} shows`,
            );

            // Add delay between batches
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch(e) {
        console.error(e);
    }
}

async function addGenres() {
    console.log('Add TV genres');

    let batch_insert = [];

    try {
        const response = await axios.get('https://api.themoviedb.org/3/genre/tv/list', {
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

                added.genres++;
            }
        }

        if (batch_insert.length) {
            await dbService.batchInsert(tables.genres, batch_insert);
        }

        console.log({ added, updated });
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
    let ts = timeNow();

    try {
        console.log('Process TV shows');
        await cacheService.init();

        await loadData();
        await addGenres();
        // await addShows();
        await addShowDetails();
    } catch (error) {
        console.error('Error in main execution:', error);
        throw error;
    }

    console.log({
        processing_time: {
            minutes: (((timeNow() - ts) / 1000) / 60).toFixed(2),
            seconds: (((timeNow() - ts) / 1000)).toFixed(1)
        }
    });
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