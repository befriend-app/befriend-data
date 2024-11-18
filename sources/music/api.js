const axios = require('axios');
const jwt = require('jsonwebtoken');
const { loadScriptEnv, joinPaths, sleep } = require('../../services/shared');
const packageData = require('../../package.json');

loadScriptEnv();

const api = {
    spotify: {
        config: {
            base_url: 'https://api.spotify.com/v1',
            auth_url: 'https://accounts.spotify.com/api/token',
            batch_size: 50,
            request_timeout: 30000,
            keys: {
                client_id: process.env.SPOTIFY_CLIENT_ID,
                client_secret: process.env.SPOTIFY_CLIENT_SECRET,
            },
        },
        client: null,
        token: {
            value: null,
            expiry: null,
        },
        setClient: async function () {
            const auth = Buffer.from(
                `${this.config.keys.client_id}:${this.config.keys.client_secret}`,
            ).toString('base64');

            const response = await axios.post(
                this.config.auth_url,
                'grant_type=client_credentials',
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            this.token.value = response.data.access_token;
            this.token.expiry = Date.now() + response.data.expires_in * 1000;

            this.client = axios.create({
                baseURL: this.config.base_url,
                timeout: this.config.request_timeout,
                headers: {
                    Authorization: `Bearer ${this.token.value}`,
                    'Content-Type': 'application/json',
                },
            });
        },
        checkToken: async function () {
            if (!this.token.value || Date.now() >= this.token.expiry) {
                await this.setClient();
            }
        },
        makeRequest: async function (endpoint, params, retries = 3) {
            await this.checkToken();

            let lastError;

            for (let i = 0; i < retries; i++) {
                try {
                    let response = await this.client.get(endpoint, params || {});
                    return response.data;
                } catch (error) {
                    lastError = error;

                    if (error.response?.status === 429) {
                        const delay = Math.pow(2, i) * 1000;
                        await sleep(delay);
                        continue;
                    }

                    if (error.response?.status === 401) {
                        await this.setClient();
                        continue;
                    }

                    throw error;
                }
            }

            throw lastError;
        },
    },
    apple: {
        config: {
            base_url: 'https://api.music.apple.com/v1',
            batch_size: 25,
            keys: {
                team_id: process.env.APPLE_TEAM_ID,
                key_id: process.env.APPLE_MUSIC_KEY_ID,
                private_key: process.env.APPLE_MUSIC_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            request_timeout: 30000,
        },
        client: null,
        setClient: function () {
            const token = jwt.sign({}, this.config.keys.private_key, {
                algorithm: 'ES256',
                expiresIn: '12h',
                issuer: this.config.keys.team_id,
                header: {
                    alg: 'ES256',
                    kid: this.config.keys.key_id,
                },
            });

            this.client = axios.create({
                baseURL: this.config.base_url,
                timeout: this.config.request_timeout,
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
    },
    mb: {
        config: {
            baseUrl: 'https://musicbrainz.org/ws/2',
            batchSize: 100,
            rateLimit: {
                requests: 1,
                interval: 1000, // 1 request per second as per MusicBrainz guidelines
            },
        },
        makeRequest: async function (endpoint, params = {}, retries = 3) {
            let lastError;

            for (let i = 0; i < retries; i++) {
                try {
                    let response = await axios.get(joinPaths(api.mb.config.baseUrl, endpoint), {
                        params: {
                            fmt: 'json',
                            ...params,
                        },
                        headers: {
                            'User-Agent': `${packageData.productName}/${packageData.version} (${process.env.ADMIN_EMAIL})`,
                        },
                    });

                    let rateLimit = {
                        limit: parseInt(response.headers['x-ratelimit-limit']),
                        remaining: parseInt(response.headers['x-ratelimit-remaining']),
                        reset: parseInt(response.headers['x-ratelimit-reset']),
                    };

                    console.log(rateLimit);

                    if (rateLimit.remaining < 300) {
                        console.log('Slowing down for a moment...');
                        await sleep(1000);
                    }

                    return response.data;
                } catch (error) {
                    lastError = error;

                    if (error.response?.status === 429) {
                        const delay = Math.pow(2, i) * 1000;
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        continue;
                    }

                    throw error;
                }
            }

            throw lastError;
        },
    },
};

module.exports = {
    api,
};
