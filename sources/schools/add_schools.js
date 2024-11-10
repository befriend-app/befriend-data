const axios = require('axios');
const dbService = require('../../services/db');
const { generateToken, timeNow, loadScriptEnv, isNumeric } = require('../../services/shared');

loadScriptEnv();

const WIKIDATA_API = 'https://query.wikidata.org/sparql';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const BATCH_SIZE = 3000;
const DETAILS_BATCH_SIZE = 200;

const EDUCATION_LEVELS = {
    osm: {
        'primary school': 'middle_school',
        'middle school': 'middle_school',
        middle_school: 'middle_school',
        secondary: 'high_school',
        high_school: 'high_school',
        secondary_school: 'high_school',
        college: 'college',
        university: 'college',
    },
    wikidata: {
        Q3914: 'school', // school
        Q875538: 'college', // public university
        Q38723: 'college', // higher education institution
        Q3354859: 'college', // collegiate university
        Q3918: 'college', // university
        Q189004: 'college', // college
        Q15936437: 'college', // research university
        Q5341295: 'school', // educational organization
        Q2385804: 'school', // educational institution
        Q9826: 'high_school', // high school
        Q159334: 'high_school', // secondary school/high school
        Q23002054: 'school', // private non-for-profit educational institution
        Q149566: 'middle_school', // middle school
        Q9842: 'middle_school', // primary school
    },
};

const usStates = {
    Alabama: 'Q173',
    Alaska: 'Q797',
    Arizona: 'Q816',
    Arkansas: 'Q1612',
    California: 'Q99',
    Colorado: 'Q1261',
    Connecticut: 'Q779',
    Delaware: 'Q1393',
    Florida: 'Q812',
    Georgia: 'Q1428',
    Hawaii: 'Q782',
    Idaho: 'Q1221',
    Illinois: 'Q1204',
    Indiana: 'Q1415',
    Iowa: 'Q1546',
    Kansas: 'Q1558',
    Kentucky: 'Q1603',
    Louisiana: 'Q1588',
    Maine: 'Q724',
    Maryland: 'Q1391',
    Massachusetts: 'Q771',
    Michigan: 'Q1166',
    Minnesota: 'Q1527',
    Mississippi: 'Q1494',
    Missouri: 'Q1581',
    Montana: 'Q1212',
    Nebraska: 'Q1553',
    Nevada: 'Q1227',
    'New Hampshire': 'Q759',
    'New Jersey': 'Q1408',
    'New Mexico': 'Q1522',
    'New York': 'Q1384',
    'North Carolina': 'Q1454',
    'North Dakota': 'Q1207',
    Ohio: 'Q1397',
    Oklahoma: 'Q1649',
    Oregon: 'Q824',
    Pennsylvania: 'Q1400',
    'Rhode Island': 'Q1387',
    'South Carolina': 'Q1456',
    'South Dakota': 'Q1211',
    Tennessee: 'Q1509',
    Texas: 'Q1439',
    Utah: 'Q829',
    Vermont: 'Q16551',
    Virginia: 'Q1370',
    Washington: 'Q1223',
    'West Virginia': 'Q1371',
    Wisconsin: 'Q1537',
    Wyoming: 'Q1214',
};

let statesLookup = {};

