const {
    loadScriptEnv,
} = require('./shared');

loadScriptEnv();

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

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

    }
};