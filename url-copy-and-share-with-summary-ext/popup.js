const AMAZON_HOST = "www.amazon.co.jp";

// Internal State
let lastSummary = "";
let lastSummaryX = "";

const copyText = async text => {
    try {
        await navigator.clipboard.writeText(text);
        showCopied();
    } catch (err) {
        const copyTextArea = document.querySelector("#copy-textarea");
        copyTextArea.value = text;
        copyTextArea.style.display = "block";
        copyTextArea.select();
        document.execCommand('copy');
        copyTextArea.style.display = "none";
        showCopied();
    }
}

const extractAmazonUrl = rawUrl => {
    try {
        const url = new URL(rawUrl);
        if (url.host == AMAZON_HOST && url.pathname.match(/\/dp\/[A-Za-z0-9]/)) {
            return url.origin + url.pathname.replace(/(^\S+)(\/dp\/[A-Za-z0-9]{10})(.*)/, '$2');
        }
    } catch (e) { }
    return rawUrl;
}

const showCopied = _ => {
    const copied = document.querySelector("#copied");
    copied.classList.remove("fadeout");
    setTimeout(_ => copied.classList.add("fadeout"), 300);
}

const getUrlData = async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return null;

    return {
        url: extractAmazonUrl(tab.url),
        title: tab.title,
        rawUrl: tab.url,
        tabId: tab.id,
        isShareable: tab.url.startsWith('http')
    };
}

const generatePreviewText = (title, url) => {
    let parts = [];
    const isSummaryChecked = document.getElementById('opt-summary').checked;
    const isSummaryXChecked = document.getElementById('opt-summary-x').checked;
    const isTitleChecked = document.getElementById('opt-title').checked;
    const isHashtagsChecked = document.getElementById('opt-hashtags').checked;

    if (isSummaryChecked && lastSummary) {
        parts.push(lastSummary);
        if (isTitleChecked || isSummaryXChecked) parts.push("-");
    }

    if (isSummaryXChecked && lastSummaryX) {
        parts.push(lastSummaryX);
        if (isTitleChecked) parts.push("-");
    }

    if (isTitleChecked) {
        parts.push(title);
    }

    parts.push(url);

    if (isHashtagsChecked) {
        parts.push("#URLCopyAndShare");
    }

    const useNewline = document.getElementById('opt-newline').checked;
    return parts.join(useNewline ? "\n" : " ");
}

const updatePreview = (title, url) => {
    const text = generatePreviewText(title, url);
    const previewArea = document.getElementById('share-preview');
    previewArea.value = text;

    // Update char count
    document.getElementById('char-count').textContent = text.length;
}

const updateVisibilityUI = (settings, isShareable) => {
    const providerSelect = document.getElementById('popup-ai-provider');

    // Filter providers based on API settings
    const groqEnabled = !!settings.groqApiKey;
    const openrouterEnabled = !!settings.openrouterApiKey;

    Array.from(providerSelect.options).forEach(opt => {
        if (opt.value === 'groq') opt.hidden = !groqEnabled;
        if (opt.value === 'openrouter') opt.hidden = !openrouterEnabled;
    });

    // If current selected is hidden, switch to the first visible one
    if (providerSelect.selectedOptions[0].hidden) {
        const firstVisible = Array.from(providerSelect.options).find(opt => !opt.hidden);
        if (firstVisible) providerSelect.value = firstVisible.value;
    }

    const selectedProvider = providerSelect.value;
    const apiKey = selectedProvider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;

    const hasApiKey = !!apiKey;
    const showAi = settings.showAi !== false;
    const showQr = settings.showQr !== false;

    // AI Sections
    const aiSections = document.querySelectorAll('.ai-section');
    aiSections.forEach(sec => sec.style.display = (showAi) ? 'block' : 'none');

    // QR Section
    const qrSection = document.getElementById('tools-section');
    qrSection.style.display = (showQr) ? 'block' : 'none';

    // Checkboxes (Active only if relevant data/API exists)
    const optSummary = document.getElementById('opt-summary');
    optSummary.disabled = !isShareable || !lastSummary;

    const optSummaryX = document.getElementById('opt-summary-x');
    optSummaryX.disabled = !isShareable || !lastSummaryX;

    const optHashtags = document.getElementById('opt-hashtags');
    optHashtags.disabled = !isShareable;

    // Summarize Button
    const summarizeBtn = document.getElementById('summarize');
    summarizeBtn.disabled = !hasApiKey || !isShareable;
}

