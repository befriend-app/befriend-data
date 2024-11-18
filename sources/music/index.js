function main() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Loading music');

            await require('./add_genres').main();
            await require('./add_artists').main();
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