function getStates() {
    return new Promise(async (resolve, reject) => {
        try {
            let conn = await dbService.conn();

            let states = await conn('open_states AS os')
                .join('open_countries AS oc', 'oc.id', '=', 'os.country_id')
                .where('country_name', 'United States')
                .select('os.*');

            for (let state of states) {
                statesLookup[state.state_name] = state;
            }
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

async function fetchUSWikidata() {
    let allResults = [];

    for (let state in usStates) {
        const stateId = usStates[state];
        console.log(`Fetching Wiki data for ${state}`);

        const query = `
            SELECT DISTINCT ?school ?schoolLabel ?type ?typeLabel ?coordinates ?city ?cityLabel ?studentCount WHERE {
                ?school wdt:P31 ?type ;
                        wdt:P131*/wdt:P131 wd:${stateId} .
                
                VALUES ?type { 
                    wd:Q3914      # school
                    wd:Q875538    # public university
                    wd:Q38723     # higher education institution
                    wd:Q3354859   # collegiate university
                    wd:Q3918      # university
                    wd:Q189004    # college
                    wd:Q15936437  # research university
                    wd:Q5341295   # educational organization
                    wd:Q2385804   # educational institution
                    wd:9826       # high school
                    wd:Q159334    # secondary school/high school
                    wd:Q23002054  # private non-for-profit educational institution
                    wd:Q149566    # middle school
                    wd:Q9842      # primary school
                }
                
                OPTIONAL { ?school wdt:P625 ?coordinates }
                OPTIONAL { 
                    ?school wdt:P131 ?city .
                    ?city wdt:P31 wd:Q515 .
                }
                OPTIONAL { ?school wdt:P2196 ?studentCount }
                
                SERVICE wikibase:label { 
                    bd:serviceParam wikibase:language "en" .
                }
            }
        `;

        try {
            const response = await axios.get(WIKIDATA_API, {
                params: {
                    query,
                    format: 'json',
                },
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'SchoolDataCollector/1.0',
                },
            });

            const results = parseWikidataResponse(response.data, state);
            console.log(`Found ${results.length} Wiki schools in ${state}`);
            allResults = allResults.concat(results);

            await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limiting
        } catch (error) {
            console.error(`Error fetching data for ${state}:`, error.message);
        }
    }

    return allResults;
}

async function fetchUSOSM() {
    let allElements = [];

    for (let state in usStates) {
        console.log(`Fetching OSM data for ${state}`);

        const query = `
            [out:json][timeout:300];
            area["name"="${state}"]["admin_level"="4"]->.searchArea;
            (
                // Schools
                way["amenity"="school"](area.searchArea);
                node["amenity"="school"](area.searchArea);
                
                // Colleges and Universities
                way["amenity"~"college|university"](area.searchArea);
                node["amenity"~"college|university"](area.searchArea);
                
                // Educational Buildings
                way["building"~"^(school|university|college)$"](area.searchArea);
                node["building"~"^(school|university|college)$"](area.searchArea);
                
                // Educational Facilities
                way["education"](area.searchArea);
                node["education"](area.searchArea);
                
                // Campus Areas
                way["landuse"~"education|university"](area.searchArea);
                
                // Relations for larger institutions
                relation["amenity"~"school|university|college"](area.searchArea);
            );
            out center body;
            >;
            out skel qt;
        `;

        try {
            const response = await axios.post(OVERPASS_API, query, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 120000, // 2 minute timeout
            });

            if (response.data && response.data.elements) {
                const elements = response.data.elements.filter(
                    (element) =>
                        element.tags &&
                        element.tags.name &&
                        !element.tags.disused &&
                        !element.tags.abandoned,
                );

                console.log(`Found ${elements.length} in ${state}`);

                // Add state information to each element
                elements.forEach((element) => {
                    element.state = state;
                });

                allElements = allElements.concat(elements);

                // Rate limiting to avoid overloading the API
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error fetching OSM data for ${state}:`, error.message);

            // If we hit a timeout or server error, wait longer before continuing
            if (error.response?.status === 504 || error.response?.status === 500) {
                console.log(`Waiting 30 seconds before continuing due to server error...`);
                await new Promise((resolve) => setTimeout(resolve, 30000));
            }
        }
    }

    return parseOverpassData({ elements: allElements });
}

async function fetchSchoolDetails(schoolIds) {
    const batches = [];

    for (let i = 0; i < schoolIds.length; i += DETAILS_BATCH_SIZE) {
        const batch = schoolIds.slice(i, i + DETAILS_BATCH_SIZE);
        const valuesClause = batch.map((url) => `wd:${url.split('/').pop()}`).join(' ');

        const detailQuery = `
            SELECT ?school ?coordinates ?city ?cityLabel ?state ?stateLabel ?studentCount WHERE {
                VALUES ?school { ${valuesClause} }
                OPTIONAL { ?school wdt:P625 ?coordinates }
                OPTIONAL { 
                    ?school wdt:P131 ?city .
                    ?city wdt:P31 wd:Q515 .
                }
                OPTIONAL {
                    ?school wdt:P131 ?state .
                    ?state wdt:P31 wd:Q7275 .
                }
                OPTIONAL { ?school wdt:P2196 ?studentCount }
                
                SERVICE wikibase:label { 
                    bd:serviceParam wikibase:language "en" .
                }
            }
        `;

        try {
            const response = await axios.post(
                WIKIDATA_API,
                new URLSearchParams({
                    query: detailQuery,
                    format: 'json',
                }).toString(),
                {
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'SchoolDataCollector/1.0',
                    },
                },
            );

            batches.push(response.data?.results?.bindings || []);

            await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limiting
        } catch (error) {
            console.error(`Error fetching details batch:`, error.message);
            batches.push([]);
        }
    }

    return batches.flat();
}

async function fetchFromWikidata(countryId, countryName, offset = 0, accumulated = []) {
    if (countryName === 'United States') {
        return await fetchUSWikidata();
    }

    console.log(`${countryName}: Wiki (offset: ${offset})`);

    // Base query without coordinates and location info for better performance
    const baseQuery = `
        SELECT DISTINCT ?school ?schoolLabel ?type ?typeLabel WHERE {
            ?school wdt:P31 ?type ;
                    wdt:P17 wd:${countryId} .
            
            VALUES ?type { 
                    wd:Q3914      # school
                    wd:Q875538    # public university
                    wd:Q38723     # higher education institution
                    wd:Q3354859   # collegiate university
                    wd:Q3918      # university
                    wd:Q189004    # college
                    wd:Q15936437  # research university
                    wd:Q5341295   # educational organization
                    wd:Q2385804   # educational institution
                    wd:9826       # high school
                    wd:Q159334    # secondary school/high school
                    wd:Q23002054  # private non-for-profit educational institution
                    wd:Q149566    # middle school
                    wd:Q9842      # primary school
            }
            
            SERVICE wikibase:label { 
                bd:serviceParam wikibase:language "en" .
            }
        }
        ORDER BY ?school
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
    `;

    try {
        const baseResponse = await axios.post(
            WIKIDATA_API,
            new URLSearchParams({
                query: baseQuery,
                format: 'json',
            }).toString(),
            {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'SchoolDataCollector/1.0',
                },
            },
        );

        if (!baseResponse.data?.results?.bindings) {
            throw new Error('Invalid response structure');
        }

        const baseResults = baseResponse.data.results.bindings;
        const schoolIds = baseResults.map((result) => result.school.value);

        // Fetch additional details in smaller batches
        const details = await fetchSchoolDetails(schoolIds);

        const mergedResults = baseResults.map((baseResult) => {
            const schoolId = baseResult.school.value;
            const detail = details.find((d) => d.school?.value === schoolId) || {};
            return { ...baseResult, ...detail };
        });

        const results = parseWikidataResponse({ results: { bindings: mergedResults } });
        const allResults = accumulated.concat(results);

        if (baseResults.length === BATCH_SIZE) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limiting
            return fetchFromWikidata(countryId, countryName, offset + BATCH_SIZE, allResults);
        }

        return allResults;
    } catch (error) {
        console.error(
            `Error fetching from Wikidata for ${countryName} (offset: ${offset}):`,
            error.message,
        );
        return accumulated;
    }
}

async function fetchFromOverpass(countryName) {
    if (countryName === 'United States') {
        return await fetchUSOSM();
    }

    console.log(`Fetching schools from OpenStreetMap for ${countryName}...`);

    const query = `
        [out:json][timeout:300];
        area["name:en"="${countryName}"][admin_level=2]->.searchArea;
        (
            way["amenity"~"school|college|university"](area.searchArea);
            node["amenity"~"school|college|university"](area.searchArea);
            way["building"~"school|university|college"](area.searchArea);
            relation["amenity"~"school|college|university"](area.searchArea);
        );
        out center body;
        >;
        out skel qt;
    `;

    try {
        const response = await axios.post(OVERPASS_API, query, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        return parseOverpassData(response.data);
    } catch (error) {
        console.error(`Error fetching from OpenStreetMap for ${countryName}:`, error.message);
        return [];
    }
}

function parseWikidataResponse(data, state) {
    return data.results.bindings.map((result) => {
        const coordinatesMatch = result.coordinates?.value.match(/Point\(([^ ]+) ([^)]+)\)/);
        const typeId = result.type.value.split('/').pop();

        return {
            name: result.schoolLabel.value,
            type: result.typeLabel.value,
            educationLevel: EDUCATION_LEVELS.wikidata[typeId] || 'unknown',
            source: 'Wikidata',
            id: result.school.value,
            coordinates: coordinatesMatch
                ? {
                      lon: parseFloat(coordinatesMatch[1]),
                      lat: parseFloat(coordinatesMatch[2]),
                  }
                : null,
            location: {
                city: result.cityLabel?.value || null,
                state: result.stateLabel?.value || null,
            },
            state: state,
            student_count: isNumeric(result.studentCount)
                ? parseInt(result.studentCount.value)
                : null,
        };
    });
}

function parseOverpassData(data) {
    return data.elements
        .filter((element) => element.tags && element.tags.name)
        .map((element) => {
            const city =
                element.tags['addr:city'] ||
                element.tags.city ||
                element.tags['is_in:city'] ||
                null;

            const state =
                element.tags['addr:state'] ||
                element.tags.state ||
                element.tags['is_in:state'] ||
                element.tags['is_in:province'] ||
                element.tags.province ||
                null;

            let coordinates = null;
            if (element.type === 'node') {
                coordinates = {
                    lat: element.lat,
                    lon: element.lon,
                };
            } else if (element.type === 'way' && element.center) {
                coordinates = {
                    lat: element.center.lat,
                    lon: element.center.lon,
                };
            }

            const schoolType =
                element.tags.amenity ||
                element.tags.education ||
                element.tags.building ||
                'unknown';

            return {
                name: element.tags['name:en'] || element.tags.name,
                type: schoolType,
                educationLevel: EDUCATION_LEVELS.osm[schoolType] || 'unknown',
                source: 'OpenStreetMap',
                id: element.id.toString(),
                coordinates: coordinates,
                location: {
                    city: city,
                    state: state,
                },
                state: element.state,
                student_count:
                    element.tags.students && isNumeric(element.tags.students)
                        ? parseInt(element.tags.students)
                        : null,
            };
        });
}

function normalizeSchoolName(name) {
    return name
        .toLowerCase()
        .replace(/university of |the |school of |college of /g, '')
        .replace(/[^a-z0-9]/g, '');
}

function mergeSchoolData(osmSchools, wikiSchools) {
    const merged = new Map();

    // Process Wikidata entries first as they're typically more authoritative
    for (const school of wikiSchools) {
        const normalizedName = normalizeSchoolName(school.name);
        merged.set(normalizedName, {
            ...school,
            sources: ['Wikidata'],
        });
    }

    // Merge OSM data
    for (const school of osmSchools) {
        const normalizedName = normalizeSchoolName(school.name);

        if (merged.has(normalizedName)) {
            const existing = merged.get(normalizedName);
            existing.sources.push('OpenStreetMap');

            // Use OSM coordinates if Wikidata doesn't have any
            if (!existing.coordinates && school.coordinates) {
                existing.coordinates = school.coordinates;
            }

            // Use OSM student count if Wikidata doesn't have any
            if (!existing.student_count && school.student_count) {
                existing.student_count = school.student_count;
            }
        } else {
            merged.set(normalizedName, {
                ...school,
                sources: ['OpenStreetMap'],
            });
        }
    }

    return Array.from(merged.values());
}

async function processCountry(country) {
    let [osmSchools, wikiSchools] = await Promise.all([
        fetchFromOverpass(country.country_name),
        fetchFromWikidata(country.wiki_code, country.country_name),
    ]);

    console.log(`Found ${osmSchools?.length} schools from OpenStreetMap`);
    console.log(`Found ${wikiSchools?.length} schools from Wikidata`);

    if (osmSchools.length === 0) {
        console.error(`${country.country_name}: no OSM schools`);
    }

    const mergedSchools = mergeSchoolData(osmSchools, wikiSchools);

    let schools = [];

    for (let school of mergedSchools) {
        let state = school.state ? statesLookup[school.state]?.state_short : null;

        schools.push({
            token: generateToken(10),
            name: school.name,
            city: school.location?.city || null,
            state: state || school.location?.state || null,
            country_id: country.id,
            lat: school.coordinates?.lat || null,
            lon: school.coordinates?.lon || null,
            is_grade_school: school.educationLevel === 'middle_school',
            is_high_school: school.educationLevel === 'high_school',
            is_college: school.educationLevel === 'college',
            student_count: school.student_count,
            source: school.sources?.includes('Wikidata') ? 'wd' : 'osm',
            created: timeNow(),
            updated: timeNow(),
        });
    }

    try {
        await dbService.batchInsert('schools', schools);
        console.log(`Successfully added ${schools.length} schools for ${country.country_name}`);
    } catch (error) {
        console.error(`Error inserting schools for ${country.country_name}:`, error);
    }
}

async function main() {
    try {
        console.log('Add schools');

        const conn = await dbService.conn();

        await getStates();

        //countries with error:
        const countries = await conn('open_countries').whereNotNull('wiki_code');
        // .whereIn('id', [792, 810, 822, 856, 860, 865, 869, 919, 952]);
        // .where('id', '>', 766);

        for (const country of countries) {
            console.log({
                country: country.country_name,
            });

            // Clear existing schools
            await conn('schools').where('country_id', country.id).delete();

            try {
                await processCountry(country);
            } catch (error) {
                console.error(`Error processing ${country.country_name}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in main execution:', error);
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
