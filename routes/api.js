let express = require('express');
let router = express.Router();

let api = require('../controllers/api');

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
            await api.getUpdates(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/earth', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getEarthGrid(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/activity-types', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getActivityTypes(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/venues-categories', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getVenuesCategories(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/activities-venue-categories', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getActivityVenueCategories(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/countries', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getCountries(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/states', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getStates(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/cities', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getCities(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/drinking', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getDrinking(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/genders', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getGenders(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/instruments', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getInstruments(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/kids-ages', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getKidsAges(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/languages', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getLanguages(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/languages/countries', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getLanguagesCountries(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/life-stages', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getLifeStages(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/movie-genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMovieGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/movies', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMovies(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/movies/genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMoviesGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/music/genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMusicGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/music/artists', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMusicArtists(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/music/artists/genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMusicArtistsGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/politics', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getPolitics(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/relationship-status', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getRelationships(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/religions', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getReligions(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/schools', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getSchools(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/smoking', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getSmoking(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/me/sections', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getMeSections(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/sports', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getSports(req, res);
        } catch (e) {
            console.error(e);
        }
        resolve();
    });
});

router.get('/sports/countries', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getSportsCountries(req, res);
        } catch (e) {
            console.error(e);
        }
        resolve();
    });
});

router.get('/sports/leagues', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getSportsLeagues(req, res);
        } catch (e) {
            console.error(e);
        }
        resolve();
    });
});

router.get('/sports/teams', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getSportsTeams(req, res);
        } catch (e) {
            console.error(e);
        }
        resolve();
    });
});

router.get('/tv/genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getTvGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/tv/shows', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getTvShows(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/tv/shows/genres', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getTvShowsGenres(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/work/industries', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getWorkIndustries(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

router.get('/work/roles', function (req, res, next) {
    return new Promise(async (resolve, reject) => {
        try {
            await api.getWorkRoles(req, res);
        } catch (e) {
            console.error(e);
        }

        resolve();
    });
});

module.exports = router;
