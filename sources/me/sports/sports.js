const dbService = require('../../../services/db');
const { timeNow, loadScriptEnv } = require('../../../services/shared');
const { deleteKeys, keys } = require('../../../services/cache');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add sports');

        let table_name = 'sports';

        await deleteKeys(keys.sports);

        let conn = await dbService.conn();

        let items = module.exports.items;

        for (let item of items) {
            let itemData = {
                token: item.token,
                name: item.name,
                has_teams: item.has_teams,
                is_play: typeof item.is_play !== 'undefined' ? item.is_play : true,
                is_active: true,
                updated: timeNow(),
            };

            let check = await conn(table_name).where('token', itemData.token).first();

            if (!check) {
                itemData.created = timeNow();

                await conn(table_name).insert(itemData);
            } else {
                await conn(table_name).where('id', check.id).update(itemData);
            }
        }

        console.log('Sports added');

        resolve();
    });
}

module.exports = {
    main: main,
    items: [
        {
            token: 'spo_socc',
            name: 'Soccer',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 1000,
        },
        {
            token: 'spo_bask',
            name: 'Basketball',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 950,
        },
        {
            token: 'spo_cric',
            name: 'Cricket',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 940,
        },
        {
            token: 'spo_base',
            name: 'Baseball',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 900,
        },
        {
            token: 'spo_amfo',
            name: 'American Football',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 890,
        },
        {
            token: 'spo_rugb',
            name: 'Rugby',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 850,
        },
        {
            token: 'spo_volle',
            name: 'Volleyball',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 840,
        },
        {
            token: 'spo_iceh',
            name: 'Hockey',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 820,
        },
        {
            token: 'spo_fiel',
            name: 'Field Hockey',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 780,
        },
        {
            token: 'spo_hand',
            name: 'Handball',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 760,
        },
        {
            token: 'spo_watep',
            name: 'Water Polo',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 650,
        },
        {
            token: 'spo_ulti',
            name: 'Ultimate Frisbee',
            category: 'Team Sports',
            has_teams: false,
            is_active: true,
            popularity: 600,
        },
        {
            token: 'spo_netb',
            name: 'Netball',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 580,
        },
        {
            token: 'spo_lacr',
            name: 'Lacrosse',
            category: 'Team Sports',
            has_teams: true,
            is_active: true,
            popularity: 560,
        },
        {
            token: 'spo_korf',
            name: 'Korfball',
            category: 'Team Sports',
            has_teams: false,
            is_active: true,
            popularity: 400,
        },
        {
            token: 'spo_tenn',
            name: 'Tennis',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 920,
        },
        {
            token: 'spo_golf',
            name: 'Golf',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 900,
        },
        {
            token: 'spo_tabl',
            name: 'Table Tennis',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 850,
        },
        {
            token: 'spo_badm',
            name: 'Badminton',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 840,
        },
        {
            token: 'spo_trck',
            name: 'Track & Field',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 830,
        },
        {
            token: 'spo_gymn',
            name: 'Gymnastics',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 800,
        },
        {
            token: 'spo_cycl',
            name: 'Cycling',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 780,
        },
        {
            token: 'spo_squa',
            name: 'Squash',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 650,
        },
        {
            token: 'spo_bowl',
            name: 'Bowling',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 600,
        },
        {
            token: 'spo_arch',
            name: 'Archery',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 580,
        },
        {
            token: 'spo_fenc',
            name: 'Fencing',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 550,
        },
        {
            token: 'spo_weig',
            name: 'Weightlifting',
            category: 'Individual Sports',
            has_teams: false,
            is_active: true,
            popularity: 520,
        },
        {
            token: 'spo_boxi',
            name: 'Boxing',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 900,
        },
        {
            token: 'spo_mma',
            name: 'Mixed Martial Arts',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 880,
            is_play: false,
        },
        {
            token: 'spo_wres',
            name: 'Wrestling',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 820,
        },
        {
            token: 'spo_judo',
            name: 'Judo',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 780,
        },
        {
            token: 'spo_kara',
            name: 'Karate',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 760,
        },
        {
            token: 'spo_taek',
            name: 'Taekwondo',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 740,
        },
        {
            token: 'spo_kick',
            name: 'Kickboxing',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 700,
        },
        {
            token: 'spo_muay',
            name: 'Muay Thai',
            category: 'Combat Sports',
            has_teams: false,
            is_active: true,
            popularity: 680,
        },
        {
            token: 'spo_f1',
            name: 'Formula 1',
            category: 'Motorsports',
            has_teams: true,
            is_active: true,
            popularity: 920,
            is_play: false,
        },
        {
            token: 'spo_moto',
            name: 'MotoGP',
            category: 'Motorsports',
            has_teams: true,
            is_active: true,
            popularity: 850,
            is_play: false,
        },
        {
            token: 'spo_nasc',
            name: 'NASCAR',
            category: 'Motorsports',
            has_teams: true,
            is_active: true,
            popularity: 820,
            is_play: false,
        },
        {
            token: 'spo_rall',
            name: 'Rally',
            category: 'Motorsports',
            has_teams: true,
            is_active: true,
            popularity: 780,
            is_play: false,
        },
        {
            token: 'spo_indy',
            name: 'IndyCar',
            category: 'Motorsports',
            has_teams: true,
            is_active: true,
            popularity: 750,
            is_play: false,
        },
        {
            token: 'spo_motx',
            name: 'Motocross',
            category: 'Motorsports',
            has_teams: false,
            is_active: true,
            popularity: 700,
            is_play: false,
        },
        {
            token: 'spo_swim',
            name: 'Swimming',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 900,
        },
        {
            token: 'spo_surf',
            name: 'Surfing',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 820,
        },
        {
            token: 'spo_dive',
            name: 'Diving',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 780,
        },
        {
            token: 'spo_sail',
            name: 'Sailing',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 750,
        },
        {
            token: 'spo_rows',
            name: 'Rowing',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 720,
        },
        {
            token: 'spo_cano',
            name: 'Canoeing/Kayaking',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 680,
        },
        {
            token: 'spo_wind',
            name: 'Windsurfing',
            category: 'Water Sports',
            has_teams: false,
            is_active: true,
            popularity: 600,
        },
        {
            token: 'spo_alpi',
            name: 'Alpine Skiing',
            category: 'Winter Sports',
            has_teams: false,
            is_active: true,
            popularity: 850,
        },
        {
            token: 'spo_snow',
            name: 'Snowboarding',
            category: 'Winter Sports',
            has_teams: false,
            is_active: true,
            popularity: 820,
        },
        {
            token: 'spo_figu',
            name: 'Figure Skating',
            category: 'Winter Sports',
            has_teams: false,
            is_active: true,
            popularity: 800,
        },
        {
            token: 'spo_cros',
            name: 'Cross-Country Skiing',
            category: 'Winter Sports',
            has_teams: false,
            is_active: true,
            popularity: 750,
        },
        {
            token: 'spo_biat',
            name: 'Biathlon',
            category: 'Winter Sports',
            has_teams: false,
            is_active: true,
            popularity: 700,
        },
        {
            token: 'spo_curl',
            name: 'Curling',
            category: 'Winter Sports',
            has_teams: true,
            is_active: true,
            popularity: 650,
        },
        {
            token: 'spo_spee',
            name: 'Speed Skating',
            category: 'Winter Sports',
            has_teams: false,
            is_active: true,
            popularity: 600,
        },
        {
            token: 'spo_rock',
            name: 'Rock Climbing',
            category: 'Outdoor Sports',
            has_teams: false,
            is_active: true,
            popularity: 750,
        },
        {
            token: 'spo_hiki',
            name: 'Hiking',
            category: 'Outdoor Sports',
            has_teams: false,
            is_active: true,
            popularity: 800,
        },
        {
            token: 'spo_moun',
            name: 'Mountain Biking',
            category: 'Outdoor Sports',
            has_teams: false,
            is_active: true,
            popularity: 780,
        },
        {
            token: 'spo_skat',
            name: 'Skateboarding',
            category: 'Outdoor Sports',
            has_teams: false,
            is_active: true,
            popularity: 820,
        },
        {
            token: 'spo_bmx',
            name: 'BMX',
            category: 'Outdoor Sports',
            has_teams: false,
            is_active: true,
            popularity: 750,
        },
        {
            token: 'spo_park',
            name: 'Parkour',
            category: 'Outdoor Sports',
            has_teams: false,
            is_active: true,
            popularity: 700,
        },
    ],
};

//script executed directly
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
