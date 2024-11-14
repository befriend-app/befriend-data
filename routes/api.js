let express = require('express');
let router = express.Router();

let apiController = require('../controllers/api');

router.get('/', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        res.json({
            befriend: 'data',
        });

        resolve();
    });
});

router.get('/updates', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getUpdates(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/activity-types', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getActivityTypes(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/venues-categories', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getVenuesCategories(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/activities-venue-categories', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getActivityVenueCategories(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/countries', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getCountries(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/states', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getStates(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/cities', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getCities(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/genders', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getGenders(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/instruments', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getInstruments(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/movies', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getMovies(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/music/genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getMusicGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/music/artists', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getMusicArtists(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/music/artists/genres/:genre_token', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getMusicArtists(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/schools', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getSchools(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/sections', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await apiController.getSections(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

module.exports = router;
