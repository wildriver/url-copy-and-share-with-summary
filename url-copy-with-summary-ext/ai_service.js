const callAi = async (prompt, provider, apiKey, model) => {
    if (!provider || !apiKey || !model) {
        const settings = await chrome.storage.sync.get([
            'aiProvider',
            'groqApiKey', 'groqModel',
            'openrouterApiKey', 'openrouterModel'
        ]);
        provider = provider || settings.aiProvider || 'groq';

        if (provider === 'groq') {
            apiKey = apiKey || settings.groqApiKey;
            model = model || settings.groqModel || 'llama-3.1-8b-instant';
        } else {
            apiKey = apiKey || settings.openrouterApiKey;
            model = model || settings.openrouterModel || 'openai/gpt-4o-mini';
        }
    }

    if (!apiKey) {
        throw new Error('API Key is missing for ' + provider + '. Please set it in Settings.');
    }

    const providerUrl = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const response = await fetch(providerUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`AI API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
};

const getSummary = async (text, provider, apiKey, model, language = 'Japanese', maxLength = 200) => {
    const prompt = `Summarize the following text in ${language}. THE SUMMARY MUST BE UNDER ${maxLength} CHARACTERS. Keep it concise and catchy for a social media post. DO NOT include any introductory text, just the summary itself.\n\nText: ${text.substring(0, 5000)}`;
    return callAi(prompt, provider, apiKey, model);
};

const getCatchyTitle = async (title, provider, apiKey, model, language = 'Japanese') => {
    const prompt = `Create a short, impactful, and catchy title for a social media eye-catch image based on this page title: "${title}". Use ${language}. THE TITLE MUST BE UNDER 30 CHARACTERS and VERY STRIKING. DO NOT include any introductory text, quotes, or punctuation unless essential. Just the title itself.`;
    return callAi(prompt, provider, apiKey, model);
};

const getKeywords = async (text, provider, apiKey, model, language = 'Japanese') => {
    const prompt = `Extract exactly 3 highly relevant and trending hashtags from the following text in ${language}. THE HASHTAGS MUST BE REPRESENTATIVE OF THE CONTENT. Format the output only as hashtags separated by spaces (e.g., #Apple #iPhone #Technology). DO NOT include any other text.\n\nText: ${text.substring(0, 5000)}`;
    return callAi(prompt, provider, apiKey, model);
};

window.aiService = { getSummary, getCatchyTitle, getKeywords };
