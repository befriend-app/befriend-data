const aiService = require('../../services/ai');
const dbService = require('../../services/db');
const { timeNow, loadScriptEnv } = require('../../services/shared');
const { batchInsert } = require('../../services/db');
loadScriptEnv();

function main() {
    return new Promise(async (resolve, reject) => {
        console.log('Add languages');

        let table_1 = 'languages';
        let table_2 = 'top_languages_countries';

        let conn = await dbService.conn();

        let items = module.exports.items;

        //add languages
        for (let i = 0; i < items.length; i++) {
            let item = items[i];

            let check = await conn(table_1).where('token', item.token).first();

            if (!check) {
                item.created = timeNow();
                item.sort_position = i + 1;
                item.is_visible = true;
                item.updated = timeNow();
                await conn(table_1).insert(item);
            }
        }

        let languages = await conn(table_1).whereNull('deleted');

        let languages_countries = await conn(table_2);

        let languages_dict = languages.reduce((acc, l) => {
            acc[l.token] = l;
            return acc;
        }, {});

        let languages_countries_dict = languages_countries.reduce((acc, language) => {
            if (!(language.country_id in acc)) {
                acc[language.country_id] = {};
            }

            acc[language.country_id][language.language_id] = acc;

            return acc;
        }, {});

        //add countries
        let countries = await conn('open_countries').orderBy('country_name');

        for (let i = 0; i < countries.length; i++) {
            let country = countries[i];
            console.log({
                country: country.country_name,
                process: `${i + 1}/${countries.length}`,
            });

            //check if already processed
            let check = await conn(table_2).where('country_id', country.id);

            if (check.length) {
                continue;
            }

            let prompt = `
                        Given this list of languages: ${JSON.stringify(module.exports.items)},
                        return the 5 most common spoken for country: ${country.country_name}.
                        Do not return any additional information before or after. Provide ONLY valid JSON.
                        Your response should include the language and token.
                        The response should be an array of items with the following format:
                        [{name, token}]
                        `;

            try {
                let top_languages = await aiService.dinfra.promptJSON(prompt);

                let top_languages_dict = top_languages.reduce((acc, l) => {
                    acc[l.token] = languages_dict[l.token];
                    return acc;
                }, {});

                //organize
                let batch_insert = [];

                for (let i = 0; i < top_languages.length; i++) {
                    let l = top_languages[i];

                    if (!(l.token in languages_dict)) {
                        continue;
                    }

                    batch_insert.push({
                        country_id: country.id,
                        language_id: languages_dict[l.token].id,
                        sort_position: i + 1,
                        created: timeNow(),
                        updated: timeNow(),
                    });
                }

                await batchInsert(table_2, batch_insert);
            } catch (e) {
                console.error(e);
            }
        }

        console.log('Languages added');

        resolve();
    });
}

