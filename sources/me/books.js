const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const {
    loadScriptEnv,
    timeNow,
    generateToken,
    createDirectoryIfNotExistsRecursive,
} = require('../../services/shared');
const dbService = require('../../services/db');
const { deleteFile, getFileSize, joinPaths, getRepoRoot } = require('../../services/shared');

loadScriptEnv();

const BATCH_SIZE = 1000;
const DATA_DIR = joinPaths(getRepoRoot(), 'downloads');
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org/data/';

const DATA_FILES = {
    authors: 'ol_dump_authors_latest.txt.gz',
    works: 'ol_dump_works_latest.txt.gz',
};

const GENRE_MAPPINGS = {
    // Fiction
    fiction: 'gen_fiction',
    'general fiction': 'gen_fiction',
    'literary fiction': 'gen_literary',

    // Mystery/Crime
    mystery: 'gen_mystery',
    detective: 'gen_mystery',
    crime: 'gen_mystery',
    thriller: 'gen_thriller',
    suspense: 'gen_thriller',

    // SciFi/Fantasy
    'science fiction': 'gen_scifi',
    'sci-fi': 'gen_scifi',
    fantasy: 'gen_fantasy',
    'high fantasy': 'gen_fantasy',

    // Romance
    romance: 'gen_romance',
    'love stories': 'gen_romance',

    // Horror
    horror: 'gen_horror',
    'ghost stories': 'gen_horror',

    // Historical
    'historical fiction': 'gen_historical',
    history: 'gen_history',

    // Non-fiction categories
    biography: 'gen_biography',
    autobiography: 'gen_biography',
    memoir: 'gen_biography',
    science: 'gen_science',
    technology: 'gen_technology',
    business: 'gen_business',
    economics: 'gen_business',
    'self-help': 'gen_selfhelp',
    philosophy: 'gen_philosophy',
    poetry: 'gen_poetry',
    drama: 'gen_drama',
    art: 'gen_art',
    cooking: 'gen_cooking',
    travel: 'gen_travel',
    religion: 'gen_religion',
    psychology: 'gen_psychology',
    politics: 'gen_politics',
    education: 'gen_education',
    sports: 'gen_sports',
    comics: 'gen_comics',
    'graphic novel': 'gen_comics',
    children: 'gen_childrens',
};

const genres = [
    {
        token: 'gen_fiction',
        name: 'Fiction',
        position: 1,
        is_featured: true,
    },
    {
        token: 'gen_nonfiction',
        name: 'Non-Fiction',
        position: 2,
        is_featured: true,
    },
    {
        token: 'gen_mystery',
        name: 'Mystery & Crime',
        position: 3,
        is_featured: true,
    },
    {
        token: 'gen_scifi',
        name: 'Science Fiction',
        position: 4,
        is_featured: true,
    },
    {
        token: 'gen_fantasy',
        name: 'Fantasy',
        position: 5,
        is_featured: true,
    },
    {
        token: 'gen_romance',
        name: 'Romance',
        position: 6,
        is_featured: true,
    },
    {
        token: 'gen_literary',
        name: 'Literary Fiction',
        position: 7,
        is_featured: true,
    },
    {
        token: 'gen_thriller',
        name: 'Thriller',
        position: 8,
        is_featured: true,
    },
    {
        token: 'gen_horror',
        name: 'Horror',
        position: 9,
        is_featured: true,
    },
    {
        token: 'gen_historical',
        name: 'Historical Fiction',
        position: 10,
        is_featured: true,
    },
    {
        token: 'gen_biography',
        name: 'Biography',
        position: 11,
        is_featured: true,
    },
    {
        token: 'gen_history',
        name: 'History',
        position: 12,
        is_featured: true,
    },
    {
        token: 'gen_science',
        name: 'Science',
        position: 13,
        is_featured: true,
    },
    {
        token: 'gen_technology',
        name: 'Technology',
        position: 14,
        is_featured: true,
    },
    {
        token: 'gen_business',
        name: 'Business & Economics',
        position: 15,
        is_featured: true,
    },
    {
        token: 'gen_selfhelp',
        name: 'Self-Help',
        position: 16,
        is_featured: true,
    },
    {
        token: 'gen_philosophy',
        name: 'Philosophy',
        position: 17,
    },
    {
        token: 'gen_poetry',
        name: 'Poetry',
        position: 18,
    },
    {
        token: 'gen_drama',
        name: 'Drama',
        position: 19,
    },
    {
        token: 'gen_art',
        name: 'Art & Photography',
        position: 20,
    },
    {
        token: 'gen_cooking',
        name: 'Cooking',
        position: 21,
    },
    {
        token: 'gen_travel',
        name: 'Travel',
        position: 22,
    },
    {
        token: 'gen_religion',
        name: 'Religion & Spirituality',
        position: 23,
    },
    {
        token: 'gen_psychology',
        name: 'Psychology',
        position: 24,
    },
    {
        token: 'gen_politics',
        name: 'Politics & Current Events',
        position: 25,
    },
    {
        token: 'gen_education',
        name: 'Education',
        position: 26,
    },
    {
        token: 'gen_sports',
        name: 'Sports & Recreation',
        position: 27,
    },
    {
        token: 'gen_reference',
        name: 'Reference',
        position: 28,
    },
    {
        token: 'gen_comics',
        name: 'Comics & Graphic Novels',
        position: 29,
    },
    {
        token: 'gen_childrens',
        name: `Children's`,
        position: 30,
    },
];

