const axios = require('axios');
const jwt = require('jsonwebtoken');
const { loadScriptEnv, joinPaths, sleep, timeNow } = require('../../services/shared');
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
            this.token.expiry = timeNow() + response.data.expires_in * 1000;

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
            if (!this.token.value || timeNow() >= this.token.expiry) {
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
                interval: 1000,
                minRemaining: 400,
                maxRetries: 5,
                baseDelay: 1000,
            },
        },
        makeRequest: async function (endpoint, params = {}, retries = 5) {
            const rateLimitState = {
                limit: null,
                remaining: null,
                reset: null,
                lastRequestTime: 0,
            };

            async function handleRateLimit(headers) {
                rateLimitState.limit = parseInt(headers['x-ratelimit-limit']);
                rateLimitState.remaining = parseInt(headers['x-ratelimit-remaining']);
                rateLimitState.reset = parseInt(headers['x-ratelimit-reset']);

                console.log({
                    limit: rateLimitState.limit,
                    remaining: rateLimitState.remaining,
                    reset: rateLimitState.reset
                });

                // If we're running low on remaining requests, calculate delay
                if (rateLimitState.remaining < api.mb.config.rateLimit.minRemaining) {
                    const now = timeNow();
                    const resetTime = rateLimitState.reset * 1000; // Convert to milliseconds
                    const timeUntilReset = resetTime - now;

                    if (timeUntilReset > 0) {
                        const delayNeeded = Math.ceil(timeUntilReset / rateLimitState.remaining);
                        console.log(`Rate limit running low. Delaying ${delayNeeded}ms between requests`);
                        await sleep(delayNeeded);
                    }
                }

                // Ensure minimum delay between requests
                const now = timeNow();
                const timeSinceLastRequest = now - rateLimitState.lastRequestTime;
                if (timeSinceLastRequest < api.mb.config.rateLimit.interval) {
                    await sleep(api.mb.config.rateLimit.interval - timeSinceLastRequest);
                }
                rateLimitState.lastRequestTime = timeNow();
            }

            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const response = await axios.get(
                        joinPaths(api.mb.config.baseUrl, endpoint),
                        {
                            params: {
                                fmt: 'json',
                                ...params,
                            },
                            headers: {
                                'User-Agent': `${packageData.productName}/${packageData.version} (${process.env.ADMIN_EMAIL})`,
                            },
                            // Add timeout to prevent hanging
                            timeout: 30000,
                        }
                    );

                    // Update rate limit state and handle delays
                    await handleRateLimit(response.headers);

                    return response.data;

                } catch (error) {
                    const isLastAttempt = attempt === retries - 1;

                    // Log the error with attempt number
                    console.error(`Request failed (attempt ${attempt + 1}/${retries}):`, {
                        endpoint,
                        status: error.response?.status,
                        message: error.message,
                    });

                    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                        console.log('Connection reset or timeout, retrying after delay...');
                        await sleep(api.mb.config.rateLimit.baseDelay * Math.pow(2, attempt));
                        continue;
                    }

                    if (error.response?.status === 429) {
                        const retryAfter = parseInt(error.response.headers['retry-after']) ||
                            Math.pow(2, attempt) * api.mb.config.rateLimit.baseDelay;
                        console.log(`Rate limit exceeded. Waiting ${retryAfter}ms before retry...`);
                        await sleep(retryAfter);
                        continue;
                    }

                    if (error.response?.status === 503) {
                        const backoffDelay = api.mb.config.rateLimit.baseDelay * Math.pow(2, attempt);
                        console.log(`Service unavailable. Backing off for ${backoffDelay}ms...`);
                        await sleep(backoffDelay);
                        continue;
                    }

                    // If we've exhausted all retries or hit a different error, throw
                    if (isLastAttempt) {
                        throw new Error(`MusicBrainz API error (${error.response?.status || error.code}): ${error.message}`);
                    }

                    console.log(`MusicBrainz API error (${error.response?.status || error.code}): ${error.message}`);
                    continue;
                }
            }

            throw new Error(`Failed after ${retries} retries`);
        },
    },
};

module.exports = {
    api,
};
