document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    });

    const providerSelect = document.getElementById('ai-provider');
    const apiKeyInput = document.getElementById('api-key');
    const modelInput = document.getElementById('ai-model');
    const slackWebhookInput = document.getElementById('slack-webhook');
    const saveBtn = document.getElementById('save-settings');
    const status = document.getElementById('status');

    // Button checkboxes
    const btnChecks = {
        markdown: document.getElementById('btn-markdown'),
        backlog: document.getElementById('btn-backlog'),
        scrapbox: document.getElementById('btn-scrapbox'),
        onlyUrl: document.getElementById('btn-onlyUrl')
    };

    // Load saved settings
    chrome.storage.sync.get(['aiProvider', 'apiKey', 'aiModel', 'slackWebhook', 'enabledButtons'], (items) => {
        if (items.aiProvider) providerSelect.value = items.aiProvider;
        if (items.apiKey) apiKeyInput.value = items.apiKey;
        if (items.aiModel) modelInput.value = items.aiModel;
        if (items.slackWebhook) slackWebhookInput.value = items.slackWebhook;

        if (items.enabledButtons) {
            Object.keys(btnChecks).forEach(key => {
                btnChecks[key].checked = items.enabledButtons[key] !== false;
            });
        }
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const aiProvider = providerSelect.value;
        const apiKey = apiKeyInput.value;
        const aiModel = modelInput.value;
        const slackWebhook = slackWebhookInput.value;

        const enabledButtons = {};
        Object.keys(btnChecks).forEach(key => {
            enabledButtons[key] = btnChecks[key].checked;
        });

        chrome.storage.sync.set({
            aiProvider,
            apiKey,
            aiModel,
            slackWebhook,
            enabledButtons
        }, () => {
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);
        });
    });
});