module.exports = {
    main: main,
    items: [
        {
            token: 'mandarin',
            name: 'Mandarin Chinese',
        },
        {
            token: 'spanish',
            name: 'Spanish',
        },
        {
            token: 'english',
            name: 'English',
        },
        {
            token: 'hindi',
            name: 'Hindi',
        },
        {
            token: 'arabic',
            name: 'Arabic',
        },
        {
            token: 'bengali',
            name: 'Bengali',
        },
        {
            token: 'portuguese',
            name: 'Portuguese',
        },
        {
            token: 'russian',
            name: 'Russian',
        },
        {
            token: 'japanese',
            name: 'Japanese',
        },
        {
            token: 'punjabi',
            name: 'Punjabi',
        },
        {
            token: 'german',
            name: 'German',
        },
        {
            token: 'javanese',
            name: 'Javanese',
        },
        {
            token: 'wu',
            name: 'Wu',
        },
        {
            token: 'french',
            name: 'French',
        },
        {
            token: 'telugu',
            name: 'Telugu',
        },
        {
            token: 'vietnamese',
            name: 'Vietnamese',
        },
        {
            token: 'marathi',
            name: 'Marathi',
        },
        {
            token: 'korean',
            name: 'Korean',
        },
        {
            token: 'tamil',
            name: 'Tamil',
        },
        {
            token: 'turkish',
            name: 'Turkish',
        },
        {
            token: 'polish',
            name: 'Polish',
        },
        {
            token: 'ukrainian',
            name: 'Ukrainian',
        },
        {
            token: 'swahili',
            name: 'Swahili',
        },
        {
            token: 'malay',
            name: 'Malay',
        },
        {
            token: 'oriya',
            name: 'Oriya',
        },
        {
            token: 'sindhi',
            name: 'Sindhi',
        },
        {
            token: 'kannada',
            name: 'Kannada',
        },
        {
            token: 'gujarati',
            name: 'Gujarati',
        },
        {
            token: 'thai',
            name: 'Thai',
        },
        {
            token: 'pashto',
            name: 'Pashto',
        },
        {
            token: 'romanian',
            name: 'Romanian',
        },
        {
            token: 'dutch',
            name: 'Dutch',
        },
        {
            token: 'hausa',
            name: 'Hausa',
        },
        {
            token: 'amharic',
            name: 'Amharic',
        },
        {
            token: 'oromo',
            name: 'Oromo',
        },
        {
            token: 'igbo',
            name: 'Igbo',
        },
        {
            token: 'yoruba',
            name: 'Yoruba',
        },
        {
            token: 'zulu',
            name: 'Zulu',
        },
        {
            token: 'shona',
            name: 'Shona',
        },
        {
            token: 'khmer',
            name: 'Khmer',
        },
        {
            token: 'lao',
            name: 'Lao',
        },
        {
            token: 'sinhala',
            name: 'Sinhala',
        },
        {
            token: 'nepali',
            name: 'Nepali',
        },
        {
            token: 'burmese',
            name: 'Burmese',
        },
        {
            token: 'hungarian',
            name: 'Hungarian',
        },
        {
            token: 'czech',
            name: 'Czech',
        },
        {
            token: 'greek',
            name: 'Greek',
        },
        {
            token: 'danish',
            name: 'Danish',
        },
        {
            token: 'finnish',
            name: 'Finnish',
        },
        {
            token: 'swedish',
            name: 'Swedish',
        },
        {
            token: 'norwegian',
            name: 'Norwegian',
        },
        {
            token: 'bulgarian',
            name: 'Bulgarian',
        },
        {
            token: 'serbian',
            name: 'Serbian',
        },
        {
            token: 'croatian',
            name: 'Croatian',
        },
        {
            token: 'slovak',
            name: 'Slovak',
        },
        {
            token: 'slovenian',
            name: 'Slovenian',
        },
        {
            token: 'lithuanian',
            name: 'Lithuanian',
        },
        {
            token: 'latvian',
            name: 'Latvian',
        },
        {
            token: 'estonian',
            name: 'Estonian',
        },
        {
            token: 'albanian',
            name: 'Albanian',
        },
        {
            token: 'macedonian',
            name: 'Macedonian',
        },
        {
            token: 'armenian',
            name: 'Armenian',
        },
        {
            token: 'georgian',
            name: 'Georgian',
        },
        {
            token: 'azerbaijani',
            name: 'Azerbaijani',
        },
        {
            token: 'kazakh',
            name: 'Kazakh',
        },
        {
            token: 'uzbek',
            name: 'Uzbek',
        },
        {
            token: 'tajik',
            name: 'Tajik',
        },
        {
            token: 'turkmen',
            name: 'Turkmen',
        },
        {
            token: 'kyrgyz',
            name: 'Kyrgyz',
        },
        {
            token: 'mongolian',
            name: 'Mongolian',
        },
        {
            token: 'tibetan',
            name: 'Tibetan',
        },
        {
            token: 'uyghur',
            name: 'Uyghur',
        },
        {
            token: 'kurdish',
            name: 'Kurdish',
        },
        {
            token: 'pashto',
            name: 'Pashto',
        },
        {
            token: 'balochi',
            name: 'Balochi',
        },
        {
            token: 'sindhi',
            name: 'Sindhi',
        },
        {
            token: 'saraiki',
            name: 'Saraiki',
        },
        {
            token: 'rajasthani',
            name: 'Rajasthani',
        },
        {
            token: 'maithili',
            name: 'Maithili',
        },
        {
            token: 'bhojpuri',
            name: 'Bhojpuri',
        },
        {
            token: 'magahi',
            name: 'Magahi',
        },
        {
            token: 'chhattisgarhi',
            name: 'Chhattisgarhi',
        },
        {
            token: 'dogri',
            name: 'Dogri',
        },
        {
            token: 'konkani',
            name: 'Konkani',
        },
        {
            token: 'manipuri',
            name: 'Manipuri',
        },
        {
            token: 'sanskrit',
            name: 'Sanskrit',
        },
        {
            token: 'hebrew',
            name: 'Hebrew',
        },
        {
            token: 'welsh',
            name: 'Welsh',
        },
        {
            token: 'breton',
            name: 'Breton',
        },
        {
            token: 'corsican',
            name: 'Corsican',
        },
        {
            token: 'basque',
            name: 'Basque',
        },
        {
            token: 'catalan',
            name: 'Catalan',
        },
        {
            token: 'galician',
            name: 'Galician',
        },
        {
            token: 'occitan',
            name: 'Occitan',
        },
        {
            token: 'sardinian',
            name: 'Sardinian',
        },
        {
            token: 'scottish_gaelic',
            name: 'Scottish Gaelic',
        },
        {
            token: 'irish',
            name: 'Irish',
        },
        {
            token: 'manx',
            name: 'Manx',
        },
        {
            token: 'cornish',
            name: 'Cornish',
        },
        {
            token: 'persian',
            name: 'Persian',
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
