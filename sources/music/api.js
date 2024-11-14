const axios = require('axios');
const jwt = require('jsonwebtoken');
const { loadScriptEnv, joinPaths, sleep } = require('../../services/shared');
const package = require('../../package.json');

loadScriptEnv();

const api = {
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
                interval: 1000 // 1 request per second as per MusicBrainz guidelines
            }
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
                            'User-Agent': `${package.productName}/${package.version} (${process.env.ADMIN_EMAIL})`
                        }
                    });

                    let rateLimit = {
                        limit: parseInt(response.headers['x-ratelimit-limit']),
                        remaining: parseInt(response.headers['x-ratelimit-remaining']),
                        reset: parseInt(response.headers['x-ratelimit-reset']),
                    };

                    console.log(rateLimit);

                    if(rateLimit.remaining < 300) {
                        console.log("Slowing down for a moment...");
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
        }
    }
};

module.exports = {
    api,
};