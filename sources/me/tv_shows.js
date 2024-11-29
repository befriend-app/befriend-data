const axios = require('axios');
const { loadScriptEnv, timeNow, generateToken } = require('../../services/shared');
const dbService = require('../../services/db');
const cacheService = require('../../services/cache');
const { getProcess, keys: systemKeys, saveProcess } = require('../../services/system');

loadScriptEnv();

let startYear = 1940;
let wholeYearProcessThru = 2020;

let tables = {
    shows: 'tv_shows',
    genres: 'tv_genres',
    shows_genres: 'tv_shows_genres'
}

let shows_dict = {};
let genres_dict = {};

const PARALLEL_PROCESS = 1;

const MAX_PAGES = 500;

let added = {
    shows: 0,
    genres: 0,
    shows_genres: 0
};

let updated = {
    shows: 0,
    genres: 0
};

let lastAirDate = null;
let latestProcessedDate = null;

async function loadSystemProcess() {
    lastAirDate = await getProcess(systemKeys.tv.date);
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

async function processShowsForDateRange(dateRange) {
    if (lastAirDate && dateRange.end < lastAirDate) {
        return;
    }

    let batch_insert = [];
    let batch_update = [];
    let batch_genres = [];
    let show_genres_dict = {}; //tmdb id lookup
    let current_page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        const url = `https://api.themoviedb.org/3/discover/tv?include_adult=false&language=en-US&page=${current_page}&sort_by=popularity.desc&first_air_date.gte=${dateRange.start}&first_air_date.lte=${dateRange.end}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                },
            });

            const { results, total_pages } = response.data;

            for (const show of results) {
                if (!show.first_air_date) continue;

                if (!latestProcessedDate || show.first_air_date > latestProcessedDate) {
                    latestProcessedDate = show.first_air_date;
                }

                show_genres_dict[show.id] = Array.from(new Set(show.genre_ids));

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

                    batch_insert.push(newShow);
                } else if (show.popularity !== existing.popularity ||
                    show.vote_average !== existing.vote_average ||
                    show.vote_count !== existing.vote_count) {
                    batch_update.push({
                        id: existing.id,
                        popularity: show.popularity,
                        vote_average: show.vote_average,
                        vote_count: show.vote_count,
                        updated: timeNow(),
                    });
                }
            }

            console.log(
                `Processed page ${current_page}/${total_pages} for date range ${dateRange.start} to ${dateRange.end}`,
                { added: batch_insert.length, updated: batch_update.length },
            );

            current_page++;
            hasMorePages = current_page <= Math.min(total_pages, MAX_PAGES);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (e) {
            console.error(
                `Error fetching page ${current_page} for dates ${dateRange.start}-${dateRange.end}:`,
                e.message,
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    if (batch_insert.length) {
        await dbService.batchInsert(tables.shows, batch_insert, true);

        added.shows += batch_insert.length;

        for(let show of batch_insert) {
            let show_genres = show_genres_dict[show.tmdb_id];

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
            added.shows_genres += batch_genres.length;
            try {
                await dbService.batchInsert(tables.shows_genres, batch_genres);
            } catch(e) {
                console.error(e);
            }
        }
    }

    if (batch_update.length) {
        updated.shows += batch_update.length;

        await dbService.batchUpdate(tables.shows, batch_update);
    }

    if (latestProcessedDate) {
        await saveProcess(systemKeys.tv.date, latestProcessedDate);
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

async function addShows() {
    console.log('Add TV shows');

    try {
        const currentYear = new Date().getFullYear();

        if (lastAirDate) {
            const lastDate = new Date(lastAirDate);
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

                await processShowsForDateRange(dateRange);
            } else {
                const months = getMonthRanges(year);
                for (const month of months) {
                    await processShowsForDateRange(month);
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
    try {
        let conn = await dbService.conn();

        let movies_to_process = await conn(tables.shows)
            .whereNull('is_ended');

        for (let i = 0; i < movies_to_process.length; i += PARALLEL_PROCESS) {
            const batch = movies_to_process.slice(i, i + PARALLEL_PROCESS);

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

                    let year_to = null;

                    if(data.seasons?.length) {
                        data.seasons.sort(function(b, a) {
                            return a.air_date.localeCompare(b.air_date);
                        });

                        year_to = data.seasons[0].substring(0, 4);
                    }

                    batch_update_shows.push({
                        id: show.id,
                        networks: networks ? JSON.stringify(networks) : null,
                        origin_country: origin_country,
                        year_to: year_to,
                        is_ended: false,
                        season_count: season_count,
                        episode_count: episode_count,
                        updated: timeNow()
                    });
                } catch (e) {
                    if(e?.status === 404) {

                    }
                    console.error(`Error processing movie ${show.tmdb_id}:`, e.message);
                }
            });

            await Promise.all(promises);

            if (batch_update_shows.length) {
                await dbService.batchUpdate(tables.shows, batch_update_shows);
            }

            console.log(
                `Processed ${i + batch.length}/${movies_to_process.length} movies, added ${added} genre associations`,
            );
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

async function main() {
    try {
        console.log('Process TV shows');
        await cacheService.init();

        await loadData();
        await addGenres();
        await addShows();
        // await addShowDetails();
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