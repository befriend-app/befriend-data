function main() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Merge genres');

            await require('./spotify_genres').main();
            await require('./spotify_genre_matching').main();
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
