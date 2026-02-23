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
    const saveBtn = document.getElementById('save-settings');
    const status = document.getElementById('status');
    const toggleAi = document.getElementById('toggle-ai');
    const toggleQr = document.getElementById('toggle-qr');

    // Load saved settings
    chrome.storage.sync.get([
        'aiProvider',
        'groqApiKey', 'groqModel',
        'openrouterApiKey', 'openrouterModel',
        'summaryLanguage', 'summaryMaxLength',
        'showAi', 'showQr'
    ], (items) => {
        if (items.aiProvider) providerSelect.value = items.aiProvider;
        if (items.groqApiKey) groqApiKeyInput.value = items.groqApiKey;
        if (items.groqModel) groqModelInput.value = items.groqModel;
        if (items.openrouterApiKey) openRouterApiKeyInput.value = items.openrouterApiKey;
        if (items.openrouterModel) openRouterModelInput.value = items.openrouterModel;
        if (items.summaryLanguage) summaryLanguageInput.value = items.summaryLanguage;
        if (items.summaryMaxLength) summaryMaxLengthInput.value = items.summaryMaxLength;

        toggleAi.checked = items.showAi !== false;
        toggleQr.checked = items.showQr !== false;
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
        const showAi = toggleAi.checked;
        const showQr = toggleQr.checked;

        chrome.storage.sync.set({
            aiProvider,
            groqApiKey,
            groqModel,
            openrouterApiKey,
            openrouterModel,
            summaryLanguage,
            summaryMaxLength,
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
