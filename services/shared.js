const fs = require('fs');
const dayjs = require('dayjs');
const process = require('process');

const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

global.serverTimezoneString = process.env.TZ || 'America/Chicago';

const earth_radius_km = 6371;
const meters_to_miles = 0.000621371192;

function cloneObj(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error(e);
        return null;
    }
}

function generateToken(length) {
    if (!length) {
        length = 32;
    }

    //edit the token allowed characters
    let a = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');
    let b = [];

    for (let i = 0; i < length; i++) {
        let j = (Math.random() * (a.length - 1)).toFixed(0);
        b[i] = a[j];
    }

    return b.join('');
}

function deg2rad(deg) {
    return (deg * Math.PI) / 180;
}

function getDistanceMeters(loc_1, loc_2) {
    const dLat = deg2rad(loc_2.lat - loc_1.lat);
    const dLon = deg2rad(loc_2.lon - loc_1.lon);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((loc_1.lat * Math.PI) / 180) *
            Math.cos((loc_1.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earth_radius_km * c * 1000;
}

function getDistanceMiles(loc_1, loc_2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (loc_2.lat - loc_1.lat) * Math.PI / 180;
    const dLon = (loc_2.lon - loc_1.lon) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(loc_1.lat * Math.PI / 180) * Math.cos(loc_2.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}


function getMetersFromMilesOrKm(miles_or_km, to_int) {
    let meters = miles_or_km / meters_to_miles;

    if (to_int) {
        return Math.floor(meters);
    }

    return meters;
}

function getRepoRoot() {
    let slash = `/`;

    if (process.platform.startsWith('win')) {
        slash = `\\`;
    }

    let path_split = __dirname.split(slash);

    let path_split_slice = path_split.slice(0, path_split.length - 1);

    return path_split_slice.join(slash);
}

function isNumeric(val) {
    return !isNaN(parseFloat(val)) && isFinite(val);
}

function isProdApp() {
    return process.env.APP_ENV && process.env.APP_ENV.includes('prod');
}

function joinPaths() {
    let args = [];

    for (let i = 0; i < arguments.length; i++) {
        let arg = arguments[i] + '';
        if (!arg) {
            continue;
        }

        if (typeof arg === 'number') {
            arg = arg.toString();
        }

        args.push(arg);
    }

    let slash = '/';

    if (process.platform === 'win32' && args[0].includes('\\')) {
        slash = '\\';
    }

    let url = args
        .map((part, i) => {
            if (i === 0) {
                let re = new RegExp(`[\\${slash}]*$`, 'g');
                return part.trim().replace(re, '');
            } else {
                let re = new RegExp(`(^[\\${slash}]*|[\\/]*$)`, 'g');
                return part.trim().replace(re, '');
            }
        })
        .filter((x) => x.length)
        .join(slash);

    if (!url.startsWith('http') && !url.startsWith('/')) {
        url = `/${url}`;
    }

    return url;
}

function loadScriptEnv() {
    let repo_root = getRepoRoot();

    process.chdir(repo_root);

    require('dotenv').config();
}

function normalizePort(val) {
    let port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

function pathExists(p) {
    return new Promise(async (resolve, reject) => {
        fs.access(p, fs.constants.F_OK, function (err) {
            if (err) {
                return resolve(false);
            }

            return resolve(true);
        });
    });
}

let protectedNames = ['constructor'];

function sleep(ms) {
    return new Promise(async (resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

function timeNow(seconds) {
    if (seconds) {
        return Number.parseInt(Date.now() / 1000);
    }

    return Date.now();
}

module.exports = {
    cloneObj,
    generateToken,
    getDistanceMeters,
    getDistanceMiles,
    getMetersFromMilesOrKm,
    getRepoRoot,
    isNumeric,
    isProdApp,
    joinPaths,
    loadScriptEnv,
    normalizePort,
    pathExists,
    protectedNames,
    sleep,
    timeNow,
};
