#!/usr/bin/env node

require('dotenv').config();

let cacheService = require('./services/cache');
let serverService = require('./services/server');
let systemService = require('./services/system');

(async function () {
    try {
        await cacheService.init();
    } catch (e) {
        console.error(e);
    }

    try {
        await serverService.init();
    } catch (e) {
        console.error(e);
    }

    try {
        systemService.startUpdatesInterval();
    } catch (e) {
        console.error(e);
    }
})();