const downloadCanvas = (canvas, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

const onInit = async () => {
    // Localization
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });

    const data = await getUrlData();
    if (!data) return;

    const settings = await chrome.storage.sync.get([
        'aiProvider',
        'groqApiKey', 'groqModel',
        'openrouterApiKey', 'openrouterModel',
        'summaryLanguage', 'summaryMaxLength',
        'showAi', 'showQr'
    ]);

    const providerSelect = document.getElementById('popup-ai-provider');
    if (settings.aiProvider) providerSelect.value = settings.aiProvider;

    // Default Selection
    document.getElementById('opt-title').checked = true;

    updateVisibilityUI(settings, data.isShareable);
    updatePreview(data.title, data.url);

    // Event Listeners
    providerSelect.onchange = () => {
        updateVisibilityUI(settings, data.isShareable);
        chrome.storage.sync.set({ aiProvider: providerSelect.value });
    };

    document.querySelectorAll('.checkbox-item input').forEach(input => {
        input.onchange = () => {
            updatePreview(data.title, data.url);
            updateVisibilityUI(settings, data.isShareable);
        };
    });

    document.getElementById('copy-clipboard').onclick = () => {
        const text = document.getElementById('share-preview').value;
        copyText(text);
    };

    // AI Summary
    document.getElementById("summarize").onclick = async () => {
        const btn = document.getElementById("summarize");
        const area = document.getElementById("summary-text");
        const resDiv = document.getElementById("ai-result");
        const xMode = document.getElementById("opt-x-mode").checked;

        const provider = providerSelect.value;
        const apiKey = provider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
        const model = provider === 'groq' ? (settings.groqModel || 'llama-3.1-8b-instant') : (settings.openrouterModel || 'openai/gpt-4o-mini');
        const language = settings.summaryLanguage || 'Japanese';

        let maxLength = settings.summaryMaxLength || 200;

        if (xMode) {
            // Precise X limit calculation
            const urlLen = 23;
            const hashtagLen = document.getElementById('opt-hashtags').checked ? 16 : 0;
            const titleLen = document.getElementById('opt-title').checked ? data.title.length : 0;
            const separatorLen = 4; // separators for (summary, summaryX, title, url, hashtags)
            const fixedPartsLen = urlLen + hashtagLen + titleLen + separatorLen;
            maxLength = Math.max(10, 140 - fixedPartsLen - 2);
        }

        btn.disabled = true;
        resDiv.style.display = "block";
        area.value = chrome.i18n.getMessage("summarizing");

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: data.tabId },
                func: () => document.body.innerText,
            });
            const summary = await window.aiService.getSummary(results[0].result, provider, apiKey, model, language, maxLength);
            area.value = summary;

            if (xMode) {
                lastSummaryX = summary;
                document.getElementById('opt-summary-x').checked = true;
            } else {
                lastSummary = summary;
                document.getElementById('opt-summary').checked = true;
            }

            updateVisibilityUI(settings, data.isShareable);
            updatePreview(data.title, data.url);
        } catch (e) {
            area.value = "Error: " + e.message;
        } finally {
            btn.disabled = false;
        }
    };

    // Eye-catch
    document.getElementById("generate-image").onclick = () => {
        const canvas = document.getElementById("eyecatch-canvas");
        const template = document.getElementById("eyecatch-template").value;
        document.getElementById("eyecatch-preview").style.display = "block";
        window.imageService.generateEyeCatch(canvas, data.title, data.url, template);
    };

    document.getElementById("download-eyecatch").onclick = () => {
        const canvas = document.getElementById("eyecatch-canvas");
        downloadCanvas(canvas, `eyecatch-${Date.now()}.png`);
    };

    // QR Code
    if (settings.showQr !== false) {
        new QRCode(document.getElementById("qrcode"), {
            text: data.rawUrl,
            width: 128,
            height: 128,
            correctLevel: QRCode.CorrectLevel.L
        });
    }
}

document.addEventListener("DOMContentLoaded", onInit);
