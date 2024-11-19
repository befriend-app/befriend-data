//genre name mapping
//mb = Music Brainz
//s = Spotify

const genreMap = {
    Alternative: {
        name: 'Alternative',
        position: 1,
        mb: ['alternative', 'alternative rock'],
        s: ['alt-rock', 'alternative', 'indie']
    },
    Blues: {
        name: 'Blues',
        position: 2,
        mb: ['blues'],
        s: ['blues']
    },
    'Classic Rock': {
        name: 'Classic Rock',
        position: 2,
        mb: ['classic rock'],
        s: ['classic rock']
    },
    Classical: {
        name: 'Classical',
        position: 3,
        mb: ['classical'],
        s: ['classical', 'opera']
    },
    Country: {
        name: 'Country',
        position: 4,
        mb: ['country'],
        s: ['country', 'honky-tonk']
    },
    Dance: {
        name: 'Dance',
        position: 5,
        mb: ['dance', 'electronic dance music'],
        s: [
            'dance',
            'deep-house',
            'detroit-techno',
            'disco',
            'house',
            'edm',
            'chicago-house',
            'minimal-techno',
            'progressive-house',
            'techno',
            'trance',
            'breakbeat',
            'drum-and-bass',
            'dubstep',
            'electro',
            'electronic',
            'dub',
            'post-dubstep',
            'club',
            'garage',
        ]
    },
    Electronic: {
        name: 'Electronic',
        position: 6,
        mb: ['electronic', 'electronica'],
        s: ['electronic', 'ambient', 'idm', 'synth-pop', 'trip-hop']
    },
    Folk: {
        name: 'Folk',
        position: 7,
        mb: ['folk', 'folk music'],
        s: ['folk', 'acoustic']
    },
    'Hard Rock': {
        name: 'Hard Rock',
        position: 8,
        mb: ['hard rock'],
        s: ['hard-rock']
    },
    'Hip-Hop/Rap': {
        name: 'Hip-Hop/Rap',
        position: 9,
        mb: ['hip hop', 'rap'],
        s: ['hip-hop']
    },
    'Indie Rock': {
        name: 'Indie Rock',
        position: 10,
        mb: ['indie rock', 'indie'],
        s: ['indie', 'indie rock', 'indie-pop']
    },
    Jazz: {
        name: 'Jazz',
        position: 11,
        mb: ['jazz'],
        s: ['jazz']
    },
    Metal: {
        name: 'Metal',
        position: 12,
        mb: ['metal', 'heavy metal'],
        s: ['metal', 'black-metal', 'death-metal', 'heavy-metal', 'metal-misc', 'metalcore']
    },
    'New Age': {
        name: 'New Age',
        position: 13,
        mb: ['new age'],
        s: ['new-age']
    },
    Pop: {
        name: 'Pop',
        position: 14,
        mb: ['pop'],
        s: ['pop', 'pop-film', 'indie-pop', 'power-pop']
    },
    Punk: {
        name: 'Punk',
        position: 15,
        mb: ['punk', 'punk rock'],
        s: ['punk', 'punk-rock', 'hardcore']
    },
    'R&B': {
        name: 'R&B',
        position: 16,
        mb: ['r&b', 'rhythm and blues'],
        s: ['r-n-b']
    },
    Reggae: {
        name: 'Reggae',
        position: 17,
        mb: ['reggae'],
        s: ['reggae', 'reggaeton', 'dancehall']
    },
    Rock: {
        name: 'Rock',
        position: 18,
        mb: ['rock'],
        s: ['rock', 'rock-n-roll']
    },
    'Singer/Songwriter': {
        name: 'Singer/Songwriter',
        position: 19,
        mb: ['singer-songwriter'],
        s: ['singer-songwriter', 'songwriter']
    },
    Soul: {
        name: 'Soul',
        position: 20,
        mb: ['soul', 'soul music', 'northern soul'],
        s: ['soul']
    },
    "Children's Music": {
        name: "Children's Music",
        position: 21,
        mb: ["children's music", 'children'],
        s: ['children', 'kids']
    },
    Christian: {
        name: 'Christian',
        position: 22,
        mb: ['christian', 'christian music'],
        s: ['gospel']
    },
    Christmas: {
        name: 'Christmas',
        position: 23,
        mb: ['christmas', 'christmas music'],
        s: ['holidays']
    },
    Soundtrack: {
        name: 'Soundtrack',
        position: 24,
        mb: ['soundtrack', 'film score'],
        s: ['movies', 'soundtracks', 'show-tunes']
    },
    African: {
        name: 'African',
        position: 30,
        main: ['african', 'african traditional'],
        mb: ['african', 'african traditional', 'afrobeats', 'afrikaans', 'amapiano'],
        s: ['afrobeat']
    },
    Anime: {
        name: 'Anime',
        position: 31,
        mb: ['anime'],
        s: ['anime']
    },
    Brazilian: {
        name: 'Brazilian',
        position: 32,
        mb: ['brazilian'],
        s: ['brazil', 'mpb', 'pagode', 'sertanejo', 'samba', 'forro', 'bossanova']
    },
    'C-Pop': {
        name: 'C-Pop',
        position: 33,
        mb: ['c-pop', 'chinese pop'],
        s: ['cantopop', 'mandopop']
    },
    French: {
        name: 'French',
        position: 34,
        mb: ['french', 'chanson française'],
        s: ['french']
    },
    Indian: {
        name: 'Indian',
        position: 35,
        mb: ['indian'],
        s: ['indian']
    },
    'J-Pop': {
        name: 'J-Pop',
        position: 36,
        mb: ['j-pop'],
        s: ['j-pop', 'j-dance', 'j-idol', 'j-rock']
    },
    'K-Pop': {
        name: 'K-Pop',
        position: 37,
        mb: ['k-pop', 'korean pop'],
        s: ['k-pop']
    },
    Latin: {
        name: 'Latin',
        position: 38,
        mb: ['latin'],
        s: ['latin', 'latino', 'salsa', 'tango']
    },
    'World Music': {
        name: 'World Music',
        position: 39,
        mb: ['world', 'world music'],
        s: ['world-music']
    }
};

module.exports = {
    genreMap,
};
