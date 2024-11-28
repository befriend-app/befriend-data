function main() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Loading sports');

            await require('./sports').main();
            await require('./sports_countries').main();
            await require('./leagues').main();
            await require('./teams').main();
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
