const cacheService = require('../services/cache');
const dbService = require('../services/db');

module.exports = {
    getActivityTypes: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('activity_types');

                let id_token_dict = {};

                // lookup dict
                for(let item of items) {
                    id_token_dict[item.id] = item.activity_type_token;
                }

                //remove fields, set parent token
                for(let item of items) {
                    let parent_token = null;

                    if(item.parent_activity_type_id) {
                        parent_token = id_token_dict[item.parent_activity_type_id];
                    }

                    delete item.created;
                    delete item.id;
                    delete item.parent_activity_type_id;

                    item.parent_token = parent_token;
                }

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch(e) {
                console.error(e);
                res.json("Error retrieving data", 400);
            }

            resolve();
        });
    },
    getVenuesCategories: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('venues_categories');

                let id_token_dict = {};

                // lookup dict
                for(let item of items) {
                    id_token_dict[item.id] = item.category_token;
                }

                //remove fields, set parent token
                for(let item of items) {
                    let parent_token = null;

                    if(item.parent_id) {
                        parent_token = id_token_dict[item.parent_id];
                    }

                    delete item.created;
                    delete item.id;
                    delete item.parent_id;

                    item.parent_token = parent_token;
                }

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch(e) {
                console.error(e);
                res.json("Error retrieving data", 400);
            }

            resolve();
        });
    },
    getActivityVenueCategories: function (req, res) {
        return new Promise(async (resolve, reject) => {
            try {
                let conn = await dbService.conn();

                let items = await conn('activity_type_venues AS atv')
                    .join('activity_types AS at', 'at.id', '=', 'atv.activity_type_id')
                    .join('venues_categories AS vc', 'vc.id', '=', 'atv.venue_category_id')
                    .select('activity_type_token', 'category_token', 'atv.sort_position', 'atv.is_active', 'atv.updated');

                res.json(
                    {
                        items: items,
                    },
                    200,
                );
            } catch(e) {
                console.error(e);
                res.json("Error retrieving data", 400);
            }

            resolve();
        });
    },

};
