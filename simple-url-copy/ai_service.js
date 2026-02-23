const getSummary = async (text) => {
    const settings = await chrome.storage.sync.get(['aiProvider', 'apiKey', 'aiModel']);
    const { aiProvider, apiKey, aiModel } = settings;

    if (!apiKey) {
        throw new Error('API Key is missing. Please set it in the Settings page.');
    }

    const providerUrl = aiProvider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

    const model = aiModel || (aiProvider === 'groq' ? 'llama3-8b-8192' : 'openai/gpt-3.5-turbo');

    const prompt = `Summarize the following text in a few sentences. Keep it concise for a social media post.\n\nText: ${text.substring(0, 5000)}`;

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

// Exporting for use in popup.js
window.aiService = { getSummary };
