document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    });

    const providerSelect = document.getElementById('ai-provider');
    const groqApiKeyInput = document.getElementById('groq-api-key');
    const groqModelInput = document.getElementById('groq-model');
    const openRouterApiKeyInput = document.getElementById('openrouter-api-key');
    const openRouterModelInput = document.getElementById('openrouter-model');
    const summaryLanguageInput = document.getElementById('summary-language');
    const summaryMaxLengthInput = document.getElementById('summary-max-length');
    const slackWebhookInput = document.getElementById('slack-webhook');
    const saveBtn = document.getElementById('save-settings');
    const status = document.getElementById('status');
    const groqSuggestions = document.getElementById('groq-suggestions');
    const openRouterSuggestions = document.getElementById('openrouter-suggestions');

    const recommendedModels = {
        groq: [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma2-9b-it'
        ],
        openrouter: [
            'nvidia/nemotron-3-nano-30b-a3b:free',
            'google/gemini-flash-1.5-free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'openai/gpt-4o-mini'
        ]
    };

    const populateSuggestions = (provider, datalist) => {
        datalist.innerHTML = '';
        recommendedModels[provider].forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            datalist.appendChild(option);
        });
    };

    populateSuggestions('groq', groqSuggestions);
    populateSuggestions('openrouter', openRouterSuggestions);

    // Button checkboxes
    const btnChecks = {
        markdown: document.getElementById('btn-markdown'),
        backlog: document.getElementById('btn-backlog'),
        scrapbox: document.getElementById('btn-scrapbox'),
        onlyUrl: document.getElementById('btn-onlyUrl')
    };

    const toggleAi = document.getElementById('toggle-ai');
    const toggleQr = document.getElementById('toggle-qr');

    // Load saved settings
    chrome.storage.sync.get([
        'aiProvider',
        'groqApiKey', 'groqModel',
        'openrouterApiKey', 'openrouterModel',
        'summaryLanguage', 'summaryMaxLength',
        'slackWebhook', 'enabledButtons', 'showAi', 'showQr'
    ], (items) => {
        if (items.aiProvider) providerSelect.value = items.aiProvider;
        if (items.groqApiKey) groqApiKeyInput.value = items.groqApiKey;
        if (items.groqModel) groqModelInput.value = items.groqModel;
        if (items.openrouterApiKey) openRouterApiKeyInput.value = items.openrouterApiKey;
        if (items.openrouterModel) openRouterModelInput.value = items.openrouterModel;
        if (items.summaryLanguage) summaryLanguageInput.value = items.summaryLanguage;
        if (items.summaryMaxLength) summaryMaxLengthInput.value = items.summaryMaxLength;
        if (items.slackWebhook) slackWebhookInput.value = items.slackWebhook;

        toggleAi.checked = items.showAi !== false;
        toggleQr.checked = items.showQr !== false;

        if (items.enabledButtons) {
            Object.keys(btnChecks).forEach(key => {
                btnChecks[key].checked = items.enabledButtons[key] !== false;
            });
        }
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const aiProvider = providerSelect.value;
        const groqApiKey = groqApiKeyInput.value;
        const groqModel = groqModelInput.value;
        const openrouterApiKey = openRouterApiKeyInput.value;
        const openrouterModel = openRouterModelInput.value;
        const summaryLanguage = summaryLanguageInput.value;
        const summaryMaxLength = summaryMaxLengthInput.value;
        const slackWebhook = slackWebhookInput.value;
        const showAi = toggleAi.checked;
        const showQr = toggleQr.checked;

        const enabledButtons = {};
        Object.keys(btnChecks).forEach(key => {
            enabledButtons[key] = btnChecks[key].checked;
        });

        chrome.storage.sync.set({
            aiProvider,
            groqApiKey,
            groqModel,
            openrouterApiKey,
            openrouterModel,
            summaryLanguage,
            summaryMaxLength,
            slackWebhook,
            enabledButtons,
            showAi,
            showQr
        }, () => {
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);
        });
    });
});
