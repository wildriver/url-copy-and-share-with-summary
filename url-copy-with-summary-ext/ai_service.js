const callAiWithFallback = async (prompt, provider, apiKey, model) => {
    let settings = await chrome.storage.sync.get([
        'aiProvider',
        'groqApiKey', 'groqModel',
        'openrouterApiKey', 'openrouterModel'
    ]);

    let primaryProvider = provider || settings.aiProvider || 'groq';
    let primaryKey = apiKey || (primaryProvider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey);
    let primaryModel = model || (primaryProvider === 'groq' ? (settings.groqModel || 'llama-3.1-8b-instant') : (settings.openrouterModel || 'google/gemma-3-27b-it:free'));

    let secondaryProvider = primaryProvider === 'groq' ? 'openrouter' : 'groq';
    let secondaryKey = secondaryProvider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
    let secondaryModel = secondaryProvider === 'groq' ? (settings.groqModel || 'llama-3.1-8b-instant') : (settings.openrouterModel || 'google/gemma-3-27b-it:free');

    if (!primaryKey) {
        throw new Error('API Key is missing for ' + primaryProvider + '. Please set it in Settings.');
    }

    try {
        return await callSingleProvider(prompt, primaryProvider, primaryKey, primaryModel);
    } catch (error) {
        console.warn(`${primaryProvider} API failed: ${error.message}`);
        // If primary fails (including 429), and we have a secondary key, try the fallback
        if (secondaryKey && error.message.includes('429')) {
            console.log(`Fallback triggered. Trying ${secondaryProvider} API instead.`);
            return await callSingleProvider(prompt, secondaryProvider, secondaryKey, secondaryModel);
        }
        throw error;
    }
};

const callSingleProvider = async (prompt, provider, apiKey, model) => {
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
        const errorText = await response.text();
        throw new Error(`[${response.status}] AI API Error: ${errorText}`);
    }

    // Extract rate limits
    if (provider === 'groq') {
        const remaining = response.headers.get('x-ratelimit-remaining-requests');
        if (remaining) chrome.storage.local.set({ groqRemaining: remaining });
    } else if (provider === 'openrouter') {
        const remaining = response.headers.get('x-ratelimit-remaining'); // Note: OpenRouter doesn't always send this for free tiers, or it might be a different header depending on specific endpoint.
        if (remaining) {
            chrome.storage.local.set({ openrouterRemaining: remaining });
        } else {
            // Fallback for OpenRouter: Fetch from auth/key endpoint because CORS often hides the header
            fetch('https://openrouter.ai/api/v1/auth/key', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }).then(r => r.json()).then(authData => {
                if (authData && authData.data) {
                    const d = authData.data;
                    let rem = "";
                    if (typeof d.limit_remaining === 'number') {
                        rem = d.limit_remaining;
                    } else if (d.rate_limit && typeof d.rate_limit.requests === 'number') { // Fallback to RPM limit or similar if limit_remaining isn't there
                        rem = d.rate_limit.requests;
                    } else if (typeof d.limit === 'number' && typeof d.usage === 'number') {
                        rem = `$${(d.limit - d.usage).toFixed(4)}`;
                    }
                    if (rem !== "") {
                        chrome.storage.local.set({ openrouterRemaining: rem });
                    }
                }
            }).catch(e => console.error("Error fetching OpenRouter limit:", e));
        }
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
};

const getSummary = async (text, provider, apiKey, model, language = 'Japanese', maxLength = 200) => {
    const prompt = `Summarize the following text in ${language}. THE SUMMARY MUST BE UNDER ${maxLength} CHARACTERS. Keep it concise and catchy for a social media post. DO NOT include any introductory text, just the summary itself.\n\nText: ${text.substring(0, 5000)}`;
    return callAiWithFallback(prompt, provider, apiKey, model);
};

const getCatchyTitle = async (title, provider, apiKey, model, language = 'Japanese') => {
    const prompt = `Create a short, impactful, and catchy title for a social media eye-catch image based on this page title: "${title}". Use ${language}. THE TITLE MUST BE UNDER 30 CHARACTERS and VERY STRIKING. DO NOT include any introductory text, quotes, or punctuation unless essential. Just the title itself.`;
    return callAiWithFallback(prompt, provider, apiKey, model);
};

const getKeywords = async (text, provider, apiKey, model, language = 'Japanese') => {
    const prompt = `Extract exactly 3 highly relevant and trending hashtags from the following text in ${language}. THE HASHTAGS MUST BE REPRESENTATIVE OF THE CONTENT. Format the output only as hashtags separated by spaces (e.g., #Apple #iPhone #Technology). DO NOT include any other text.\n\nText: ${text.substring(0, 5000)}`;
    return callAiWithFallback(prompt, provider, apiKey, model);
};

window.aiService = { getSummary, getCatchyTitle, getKeywords };
