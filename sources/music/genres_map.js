// Mapping between Apple genres and MusicBrainz genres/tags
const genreMap = {
    "Alternative": ["alternative", "alternative rock"],
    "Blues": ["blues"],
    "Classical": ["classical"],
    "Dance": ["dance", "electronic dance music"],
    "Electronic": ["electronic", "electronica"],
    "Hip-Hop/Rap": ["hip hop", "rap"],
    "Jazz": ["jazz"],
    "Metal": ["metal", "heavy metal"],
    "Pop": ["pop"],
    "R&B/Soul": ["r&b", "rhythm and blues", "soul"],
    "Reggae": ["reggae"],
    "Rock": ["rock"],
    "Indie Rock": ["indie rock", "indie"],
    "Soul": ["soul", "soul music", "northern soul"],
    "Punk": ["punk", "punk rock"],
    "Hard Rock": ["hard rock"],

    // Regional/Cultural Music
    "Brazilian": {
        "main": ["brazilian"],
        "subgenres": {
            "Baile Funk": ["funk carioca", "brazilian funk"],
            "Bossa Nova": ["bossa nova"],
            "Forró": ["forró"],
            "MPB": ["música popular brasileira", "mpb"],
            "Samba": ["samba"],
            "Sertanejo": ["sertanejo"]
        }
    },

    "Indian": {
        "main": ["indian"],
        "subgenres": {
            "Bollywood": ["bollywood", "filmi"],
            "Devotional & Spiritual": ["bhajan", "indian devotional"],
            "Indian Classical": ["indian classical", "carnatic", "hindustani"],
            "Indian Pop": ["indian pop"],
            "Regional Indian": ["regional indian"],
            "Tamil": ["tamil"],
            "Telugu": ["telugu"]
        }
    },

    "African": {
        "main": ["african", "african traditional"],
        "subgenres": {
            "Afrobeats": ["afrobeats"],
            "Afrikaans": ["afrikaans"],
            "Amapiano": ["amapiano"],
        }
    },

    // East Asian Music
    "C-Pop": ["c-pop", "chinese pop"],
    "K-Pop": ["k-pop", "korean pop"],
    "廣東歌/香港流行樂": ["cantopop"],
    "國語流行樂": ["mandopop"],
    "日本流行樂": ["j-pop"],
    "アニメ": ["anime"],
    "演歌": ["enka"],
    "歌謡曲": ["kayōkyoku"],

    // Other Categories
    "Children's Music": ["children's music", "children"],
    "Christian": ["christian", "christian music"],
    "Christmas": ["christmas", "christmas music"],
    "Country": ["country"],
    "Latin": ["latin"],
    "Musique francophone": ["french", "chanson française"],
    "Schlager": ["schlager"],
    "Singer/Songwriter": ["singer-songwriter"],
    "Soundtrack": ["soundtrack", "film score"],
    "Worldwide": ["world", "world music"]
}

module.exports = {
    genreMap
}
