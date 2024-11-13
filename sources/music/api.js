const axios = require('axios');
const jwt = require('jsonwebtoken');
const { loadScriptEnv } = require('../../services/shared');

loadScriptEnv();

const config = {
    base_url: 'https://api.music.apple.com/v1',
    batch_size: 25,
    keys: {
        team_id: process.env.APPLE_TEAM_ID,
        key_id: process.env.APPLE_MUSIC_KEY_ID,
        private_key: process.env.APPLE_MUSIC_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    request_timeout: 30000,
};

const api = {
    client: null,
    setClient: function () {
        const token = jwt.sign({}, config.keys.private_key, {
            algorithm: 'ES256',
            expiresIn: '12h',
            issuer: config.keys.team_id,
            header: {
                alg: 'ES256',
                kid: config.keys.key_id,
            },
        });

        this.client = axios.create({
            baseURL: config.base_url,
            timeout: config.request_timeout,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
    },
    makeRequest: async function (endpoint, params, retries = 3) {
        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                let response = await this.client.get(endpoint, params || {});
                return response.data;
            } catch (error) {
                lastError = error;

                if (error.response?.status === 429) {
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }

                if (error.response?.status === 401) {
                    api.setClient();
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    },
};

module.exports = {
    api,
    config
};