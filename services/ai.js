const {
    loadScriptEnv, timeNow, sleep,
} = require('./shared');

loadScriptEnv();

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const axios = require('axios');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const deepInfra = new OpenAI({
    baseURL: 'https://api.deepinfra.com/v1/openai',
    apiKey: process.env.DEEP_INFRA_KEY,
});

module.exports = {
    dinfra: {
        promptJSON: function(prompt) {
            return new Promise(async (resolve, reject) => {
                try {
                    const completion = await deepInfra.chat.completions.create({
                        messages: [{ role: 'user', content: prompt }],
                        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
                    });

                    let response = completion.choices[0].message.content;

                    // Handle potential text before/after JSON
                    response = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

                    const results = JSON.parse(response);

                    resolve(results);
                } catch(e) {
                    return reject(e);
                }
            });
        }
    },
    claude: {
        prompt: function(prompt, max_tokens = null) {
            return new Promise(async (resolve, reject) => {
                if(typeof prompt === 'object') {
                    prompt = JSON.stringify(prompt);
                }

                let tokens = {
                    input: 0,
                    cache_input: 0,
                    cache_read_input: 0,
                    output: 0
                }

                try {
                    const response = await axios({
                        method: 'post',
                        url: 'https://api.anthropic.com/v1/messages',
                        headers: {
                            'content-type': 'application/json',
                            'x-api-key': process.env.ANTHROPIC_API_KEY,
                            'anthropic-version': '2023-06-01',
                        },
                        data: {
                            model: 'claude-3-5-sonnet-20241022',
                            max_tokens: max_tokens || 2048,
                            system: [
                            ],
                            messages: [
                                {
                                    role: 'user',
                                    content: prompt,
                                },
                            ],
                        },
                    });

                    tokens.input += response.data.usage.input_tokens;
                    tokens.cache_input += response.data.usage.cache_creation_input_tokens;
                    tokens.cache_read_input += response.data.usage.cache_read_input_tokens;
                    tokens.output += response.data.usage.output_tokens;

                    const results = JSON.parse(response.data.content[0].text);

                    resolve(results);
                } catch (error) {
                    return reject(error);
                }
            });
        },
        promptCache: function(cached_data, prompt) {
            return new Promise(async (resolve, reject) => {
                if(typeof cached_data === 'object') {
                    cached_data = JSON.stringify(cached_data);
                }

                if(typeof prompt === 'object') {
                    prompt = JSON.stringify(prompt);
                }

                let tokens = {
                    input: 0,
                    cache_input: 0,
                    cache_read_input: 0,
                    output: 0
                }

                try {
                    const response = await axios({
                        method: 'post',
                        url: 'https://api.anthropic.com/v1/messages',
                        headers: {
                            'content-type': 'application/json',
                            'x-api-key': process.env.ANTHROPIC_API_KEY,
                            'anthropic-version': '2023-06-01',
                            'anthropic-beta': 'prompt-caching-2024-07-31',
                        },
                        data: {
                            model: 'claude-3-5-sonnet-20241022',
                            max_tokens: 2048,
                            system: [
                                {
                                    type: 'text',
                                    text: cached_data,
                                    cache_control: { type: 'ephemeral' },
                                },
                            ],
                            messages: [
                                {
                                    role: 'user',
                                    content: prompt,
                                },
                            ],
                        },
                    });

                    tokens.input += response.data.usage.input_tokens;
                    tokens.cache_input += response.data.usage.cache_creation_input_tokens;
                    tokens.cache_read_input += response.data.usage.cache_read_input_tokens;
                    tokens.output += response.data.usage.output_tokens;

                    const results = JSON.parse(response.data.content[0].text);

                    resolve(results);
                } catch (error) {
                    return reject(error);
                }
            });
        }
    }
};