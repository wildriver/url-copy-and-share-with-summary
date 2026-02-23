const getSummary = async (text, provider, apiKey, model, language = 'Japanese', maxLength = 200) => {
    // If parameters aren't provided, fetch from storage as fallback
    if (!provider || !apiKey || !model) {
        const settings = await chrome.storage.sync.get([
            'aiProvider',
            'groqApiKey', 'groqModel',
            'openrouterApiKey', 'openrouterModel',
            'summaryLanguage', 'summaryMaxLength'
        ]);
        provider = provider || settings.aiProvider || 'groq';
        language = language || settings.summaryLanguage || 'Japanese';
        maxLength = maxLength || settings.summaryMaxLength || 200;

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

    const prompt = `Summarize the following text in ${language}. THE SUMMARY MUST BE UNDER ${maxLength} CHARACTERS. Keep it concise and catchy for a social media post. DO NOT include any introductory text, just the summary itself.\n\nText: ${text.substring(0, 5000)}`;

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

window.aiService = { getSummary };
