const { loadScriptEnv } = require('../services/shared');
loadScriptEnv();

(async function () {
    try {
        await require('../sources/genders').main();
        await require('../sources/activity_types').main();
        await require('../sources/locations').main();
        await require('../sources/me').main();
    } catch (e) {
        console.error(e);
    }

    process.exit();
})();
