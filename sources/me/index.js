function main() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Loading me data');

            await require('./add_sections').main();
            await require('./add_instruments').main();
            await require('./add_movies').main();
            await require('../schools/add_schools').main();
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
}

module.exports = {
    main: main,
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
