const dbService = require('../../services/db');
const {
    loadScriptEnv,
    timeNow,
    getDistanceMeters,
    getDistanceMiles,
    isNumeric,
    protectedNames,
} = require('../../services/shared');
loadScriptEnv();

const Fuse = require('fuse.js');
const OpenAI = require('openai');

const openai = new OpenAI({
    baseURL: 'https://api.deepinfra.com/v1/openai',
    apiKey: process.env.DEEP_INFRA_KEY,
});

const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_KEY,
});

let countries_dict = {};
let states_dict = {};
let cities_dict = {};

let countries_schools = {};

let batchSize = 50;
let concurrentBatches = 70;

function getCountries() {
    return new Promise(async (resolve, reject) => {
        console.log('Get countries');

        try {
            let conn = await dbService.conn();

            let countries = await conn('open_countries');

            for (let country of countries) {
                countries_dict[country.id] = country;
            }
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

function getStates() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Get states');

            let conn = await dbService.conn();

            let states = await conn('open_states');

            for (let state of states) {
                if (!(state.country_id in states_dict)) {
                    states_dict[state.country_id] = {};
                }

                states_dict[state.country_id][state.id] = state;
            }
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

function getCities() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Get cities');

            let conn = await dbService.conn();

            let cities = await conn('open_cities').select(
                'id',
                'country_id',
                'state_id',
                'city_name',
                'lat',
                'lon',
            );

            for (let city of cities) {
                if (!(city.country_id in cities_dict)) {
                    cities_dict[city.country_id] = [];
                }

                cities_dict[city.country_id].push(city);
            }
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

async function cityFirstOrCreate(city_name, state_name, country, coords) {
    if (!city_name) {
        return;
    }

    let country_cities = cities_dict[country.id];

    let cityLower = city_name.toLowerCase().trim();

    let matches = [];

    if (!country_cities) {
        country_cities = cities_dict[country.id] = [];
    }

    for (let city of country_cities) {
        if (city.city_name.toLowerCase().includes(cityLower)) {
            matches.push(city);
        }
    }

    if (matches.length === 1) {
        return matches[0];
    }

    if (!matches.length) {
        console.log(`Inserting city for ${country.country_name}: ${city_name}`);

        let conn = await dbService.conn();

        let state = await stateFirstOrCreate(state_name, country);

        let insert_data = {
            country_id: country.id,
            state_id: state?.id || null,
            city_name: city_name,
            created: timeNow(),
            updated: timeNow(),
        };

        let [id] = await conn('open_cities').insert(insert_data);

        insert_data.id = id;

        cities_dict[country.id].push(insert_data);

        return insert_data;
    } else {
        for (let m of matches) {
            m.distance = getDistanceMeters(coords, m);
        }

        matches.sort((a, b) => {
            return a.distance - b.distance;
        });

        return matches[0];
    }
}

async function stateFirstOrCreate(state_name, country) {
    if (!state_name) {
        return null;
    }

    let country_states = states_dict[country.id];

    if (!country_states) {
        country_states = states_dict[country.id] = {};
    }

    let stateLower = state_name.toLowerCase();

    for (let state_id in country_states) {
        let state = country_states[state_id];

        if (state.state_name.toLowerCase() === stateLower) {
            return state;
        }
    }

    for (let state_id in country_states) {
        let state = country_states[state_id];

        if (state.state_short?.toLowerCase() === stateLower) {
            return state;
        }
    }

    let conn = await dbService.conn();

    console.log('Adding state: ' + state_name, country.country_name);

    let insert_data = {
        country_id: country.id,
        state_name: state_name,
        created: timeNow(),
        updated: timeNow(),
    };

    [id] = await conn('open_states').insert(insert_data);

    insert_data.id = id;

    country_states[id] = insert_data;

    return insert_data;
}

async function processSchoolBatch(schools, country) {
    let batch_update = [];

    const schoolsList = schools
        .map(
            (s) =>
                `{"id":${s.id},"name":"${s.name.replace(/"/g, '\\"')}","lat":${s.lat},"lon":${s.lon}}`,
        )
        .join(',');

    const prompt = `For the following schools in ${country.country_name}, please provide accurate city, state, estimated student count, and official common name information. Return ONLY the JSON object with no additional text or explanation: Do not abbreviate names. Use these properties id: i, city: c, state: s, common_name: cn, student_count: sc.
    [${schoolsList}]`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        });

        let response = completion.choices[0].message.content;

        // Handle potential text before/after JSON
        response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

        const results = JSON.parse(response);

        for (let r of results) {
            r.cn = r.cn ? r.cn.trim() : '';

            if (!r.cn) {
                continue;
            }

            //lookup city/state
            let state;

            let school = countries_schools[country.id].find((s) => s.id === r.i);

            if (!school) {
                continue;
            }

            let city = await cityFirstOrCreate(r.c, r.s, country, {
                lat: school.lat,
                lon: school.lon,
            });

            if (!city || !city.state_id) {
                state = await stateFirstOrCreate(r.s, country);
            }

            let update_data = {
                id: r.i,
                city_id: city?.id || null,
                state_id: city?.state_id || state?.id || null,
                name: r.cn,
                student_count: isNumeric(r.sc) ? r.sc : null,
                location_processed: true,
                updated: timeNow(),
            };

            for (let k in school) {
                if (!(k in update_data)) {
                    update_data[k] = school[k];
                }
            }

            batch_update.push(update_data);
        }

        await dbService.batchUpdate('schools', batch_update, 'id');
    } catch (error) {
        console.error('Error processing batch:', error);
    }
}

async function processBatchesInParallel(batches, country) {
    for (let i = 0; i < batches.length; i += concurrentBatches) {
        const currentBatches = batches.slice(i, i + concurrentBatches);
        const batchPromises = currentBatches.map((batch) => processSchoolBatch(batch, country));

        console.log(`Batch ${i}/${batches.length}`);

        try {
            await Promise.all(batchPromises);

            // Add delay between concurrent batch sets
            if (i + concurrentBatches < batches.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error('Error processing parallel batches:', error);
        }
    }
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

async function setSchoolLatLon() {
    console.log('Set school lat/lon');

    let parallel = 20;
    let conn;

    async function processParallel(items, country) {
        const schoolsList = items
            .map((s) => `{"id":${s.id},"name":"${s.name.replace(/"/g, '\\"')}"}`)
            .join(',');

        const prompt = `For the following schools in ${country.country_name}, provide latitude/longitude coordinates ONLY for educational institutions. Mark as nv (not valid) if the name matches any of these cases:

1. After-school learning centers (e.g. Kumon, Mathnasium, Sylvan)
2. Test prep centers or tutoring businesses
3. Random characters or numbers
4. Franchise educational businesses
5. Names that are clearly not schools (businesses, organizations, etc)
6. Names too vague to be a real institution

Return ONLY a JSON array with objects having: id, lat, lon, nv (optional boolean).

[${schoolsList}]`;

        try {
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            });

            let response = completion.choices[0].message.content;

            // Extract JSON array from response
            response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

            const results = JSON.parse(response);

            for (let r of results) {
                await conn('schools')
                    .where('id', r.id)
                    .update({
                        id: r.id,
                        lat: r.lat || null,
                        lon: r.lon || null,
                        lat_null_processed: true,
                        updated: timeNow(),
                        deleted: r.nv ? timeNow() : null,
                    });
            }
        } catch (error) {
            console.error('Error processing school locations:', error);
        }
    }

    try {
        conn = await dbService.conn();

        let schools = await conn('schools')
            .whereNull('deleted')
            .where('lat_null_processed', 0)
            .where(function () {
                this.whereNull('lat').orWhereNull('lon');
            });

        console.log({
            schools_to_check: schools.length,
        });

        let countries = {};

        for (let s of schools) {
            if (!(s.country_id in countries)) {
                countries[s.country_id] = [];
            }

            countries[s.country_id].push(s);
        }

        let country_ids = Object.keys(countries);

        for (let i = 0; i < country_ids.length; i += 10) {
            const country_id_batch = country_ids.slice(i, i + 10);

            // Process each country in the batch in parallel
            const countryPromises = country_id_batch.map(async (country_id) => {
                const country = countries_dict[country_id];
                const schools = countries[country_id];

                console.log({
                    country: country.country_name,
                    schoolCount: schools.length,
                });

                // Split schools into batches
                const batches = chunkArray(schools, batchSize);

                // Process school batches with parallel execution
                for (let j = 0; j < batches.length; j += parallel) {
                    const currentBatches = batches.slice(j, j + parallel);
                    const batchPromises = currentBatches.map((batch) =>
                        processParallel(batch, country),
                    );

                    try {
                        await Promise.all(batchPromises);
                        console.log(
                            `Completed batches ${j}-${j + parallel}/${batches.length} for ${country.country_name}`,
                        );
                    } catch (error) {
                        console.error(
                            `Error processing batches for ${country.country_name}:`,
                            error,
                        );
                    }
                }
            });

            // Wait for all countries in this batch to complete
            try {
                await Promise.all(countryPromises);
                console.log(`Completed country batch ${i + 10}/${country_ids.length}`);
            } catch (error) {
                console.error('Error processing country batch:', error);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function checkSetInvalidName() {
    console.log('Check set invalid name');

    let parallel = 5;
    let conn;

    async function processParallel(items, country) {
        const schoolsList = items
            .map((s) => `{"id":${s.id},"name":"${s.name.replace(/"/g, '\\"')}"}`)
            .join(',');

        const prompt = `For the following schools in ${country.country_name}, mark as valid if the name is a real school. If valid, return the latitude and longitude for the school. Set as not valid if:

1. After-school learning centers (e.g. Kumon, Mathnasium, Sylvan)
2. Test prep centers or tutoring businesses
3. Random characters or numbers
4. Franchise educational businesses
5. Names that are clearly not schools (businesses, organizations, etc)
6. Names too vague to be a real institution

Return ONLY a JSON array with objects having: id, lat (optional), lon (optional), valid.

[${schoolsList}]`;

        try {
            const completion = await anthropic.messages.create({
                // model: "claude-3-opus-20240229",
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4096,
                temperature: 0.1,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            });

            let response = completion.content[0].text;

            // Extract JSON array from response
            response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

            const results = JSON.parse(response);

            for (let r of results) {
                let update = {
                    lat: r.lat || null,
                    lon: r.lon || null,
                    check_invalid_name: true,
                    updated: timeNow(),
                };

                if (r.valid) {
                    update.deleted = null;
                }

                await conn('schools').where('id', r.id).update(update);
            }
        } catch (error) {
            console.error('Error processing school locations:', error);
        }
    }

    try {
        conn = await dbService.conn();

        let schools = await conn('schools')
            .whereNotNull('deleted')
            .where('lat_null_processed', 1)
            .where('check_invalid_name', 0);

        let countries = {};

        for (let s of schools) {
            if (!(s.country_id in countries)) {
                countries[s.country_id] = [];
            }

            countries[s.country_id].push(s);
        }

        for (let country_id in countries) {
            let country = countries_dict[country_id];
            let schools = countries[country_id];

            console.log({
                country: country.country_name,
            });

            const batches = chunkArray(schools, batchSize);

            for (let i = 0; i < batches.length; i += parallel) {
                const currentBatches = batches.slice(i, i + parallel);

                const batchPromises = currentBatches.map((batch) =>
                    processParallel(batch, country),
                );

                try {
                    await Promise.all(batchPromises);
                    console.log(
                        `Completed batch ${i + 1}/${batches.length} for ${country.country_name}`,
                    );
                } catch (error) {
                    console.error(`Error processing batches for ${country.country_name}:`, error);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function fixDuplicateCities() {
    try {
        console.log('Fix duplicate cities');

        let conn = await dbService.conn();

        let cities = await conn('open_cities')
            .whereNull('deleted')
            .select('id', 'city_name', 'country_id', 'state_id');

        let has_state = {};
        let country_only = {};

        for (let city of cities) {
            if (city.state_id) {
                if (!(city.country_id in has_state)) {
                    has_state[city.country_id] = {};
                }

                if (!(city.state_id in has_state[city.country_id])) {
                    has_state[city.country_id][city.state_id] = {};
                }

                let nameLower = city.city_name.toLowerCase();

                if (!(nameLower in has_state[city.country_id][city.state_id])) {
                    has_state[city.country_id][city.state_id][nameLower] = [];
                }

                has_state[city.country_id][city.state_id][nameLower].push(city);
            } else {
                if (!(city.country_id in country_only)) {
                    country_only[city.country_id] = {};
                }

                let nameLower = city.city_name.toLowerCase();

                if (!(nameLower in country_only[city.country_id])) {
                    country_only[city.country_id][nameLower] = [];
                }

                country_only[city.country_id][nameLower].push(city);
            }
        }

        //has state
        for (let country_id in has_state) {
            let states = has_state[country_id];

            for (let state_id in states) {
                let stateCities = states[state_id];

                for (let name in stateCities) {
                    let cityList = stateCities[name];

                    if (cityList.length > 1) {
                        let useCity = cityList[0];
                        let deleteCities = cityList.slice(1);

                        //update schools
                        await conn('schools')
                            .whereIn(
                                'city_id',
                                deleteCities.map((c) => c.id),
                            )
                            .update({
                                city_id: useCity.id,
                                updated: timeNow(),
                            });

                        //delete duplicate city
                        await conn('open_cities')
                            .whereIn(
                                'id',
                                deleteCities.map((c) => c.id),
                            )
                            .update({
                                updated: timeNow(),
                                deleted: timeNow(),
                            });
                    }
                }
            }
        }

        //country only
        for (let country_id in country_only) {
            let countryCities = country_only[country_id];

            for (let name in countryCities) {
                let cityList = countryCities[name];

                if (cityList.length > 1) {
                    let useCity = cityList[0];
                    let deleteCities = cityList.slice(1);

                    //update schools
                    await conn('schools')
                        .whereIn(
                            'city_id',
                            deleteCities.map((c) => c.id),
                        )
                        .update({
                            city_id: useCity.id,
                            updated: timeNow(),
                        });

                    //delete duplicate city
                    await conn('open_cities')
                        .whereIn(
                            'id',
                            deleteCities.map((c) => c.id),
                        )
                        .update({
                            updated: timeNow(),
                            deleted: timeNow(),
                        });
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function fixCitiesNoLatLon() {
    let conn = await dbService.conn();

    let cities = await conn('open_cities').whereNull('deleted').whereNull('lat');

    console.log({
        cities_without_coords: cities.length,
    });

    let lookup = {};

    for (let city of cities) {
        lookup[city.id] = city;
    }

    let schools = await conn('schools')
        .whereNull('deleted')
        .whereNotNull('lat')
        .whereIn(
            'city_id',
            cities.map((x) => x.id),
        )
        .orderBy('city_id')
        .select('lat', 'lon', 'country_id', 'city_id');

    console.log({
        schools: schools.length,
    });

    let countries = {};

    for (let school of schools) {
        if (!(school.country_id in countries)) {
            countries[school.country_id] = [];
        }

        if (!(school.city_id in countries)) {
            countries[school.country_id][school.city_id] = [];
        }

        countries[school.country_id][school.city_id].push(school);
    }

    let ts = timeNow();
    let updated = 0;

    for (let country_id in countries) {
        let country = countries[country_id];

        for (let city_id in country) {
            let cityList = country[city_id];

            let lat = cityList.reduce((sum, school) => sum + school.lat, 0) / cityList.length;
            let lon = cityList.reduce((sum, school) => sum + school.lon, 0) / cityList.length;

            await conn('open_cities').where('id', city_id).update({
                lat,
                lon,
                updated: timeNow(),
            });

            updated++;

            console.log({
                updated: `${updated}/${cities.length}`,
            });
        }
    }

    let t = timeNow() - ts;
    console.log({
        total_time: t,
        avg: (updated / (t / 1000)).toFixed(1) + '/sec',
    });

    console.log('Fixed cities no lat/lon');
}

async function deleteDuplicateByName() {
    function getDuplicateScore(school) {
        let score = 0;

        //prioritize wd
        if (school.source === 'wd') score += 100;

        if (school.student_count) {
            // Higher student counts get higher scores (normalized to avoid too much weight)
            score += 5 + Math.min(5, Math.log10(school.student_count));
        }

        if (school.state_id) score += 10;
        if (school.city_id) score += 3;

        // Prioritize records that have definitive type information
        if (school.is_college) score += 5;
        if (school.is_high_school) score += 4;
        if (school.is_grade_school) score += 3;

        return score;
    }

    try {
        console.log('Delete duplicate by name');

        let conn = await dbService.conn();

        let schools = await conn('schools')
            .whereNull('deleted')
            .whereNotNull('lat')
            .whereNotNull('lon')
            .select('*');

        let countries = {};

        // Group schools by country and name
        for (let s of schools) {
            if (!(s.country_id in countries)) {
                countries[s.country_id] = {};
            }

            let nameLower = s.name.toLowerCase();

            if (!(nameLower in countries[s.country_id])) {
                countries[s.country_id][nameLower] = [];
            }

            countries[s.country_id][nameLower].push(s);
        }

        for (let country_id in countries) {
            console.log({
                Deduplicating: countries_dict[country_id].country_name,
            });

            let schoolsToDeleteIds = new Set();
            let schools = countries[country_id];

            for (let schoolName in schools) {
                let schoolList = schools[schoolName];

                if (schoolList.length > 1) {
                    // Calculate scores for all schools
                    const scoredSchools = schoolList.map((school) => ({
                        ...school,
                        score: getDuplicateScore(school),
                        processed: false
                    }));

                    // Sort by score descending
                    scoredSchools.sort((a, b) => b.score - a.score);

                    // Keep track of which schools have been processed
                    let processedCount = 0;

                    while (processedCount < scoredSchools.length) {
                        // Find the next unprocessed school with highest score
                        const primarySchool = scoredSchools.find(s => !s.processed);
                        if (!primarySchool) break;

                        primarySchool.processed = true;
                        processedCount++;

                        // Create a cluster of schools near this one
                        const cluster = [primarySchool];

                        // Check remaining unprocessed schools against this one
                        for (let compareSchool of scoredSchools) {
                            if (compareSchool.processed) continue;

                            // Check distance against any school in the current cluster
                            let isNearCluster = cluster.some(clusterSchool => {
                                const distance = getDistanceMiles(
                                    {
                                        lat: clusterSchool.lat,
                                        lon: clusterSchool.lon,
                                    },
                                    {
                                        lat: compareSchool.lat,
                                        lon: compareSchool.lon,
                                    }
                                );
                                return distance <= 20;
                            });

                            if (isNearCluster) {
                                cluster.push(compareSchool);
                                compareSchool.processed = true;
                                processedCount++;
                            }
                        }

                        // If we found multiple schools in this cluster, mark all but the highest
                        // scored one for deletion
                        if (cluster.length > 1) {
                            // Sort cluster by score
                            cluster.sort((a, b) => b.score - a.score);

                            //update student count if missing
                            if(!cluster[0].student_count) {
                                const maxStudentCount = Math.max(...cluster.map(s => s.student_count || 0));

                                if(maxStudentCount > 0 ) {
                                    await conn('schools')
                                        .where('id', cluster[0].id)
                                        .update({
                                            student_count: maxStudentCount,
                                            updated: timeNow(),
                                        });
                                }
                            }

                            for (let i = 1; i < cluster.length; i++) {
                                schoolsToDeleteIds.add(cluster[i].id);
                            }
                        }
                    }
                }
            }

            if (schoolsToDeleteIds.size) {
                let delete_count = await conn('schools')
                    .whereIn('id', Array.from(schoolsToDeleteIds))
                    .update({
                        updated: timeNow(),
                        deleted: timeNow(),
                    });

                console.log({
                    Deleted: delete_count,
                });
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function extractJsonFromMarkdown(response) {
    try {
        // Extract content between ```json and ``` tags
        let jsonString = response
            .substring(
                response.indexOf('```json') + 7, // +7 to skip past '```json'
                response.lastIndexOf('```'),
            )
            .trim();

        // Parse the JSON string into an object
        const jsonData = JSON.parse(jsonString);

        return jsonData;
    } catch (error) {
        throw new Error(`Failed to extract or parse JSON: ${error.message}`);
    }
}

async function deleteDuplicateModel() {
    const concurrentCities = 2;
    const processingQueue = [];
    const activeIds = new Set();

    function haveDifferentCities(country_id, ids) {
        let dict = {};
        let ids_str = JSON.stringify(ids);

        for (let city_id of ids) {
            let other_ids = countryCityGroups[country_id][city_id].nearbyCities.map(
                (x) => x.city_id,
            );
            dict[city_id] = [parseInt(city_id)].concat(other_ids);
            dict[city_id].sort();
            dict[city_id] = JSON.stringify(dict[city_id]);
        }

        for (let key in dict) {
            if (dict[key] !== ids_str) {
                return true;
            }
        }

        return false;
    }

    async function processCity(country_id, city_id, city, city_w_nearby_ids) {
        try {
            const schools = await conn('schools')
                .whereNull('deleted')
                .where('school_kept', 0)
                .whereIn('city_id', city_w_nearby_ids)
                .select(
                    'id',
                    'name',
                    'lat',
                    'lon',
                    'is_grade_school',
                    'is_high_school',
                    'is_college',
                );

            if (schools.length > 1) {
                let schoolList = {
                    grade_schools: [],
                    high_schools: [],
                    colleges: [],
                    schools: [],
                };

                for (let school of schools) {
                    let data = {
                        id: school.id,
                        name: school.name,
                        lat: school.lat,
                        lon: school.lon,
                    };

                    if (school.is_grade_school) {
                        schoolList.grade_schools.push(data);
                    } else if (school.is_high_school) {
                        schoolList.grade_schools.push(data);
                    } else if (school.is_college) {
                        schoolList.colleges.push(data);
                    } else {
                        schoolList.schools.push(data);
                    }
                }

                let countryName = countries_dict[country_id].country_name;

                // Your processing logic here
                const prompt = `Please analyze this list of ${countryName} schools and identify groups of duplicates based on name, location proximity, and type of school (i.e. middle school, high school, college). Format the output as a JSON object with two properties:

1. "keep": An array of objects, where each object has:
   - "id":  The primary record to keep (prefer most complete records)
   - "common_name": The most common name school is known as

2. "delete": Array of ids that are duplicates

Example structure:
{
  "keep": [{"id", "common_name"}],
  "delete": ["id"]
}

Input data:
${JSON.stringify(schoolList)}
. Return valid JSON only, do not return any additional explanation.`;

                // const completion = await openai.chat.completions.create({
                //     messages: [{ role: "user", content: prompt }],
                //     model: "meta-llama/Meta-Llama-3.1-405B-Instruct",
                // });
                //
                // let response = completion.choices[0].message.content;
                //
                // let jsonData = extractJsonFromMarkdown(response);

                const completion = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4096,
                    temperature: 0.1,
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                });

                let response = completion.content[0].text;

                let result = JSON.parse(response);

                //update name if needed
                for (let item of result.keep) {
                    let school = schools.find((x) => x.id === item.id);

                    if (!school) {
                        console.error('School not found');
                        continue;
                    }

                    await conn('schools').where('id', item.id).update({
                        school_kept: true,
                        name: item.common_name,
                        updated: timeNow(),
                    });
                }

                //set deleted
                if (result.delete.length) {
                    await conn('schools').whereIn('id', result.delete).update({
                        updated: timeNow(),
                        deleted: timeNow(),
                    });
                }
            }

            // Mark city as processed
            await conn('open_cities').where('id', city_id).update({
                deduplicated_schools: true,
                updated: timeNow(),
            });

            city_w_nearby_ids.forEach((id) => activeIds.delete(id));
        } catch (error) {
            console.error(e);
        }
    }

    async function processNextBatch() {
        while (processingQueue.length > 0 && Array.from(activeIds).length < concurrentCities) {
            const task = processingQueue.find(
                (t) => !t.city_w_nearby_ids.some((id) => activeIds.has(id)),
            );

            if (!task) break;

            // Remove task from queue
            const taskIndex = processingQueue.indexOf(task);
            processingQueue.splice(taskIndex, 1);

            // Add IDs to active set
            task.city_w_nearby_ids.forEach((id) => activeIds.add(id));

            // Process the city
            processCity(task.country_id, task.city_id, task.city, task.city_w_nearby_ids).catch(
                console.error,
            );
        }
    }

    console.log('Remove duplicate schools');

    let countryCityGroups = await groupNearbyCities();
    let conn = await dbService.conn();

    for (let country_id in countryCityGroups) {
        let country = countryCityGroups[country_id];

        console.log({
            country: countries_dict[country_id].country_name,
        });

        for (let city_id in country) {
            let city = country[city_id];

            if (city.deduplicated_schools) {
                continue;
            }

            let city_w_nearby_ids = [parseInt(city_id)].concat(
                city.nearbyCities.map((x) => x.city_id),
            );
            city_w_nearby_ids.sort();

            // let have_diff = haveDifferentCities(country_id, city_w_nearby_ids);

            // Add task to queue
            processingQueue.push({
                country_id,
                city_id,
                city,
                city_w_nearby_ids,
            });

            // Try to process next batch
            await processNextBatch();
        }
    }

    // Wait for remaining tasks to complete
    while (Array.from(activeIds).length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function deleteDuplicateFuzzy() {
    async function processCity(country_id, city_id, city_w_nearby_ids) {
        try {
            const schools = await conn('schools')
                .whereNull('deleted')
                .whereIn('city_id', city_w_nearby_ids)
                .select('id', 'name', 'lat', 'lon');

            const fuse = new Fuse(schools, {
                includeScore: true,
                keys: ['name'],
            });

            for (let school of schools) {
                let output = fuse.search(school.name);

                console.log(output);
            }
        } catch (e) {
            console.error(e);
        }
    }

    console.log('Remove duplicate schools');

    let countryCityGroups = await groupNearbyCities();
    let conn = await dbService.conn();
    let deleted_ids = {};

    for (let country_id in countryCityGroups) {
        let country = countryCityGroups[country_id];

        console.log({
            country: countries_dict[country_id].country_name,
        });

        for (let city_id in country) {
            let city = country[city_id];

            let city_w_nearby_ids = [parseInt(city_id)].concat(
                city.nearbyCities.map((x) => x.city_id),
            );
            city_w_nearby_ids.sort();

            await processCity(country_id, city_id, city_w_nearby_ids);
        }
    }
}

function addSchoolsLocation() {
    console.log('Add schools locations');

    return new Promise(async (resolve, reject) => {
        try {
            let conn = await dbService.conn();

            let schools = await conn('schools')
                // .where('country_id', 987)
                .whereNull('deleted')
                .whereNotNull('lat')
                .whereNotNull('lon')
                .whereNull('city')
                .where('location_processed', false)
                .select('*');

            console.log({
                schools_to_process: schools.length,
            });

            for (let s of schools) {
                if (!(s.country_id in countries_schools)) {
                    countries_schools[s.country_id] = [];
                }

                countries_schools[s.country_id].push(s);
            }

            for (let country_id in countries_schools) {
                let country = countries_dict[country_id];
                let country_schools = countries_schools[country_id];

                console.log({
                    country: country.country_name,
                });

                const country_batches = chunkArray(country_schools, batchSize);

                await processBatchesInParallel(country_batches, country);
            }
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

async function fixNameSpace() {
    let conn = await dbService.conn();

    //cities
    let cities = await conn('open_cities').select('id', 'city_name');

    let update_city = 0;

    for (let city of cities) {
        if (city.city_name.startsWith(' ') || city.city_name.endsWith(' ')) {
            await conn('open_cities').where('id', city.id).update({
                city_name: city.city_name.trim(),
                updated: timeNow(),
            });
            update_city++;
        }
    }

    if (update_city) {
        console.log({
            update_city,
        });
    }

    //schools
    let schools = await conn('schools').select('id', 'name');

    let update_school = 0;

    for (let school of schools) {
        if (school.name.startsWith(' ') || school.name.endsWith(' ')) {
            await conn('schools').where('id', school.id).update({
                name: school.name.trim(),
                updated: timeNow(),
            });

            update_school++;
        }
    }

    if (update_school) {
        console.log({
            update_school,
        });
    }
}

async function fixWrongCities() {
    console.log('Fix wrong cities');

    let city_id_from = 9322102;
    let conn = await dbService.conn();

    let cities = await conn('open_cities')
        .whereNull('deleted')
        .where('name_checked', false)
        .where('id', '>', city_id_from);

    console.log({
        cities_to_check: cities.length,
    });

    let lookup = {};

    for (let city of cities) {
        lookup[city.id] = city;
    }

    let schools = await conn('schools')
        .whereNull('deleted')
        .whereIn(
            'city_id',
            cities.map((x) => x.id),
        )
        .orderBy('city_id');

    console.log({
        schools: schools.length,
    });

    let countries = {};

    for (let school of schools) {
        if (!(school.country_id in countries)) {
            countries[school.country_id] = [];
        }
        countries[school.country_id].push(school);
    }

    const batchSize = 100;
    const concurrentBatches = 10;

    async function processBatch(batch) {
        let schoolList = [];

        for (let item of batch) {
            let city = lookup[item.city_id];
            schoolList.push({
                id: city.id,
                lat: item.lat,
                lon: item.lon,
            });
        }

        schoolList = JSON.stringify(schoolList);

        const prompt = `For the following latitude/longitude coordinates, return the city and state.
        
        Return an array of objects with the following format: {
            id, city, state
        }
        
        Return ONLY valid JSON with no additional text or explanation. Return an array of objects. The count should match the input.
        ${schoolList}
        `;

        try {
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            });

            let response = completion.choices[0].message.content;
            response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

            const results = JSON.parse(response);

            for (let item of results) {
                let city = lookup[item.id];

                if (item.city !== city.city_name) {
                    await conn('open_cities').where('id', item.id).update({
                        name_checked: true,
                        city_name: item.city,
                        updated: timeNow(),
                    });
                } else {
                    await conn('open_cities').where('id', item.id).update({
                        name_checked: true,
                        updated: timeNow(),
                    });
                }
            }

            return batch[batch.length - 1].city_id;
        } catch (error) {
            console.error(`Error processing batch:`, error);
            return null;
        }
    }

    // Process one country at a time
    for (let country_id in countries) {
        console.log({
            country_wrong_city: countries_dict[country_id].country_name,
        });

        let country_schools = countries[country_id];
        let batches = [];

        // Create all batches for this country
        for (let i = 0; i < country_schools.length; i += batchSize) {
            batches.push(country_schools.slice(i, i + batchSize));
        }

        // Process batches in concurrent chunks
        for (let i = 0; i < batches.length; i += concurrentBatches) {
            console.log({
                batch: `${i}/${batches.length}`,
            });

            const currentBatches = batches.slice(i, i + concurrentBatches);
            const batchPromises = currentBatches.map((batch) => processBatch(batch));

            try {
                await Promise.all(batchPromises);
            } catch (error) {
                console.error(`Error processing country ${country_id} batches:`, error);
            }
        }
    }
}

async function missingSchoolType() {
    console.log('Missing school type');

    let conn = await dbService.conn();

    let schools = await conn('schools')
        .whereNull('deleted')
        .where('school_type_checked', 0)
        .where('is_grade_school', 0)
        .where('is_high_school', 0)
        .where('is_college', 0);

    console.log({
        schools: schools.length,
    });

    let countries = {};

    for (let school of schools) {
        if (!(school.country_id in countries)) {
            countries[school.country_id] = [];
        }
        countries[school.country_id].push(school);
    }

    const batchSize = 100;
    const concurrentBatches = 70;

    async function processBatch(batch, countryName) {
        let schoolList = [];

        for (let item of batch) {
            schoolList.push({
                id: item.id,
                name: item.name,
                lat: item.lat,
                lon: item.lon,
            });
        }

        schoolList = JSON.stringify(schoolList);

        const prompt = `For the following schools in ${countryName}, return whether the school is a grade school, high school, or college.
        
        Return an array of objects with the following format: {
            id, name, is_grade (optional), is_hs (optional), is_college(optional)
        }
        
        Return ONLY valid JSON with no additional text or explanation. Return an array of objects. The count should match the input.
        ${schoolList}
        `;

        try {
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            });

            let response = completion.choices[0].message.content;

            response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

            const results = JSON.parse(response);

            for (let item of results) {
                await conn('schools').where('id', item.id).update({
                    school_type_checked: true,
                    is_grade_school: !!item.is_grade,
                    is_high_school: !!item.is_hs,
                    is_college: !!item.is_college,
                    updated: timeNow(),
                });
            }
        } catch (error) {
            console.error(`Error processing batch:`, error);
            return null;
        }
    }

    for (let country_id in countries) {
        console.log({
            country_school_type: countries_dict[country_id].country_name,
        });

        let country_schools = countries[country_id];
        let batches = [];

        // Create all batches for this country
        for (let i = 0; i < country_schools.length; i += batchSize) {
            batches.push(country_schools.slice(i, i + batchSize));
        }

        // Process batches in concurrent chunks
        for (let i = 0; i < batches.length; i += concurrentBatches) {
            console.log({
                batch: `${i}/${batches.length}`,
            });

            const currentBatches = batches.slice(i, i + concurrentBatches);
            const batchPromises = currentBatches.map((batch) =>
                processBatch(batch, countries_dict[country_id].country_name),
            );

            try {
                await Promise.all(batchPromises);
            } catch (error) {
                console.error(`Error processing country ${country_id} batches:`, error);
            }
        }
    }
}

async function deleteWNames(countryId) {
    let conn = await dbService.conn();

    let deleted = await conn('schools')
        .whereNull('deleted')
        .whereRaw("name REGEXP '^Q[0-9]+$'")
        .update({
            updated: timeNow(),
            deleted: timeNow(),
        });

    console.log({
        w_names_deleted: deleted,
    });
}

async function updateSchoolTypes() {
    let conn = await dbService.conn();

    // Define patterns for each school type
    const patterns = {
        grade_school: [
            'elementary school',
            'primary school',
            'école primaire',
            'escuela primaria',
            'basic school',
            'lower primary',
            'upper primary',
            'école élémentaire',
            'escola básica',
            'nursery school',
            'government primary',
            'tiểu học',
            'szkoła podstawowa',
            'scuola primaria',
            'grundschule',
            'sd negeri',
            'primaire',
            'elementary',
            'primary',
            'básica',
            'infantil',
        ],
        high_school: [
            'high school',
            'secondary school',
            'middle school',
            'junior high',
            'senior high',
            'higher secondary',
            'escuela secundaria',
            'lycée',
            'secundaria',
            'anadolu lisesi',
            'sma negeri',
            'smp negeri',
            'educación secundaria',
        ],
        college: [
            'university',
            'college',
            'institute of',
            'instituto de',
            'istituto',
            'higher education',
            'university of',
            'faculty of',
            'school of engineering',
            'school of medicine',
            'école supérieure',
            'technical college',
            'polytechnic',
        ],
    };

    // Create regex patterns
    const gradeSchoolPattern = new RegExp(patterns.grade_school.join('|'), 'i');
    const highSchoolPattern = new RegExp(patterns.high_school.join('|'), 'i');
    const collegePattern = new RegExp(patterns.college.join('|'), 'i');

    // Batch processing
    const batchSize = 1000;
    let processedCount = 0;

    try {
        const schools = await conn('schools')
            .whereNull('deleted')
            .where('is_grade_school', 0)
            .where('is_high_school', 0)
            .where('is_college', 0);

        if (schools.length === 0) {
            return;
        }

        console.log(`Starting to process ${schools.length} schools`);

        // Process each school
        const updates = {
            grade_school: [],
            high_school: [],
            college: [],
        };

        for (const school of schools) {
            const name = school.name.toLowerCase();

            if (gradeSchoolPattern.test(name)) {
                updates.grade_school.push(school.id);
            }

            if (highSchoolPattern.test(name)) {
                updates.high_school.push(school.id);
            }

            if (collegePattern.test(name)) {
                updates.college.push(school.id);
            }
        }

        for (let school_type in updates) {
            let schools = updates[school_type];

            console.log({
                school_type,
                count: schools.length,
            });

            for (let i = 0; i < schools.length; i += 500) {
                let ids = schools.slice(i, i + 500);

                let data = {
                    updated: timeNow(),
                };

                data[`is_${school_type}`] = true;

                await conn('schools').whereIn('id', ids).update(data);
            }
        }

        console.log('Updated school types');
    } catch (error) {
        console.error('Error updating school types:', error);
    }
}

async function groupNearbyCities() {
    const distance_threshold = 20; //miles
    const GRID_SIZE = 0.1; // Approximately 7 miles per grid cell

    function getGridKey(lat, lon) {
        // Round to nearest grid cell
        const latGrid = Number((Math.floor(lat / GRID_SIZE) * GRID_SIZE).toFixed(4));
        const lonGrid = Number((Math.floor(lon / GRID_SIZE) * GRID_SIZE).toFixed(4));
        return `${latGrid},${lonGrid}`;
    }

    function getNeighboringGrids(gridKey) {
        const [lat, lon] = gridKey.split(',').map(Number);
        const neighbors = [];

        // Get 9 neighboring cells (including self)
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const neighborLat = Number((lat + i * GRID_SIZE).toFixed(4));
                const neighborLon = Number((lon + j * GRID_SIZE).toFixed(4));
                neighbors.push(`${neighborLat},${neighborLon}`);
            }
        }

        return neighbors;
    }

    try {
        console.log('Group nearby cities');

        let conn = await dbService.conn();

        let cities = await conn('schools AS s')
            .join('open_cities AS oc', 'oc.id', '=', 's.city_id')
            .whereNotNull('city_id')
            .whereNotNull('oc.lat')
            .groupBy('city_id')
            .select('city_id', 'oc.lat', 'oc.lon', 's.country_id', 'deduplicated_schools');

        const cityGroups = {};
        const gridIndex = {};

        // First pass: Create country groups and grid index
        for (let city of cities) {
            // Initialize country if needed
            if (!(city.country_id in cityGroups)) {
                cityGroups[city.country_id] = {};
            }

            // Initialize city in country group
            cityGroups[city.country_id][city.city_id] = {
                ...city,
                nearbyCities: [],
            };

            // Add to grid index
            const gridKey = getGridKey(city.lat, city.lon);

            if (!(city.country_id in gridIndex)) {
                gridIndex[city.country_id] = {};
            }

            if (!(gridKey in gridIndex[city.country_id])) {
                gridIndex[city.country_id][gridKey] = [];
            }

            gridIndex[city.country_id][gridKey].push(city);
        }

        // Second pass: Find nearby cities using grid
        const country_keys = Object.keys(cityGroups);

        for (let i = 0; i < country_keys.length; i++) {
            const country_id = country_keys[i];
            console.log(`${i}/${country_keys.length}`);

            const countryGrids = gridIndex[country_id];
            const cities = cityGroups[country_id];

            console.log({
                country_cities: Object.keys(cities).length,
            });

            // For each city in the country
            for (let city_id in cities) {
                const city = cities[city_id];
                const cityGridKey = getGridKey(city.lat, city.lon);

                // Check neighboring grids
                const neighboringGrids = getNeighboringGrids(cityGridKey);

                for (let neighborGrid of neighboringGrids) {
                    if (countryGrids[neighborGrid]) {
                        // Check each city in the neighboring grid
                        for (let otherCity of countryGrids[neighborGrid]) {
                            if (otherCity.city_id === city.city_id) continue;

                            const distance = getDistanceMiles(
                                { lat: city.lat, lon: city.lon },
                                { lat: otherCity.lat, lon: otherCity.lon },
                            );

                            if (distance <= 20) {
                                cityGroups[country_id][city_id].nearbyCities.push({
                                    ...otherCity,
                                    distanceFromCenter: distance,
                                });
                            }
                        }
                    }
                }
            }
        }

        return cityGroups;
    } catch (error) {
        console.error('Error grouping cities:', error);
    }
}

function main() {
    return new Promise(async (resolve, reject) => {
        try {
            await getCountries();
            await getStates();
            await getCities();

            // await fixNameSpace();
            //
            // await deleteWNames();
            // await updateSchoolTypes();
            // await missingSchoolType();

            // await setSchoolLatLon();
            // await checkSetInvalidName();
            // await addSchoolsLocation();
            //
            await deleteDuplicateByName();
            //
            // await fixWrongCities();
            //
            // await fixDuplicateCities();
            //
            // await fixCitiesNoLatLon();

            // await deleteDuplicateModel();
            // await deleteDuplicateFuzzy();
        } catch (e) {
            console.error(e);
        }

        countries_dict = {};
        cities_dict = {};
        countries_schools = {};

        resolve();
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
