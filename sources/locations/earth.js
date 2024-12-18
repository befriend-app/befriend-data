const { loadScriptEnv, timeNow, km_per_degree_lat } = require('../../services/shared');
const dbService = require('../../services/db');
loadScriptEnv();

const COORD_PRECISION = 1000;
const GRID_SIZE_KM = 30;
const TABLE_NAME = 'earth_grid';

function kmPerDegreeLon(lat) {
    return Math.cos(lat * Math.PI / 180) * km_per_degree_lat;
}

function standardizeLonStep(lat, gridSizeKm) {
    const kmPerLon = kmPerDegreeLon(lat);
    let lonStep = gridSizeKm / kmPerLon;
    const divisions = Math.max(1, Math.round(360 / lonStep));
    return 360 / divisions;
}

function generateLonCenters(lonStep) {
    const centers = [];
    for (let lon = -180; lon < 180; lon += lonStep) {
        centers.push(Math.round(lon * 1000) / 1000);
    }
    return centers;
}

function calculateSteps(gridSizeKm) {
    const latStep = gridSizeKm / km_per_degree_lat;
    const roundedLatStep = Math.round(latStep * 1000) / 1000;
    const latitudes = [];

    for (let lat = -90; lat <= 90; lat += roundedLatStep) {
        latitudes.push(Math.round(lat * 1000) / 1000);
    }

    return { latStep: roundedLatStep, latitudes };
}

function getKeys(lat, lon) {
    // Get the raw keys first
    const rawLatKey = Math.floor(lat * COORD_PRECISION);
    const rawLonKey = Math.floor(lon * COORD_PRECISION);

    // Floor to nearest 100 for bucket keys
    const latKey = Math.floor(rawLatKey / 100) * 100;
    const lonKey = Math.floor(rawLonKey / 100) * 100;

    return {
        lat_key: latKey,
        lon_key: lonKey
    };
}

function createGridCell(index, lat, lon, gridSizeKm) {
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLon = Math.round(lon * 1000) / 1000;
    const { lat_key, lon_key } = getKeys(roundedLat, roundedLon);
    const now = timeNow();

    return {
        token: `${lat_key}_${lon_key}_${index}`,
        lat_key: lat_key,
        lon_key: lon_key,
        center_lat: roundedLat,
        center_lon: roundedLon,
        grid_size_km: gridSizeKm,
        created: now,
        updated: now,
        deleted: null
    };
}

async function initializeGrid(batchSize = 1000) {
    console.log(`Initializing Earth grid with ${GRID_SIZE_KM}km cells...`);

    const startTime = timeNow();
    let totalCells = 0;
    let cellIndex = 0;

    try {
        const conn = await dbService.conn();

        // Check for existing records
        const existing = await conn(TABLE_NAME)
            .whereNull('deleted')
            .select('token');

        const existingTokens = new Set(existing.map(r => r.token));

        const { latitudes } = calculateSteps(GRID_SIZE_KM);

        let batch = [];

        for (const lat of latitudes) {
            const lonStep = standardizeLonStep(lat, GRID_SIZE_KM);
            const lonCenters = generateLonCenters(lonStep);

            for (const lon of lonCenters) {
                const cell = createGridCell(cellIndex, lat, lon, GRID_SIZE_KM);

                if (!existingTokens.has(cell.token)) {
                    batch.push(cell);

                    if (batch.length >= batchSize) {
                        await conn(TABLE_NAME).insert(batch);
                        totalCells += batch.length;
                        console.log(`Processed ${totalCells.toLocaleString()} cells | Current lat: ${lat.toFixed(2)}°`);
                        batch = [];
                    }
                }

                cellIndex++;
            }
        }

        if (batch.length > 0) {
            await conn(TABLE_NAME).insert(batch);
            totalCells += batch.length;
        }

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`\nCompleted in ${totalTime.toFixed(2)} seconds`);
        console.log(`Inserted ${totalCells.toLocaleString()} new cells`);
        console.log(`Average insertion rate: ${(totalCells / totalTime).toFixed(0)} cells/second`);

    } catch (error) {
        console.error('Error initializing grid:', error);
        throw error;
    }
}

async function main() {
    try {
        await initializeGrid();
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

module.exports = {
    gridSizeKm: GRID_SIZE_KM,
    main: main
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