function main() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Loading me data');

            await require('./sections').main();

            await require('./life_stages').main();
            await require('./relationships').main();

            await require('./drinking').main();
            await require('./politics').main();
            await require('./smoking').main();
            await require('./religions').main();

            await require('./instruments').main();
            await require('./movies').main();
            await require('./music').main();
            await require('./schools/add_schools').main();
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