// Track existing data
const state = {
    books: {},
    authors: {},
    genres: {},
    books_authors: {},
    books_genres: {},
    stats: {
        books: { added: 0 },
        authors: { added: 0 },
        genres: { added: 0 },
        relationships: {
            authors: { added: 0 },
            genres: { added: 0 },
        },
    },
};

async function createReadStream(filePath, startLine = 0) {
    const fileStream = fs.createReadStream(filePath).pipe(zlib.createGunzip());
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    // Skip to start line if needed
    let currentLine = 0;
    if (startLine > 0) {
        for await (const line of rl) {
            currentLine++;
            if (currentLine >= startLine) {
                break;
            }
        }
    }

    return { rl, currentLine };
}

function downloadFile(url, destPath) {
    return new Promise(async (resolve, reject) => {
        await createDirectoryIfNotExistsRecursive(path.dirname(destPath));
        const writer = fs.createWriteStream(destPath);

        console.log(`Downloading ${url}`);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let receivedBytes = 0;
        let lastLogTime = Date.now();
        const logInterval = 1000;

        response.data.on('data', (chunk) => {
            receivedBytes += chunk.length;
            const now = Date.now();
            if (now - lastLogTime >= logInterval) {
                const progress = (receivedBytes / totalBytes) * 100;
                console.log(
                    `Progress: ${progress.toFixed(1)}% (${(receivedBytes / 1024 / 1024).toFixed(2)}MB / ${(totalBytes / 1024 / 1024).toFixed(2)}MB)`,
                );
                lastLogTime = now;
            }
        });

        response.data.pipe(writer);

        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function loadExistingData() {
    console.log('Loading existing data...');
    const conn = await dbService.conn();

    let books = await conn('books').select('id', 'ol_id');
    let authors = await conn('authors').select('id', 'ol_id');
    let genres = await conn('book_genres').select('id', 'token');

    // Load into state using for...in
    for (let i in books) {
        let book = books[i];
        state.books[book.ol_id] = book;
    }

    for (let i in authors) {
        let author = authors[i];
        state.authors[author.ol_id] = author;
    }

    for (let i in genres) {
        let genre = genres[i];
        state.genres[genre.token] = genre;
    }

    console.log({
        existing_books: Object.keys(state.books).length,
        existing_authors: Object.keys(state.authors).length,
        existing_genres: Object.keys(state.genres).length,
    });
}

async function checkRemoteFileSize(url) {
    try {
        const response = await axios.head(url);
        return parseInt(response.headers['content-length'], 10);
    } catch (err) {
        console.error(`Error checking remote file size: ${err.message}`);
        return 0;
    }
}

async function downloadDataFiles() {
    for (const [key, filename] of Object.entries(DATA_FILES)) {
        const fileUrl = joinPaths(OPEN_LIBRARY_BASE_URL, filename);
        const filePath = joinPaths(DATA_DIR, filename);

        // Get local and remote file sizes
        const [localSize, remoteSize] = await Promise.all([
            getFileSize(filePath),
            checkRemoteFileSize(fileUrl),
        ]);

        console.log({
            file: filename,
            local_size: localSize ? (localSize / 1024 / 1024).toFixed(2) + 'MB' : null,
            remote_size: (remoteSize / 1024 / 1024).toFixed(2) + 'MB',
        });

        // Download if file doesn't exist or sizes don't match
        if (localSize !== remoteSize) {
            try {
                console.log(`${localSize ? 'Re-Downloading' : 'Downloading'} ${filename}`);
                if (localSize) {
                    await deleteFile(filePath);
                }
                await downloadFile(fileUrl, filePath);

                // Verify downloaded file size
                const newSize = await getFileSize(filePath);

                if (newSize !== remoteSize) {
                    throw new Error(
                        `Size mismatch after download: expected ${remoteSize}, got ${newSize}`,
                    );
                }
            } catch (e) {
                console.error(`Failed to download ${filename}:`, e.message);
                // await deleteFile(filePath);
            }
        } else {
            console.log(`${filename} is up to date`);
        }
    }
}

function normalizeGenre(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function parseLine(line) {
    let [type, key, revision, lastMod, jsonStr] = line.split('\t');
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
        return null;
    }
}

async function insertGenres() {
    console.log('Adding genres...');

    let genreRecords = [];

    for (let genre of genres) {
        if (!(genre.token in state.genres)) {
            genreRecords.push({
                ...genre,
                is_active: true,
                created: timeNow(),
                updated: timeNow(),
            });
        }
    }

    if (genreRecords.length) {
        await dbService.batchInsert('book_genres', genreRecords, true);

        // Update state with inserted genres
        for (let i in genreRecords) {
            state.genres[genreRecords[i].token] = genreRecords[i];
        }
    }

    state.stats.genres.added = genreRecords.length;

    console.log(`Added ${genreRecords.length} genres`);
}

function mapSubjectsToGenres(subjects, debug = false) {
    let genreTokens = new Set();
    let unmatchedSubjects = new Set();

    for (let subject of subjects) {
        let normalizedSubject = subject.toLowerCase();
        let matched = false;

        if (GENRE_MAPPINGS[normalizedSubject]) {
            genreTokens.add(GENRE_MAPPINGS[normalizedSubject]);
            matched = true;
        } else {
            for (let key in GENRE_MAPPINGS) {
                if (normalizedSubject.includes(key)) {
                    genreTokens.add(GENRE_MAPPINGS[key]);
                    matched = true;
                    break;
                }
            }
        }

        if (!matched && debug) {
            unmatchedSubjects.add(subject);
        }
    }

    if (debug && unmatchedSubjects.size > 0) {
        console.log('Unmatched subjects:', Array.from(unmatchedSubjects));
    }

    return Array.from(genreTokens);
}

async function processAuthors() {
    let batch = [];

    let filePath = joinPaths(DATA_DIR, DATA_FILES.authors);

    let { rl, currentLine } = await createReadStream(filePath, 7870000);

    for await (let line of rl) {
        currentLine++;

        try {
            if (currentLine % 10000 === 0) {
                console.log(`Processed ${currentLine} author lines...`);
            }

            let data = parseLine(line);
            if (!data || !data.key || !data.name) continue;

            let ol_id = data.key.replace('/authors/', '');
            if (state.authors[ol_id]) continue;

            let author = {
                ol_id,
                token: generateToken(10),
                name: data.name.substring(0, 255),
                birth_date: data.birth_date || null,
                death_date: data.death_date || null,
                last_modified: data.last_modified?.value || null,
                is_active: true,
                created: timeNow(),
                updated: timeNow(),
            };

            if (author.birth_date?.length > 30) {
                author.birth_date = null;
            }

            if (author.death_date?.length > 30) {
                author.death_date = null;
            }

            batch.push(author);

            if (batch.length >= BATCH_SIZE) {
                await dbService.batchInsert('authors', batch, true);
                for (let i in batch) {
                    state.authors[batch[i].ol_id] = batch[i];
                }
                state.stats.authors.added += batch.length;
                batch = [];
            }
        } catch (e) {
            console.error('Error processing author:', e.message);
        }
    }

    if (batch.length > 0) {
        let ids = await dbService.batchInsert('authors', batch, true);
        for (let i in batch) {
            state.authors[batch[i].ol_id] = { ...batch[i], id: ids[i] };
        }
        state.stats.authors.added += batch.length;
    }
}

async function processBooks() {
    let batch = [];
    let filePath = joinPaths(DATA_DIR, DATA_FILES.works);

    let { rl, currentLine } = await createReadStream(filePath, 0);

    for await (let line of rl) {
        try {
            currentLine++;
            if (currentLine % 10000 === 0) {
                console.log(`Processed ${currentLine} book lines...`);
            }

            let data = parseLine(line);
            if (!data || !data.key || !data.title) continue;

            let ol_id = data.key.replace('/works/', '');
            if (state.books[ol_id]) continue;

            let ratingSum = null;
            let ratingCount = null;

            if (data.ratings) {
                ratingCount = data.ratings.count || null;
                ratingSum = data.ratings.sum || null;
            }

            let book = {
                ol_id,
                token: generateToken(10),
                title: data.title.substring(0, 255),
                description: data.description?.value || data.description || null,
                first_publish_date: data.first_publish_date?.substring(0, 32) || null,
                cover_id: data.covers?.[0]?.toString() || null,
                rating_average: ratingCount > 0 ? ratingSum / ratingCount : null,
                rating_count: ratingCount || null,
                is_active: true,
                created: timeNow(),
                updated: timeNow(),
            };

            if (book.description) {
                book.description = book.description.substring(0, 60000);
            }

            batch.push({ book, subjects: data.subjects || [], authors: data.authors || [] });

            if (batch.length >= BATCH_SIZE) {
                await processBooksBatch(batch);
                batch = [];
            }
        } catch (e) {
            console.error('Error processing book:', e.message);
        }
    }

    if (batch.length > 0) {
        await processBooksBatch(batch);
    }
}

async function processBooksBatch(batch) {
    let bookRecords = batch.map((item) => item.book);
    await dbService.batchInsert('books', bookRecords, true);

    let authorRelations = [];
    let genreRelations = [];

    for (let i in batch) {
        let { book, subjects, authors } = batch[i];
        state.books[book.ol_id] = {
            id: book.id,
            ol_id: book.ol_id,
        };

        // Map subjects to our predefined genres
        if (subjects && subjects.length) {
            let matchedGenres = mapSubjectsToGenres(subjects);
            for (let token of matchedGenres) {
                let genre = state.genres[token];

                if (genre?.id) {
                    if (!state.books_genres[book.ol_id]) {
                        state.books_genres[book.ol_id] = {};
                    }

                    if (!state.books_genres[book.ol_id][genre.id]) {
                        let data = {
                            book_id: bookRecords[i].id,
                            genre_id: genre.id,
                            created: timeNow(),
                            updated: timeNow(),
                        };

                        state.books_genres[book.ol_id][genre.id] = true;
                        genreRelations.push(data);
                    }
                }
            }
        }

        // Process authors for this book
        if (authors && authors.length) {
            for (let authorRef of authors) {
                let ol_id = authorRef.author?.key?.replace('/authors/', '');
                if (!ol_id) continue;

                let author = state.authors[ol_id];

                if (author?.id) {
                    if (!state.books_authors[book.ol_id]) {
                        state.books_authors[book.ol_id] = {};
                    }

                    if (!state.books_authors[book.ol_id][ol_id]) {
                        let data = {
                            book_id: bookRecords[i].id,
                            author_id: author.id,
                            created: timeNow(),
                            updated: timeNow(),
                        };

                        state.books_authors[book.ol_id][ol_id] = true;
                        authorRelations.push(data);
                    }
                }
            }
        }
    }

    // Insert relationships in parallel if we have any
    if (authorRelations.length || genreRelations.length) {
        await Promise.all([
            authorRelations.length && dbService.batchInsert('books_authors', authorRelations, true),
            genreRelations.length && dbService.batchInsert('books_genres', genreRelations, true),
        ]);

        state.stats.relationships.authors.added += authorRelations.length;
        state.stats.relationships.genres.added += genreRelations.length;
    }

    state.stats.books.added += bookRecords.length;
}

async function main() {
    const startTime = timeNow();

    try {
        console.log('Starting Open Library data import');
        await loadExistingData();
        // await downloadDataFiles();

        // Add predefined genres first
        await insertGenres();

        console.log('Processing authors...');
        // await processAuthors();

        console.log('Processing books...');
        await processBooks();

        console.log('Import completed:', {
            stats: state.stats,
            processing_time_minutes: ((timeNow() - startTime) / 1000 / 60).toFixed(2),
        });
    } catch (error) {
        console.error('Error in main execution:', error);
        throw error;
    }
}

module.exports = { main };

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
