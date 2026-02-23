document.addEventListener('DOMContentLoaded', () => {
    const providerSelect = document.getElementById('ai-provider');
    const apiKeyInput = document.getElementById('api-key');
    const modelInput = document.getElementById('ai-model');
    const saveBtn = document.getElementById('save-settings');
    const status = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get(['aiProvider', 'apiKey', 'aiModel'], (items) => {
        if (items.aiProvider) providerSelect.value = items.aiProvider;
        if (items.apiKey) apiKeyInput.value = items.apiKey;
        if (items.aiModel) modelInput.value = items.aiModel;
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const aiProvider = providerSelect.value;
        const apiKey = apiKeyInput.value;
        const aiModel = modelInput.value;

        chrome.storage.sync.set({
            aiProvider,
            apiKey,
            aiModel
        }, () => {
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);
        });
    });
});
