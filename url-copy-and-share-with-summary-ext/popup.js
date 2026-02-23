const AMAZON_HOST = "www.amazon.co.jp";

// Internal State
let lastSummary = "";
let lastSummaryX = "";
let lastKeywords = "";
let isSummarizing = false;
let isGeneratingKeywords = false;

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

    if (isSummaryChecked) {
        if (lastSummary) {
            parts.push(lastSummary);
            if (isTitleChecked || isSummaryXChecked) parts.push("-");
        } else if (isSummarizing) {
            parts.push(`[${chrome.i18n.getMessage("summarizing")}]`);
        }
    }

    if (isSummaryXChecked) {
        if (lastSummaryX) {
            parts.push(lastSummaryX);
            if (isTitleChecked) parts.push("-");
        } else if (isSummarizing) {
            parts.push(`[${chrome.i18n.getMessage("summarizing")} (X)]`);
        }
    }

    if (isTitleChecked) {
        parts.push(title);
    }

    parts.push(url);

    if (isHashtagsChecked) {
        if (lastKeywords) {
            parts.push(lastKeywords);
        } else if (isGeneratingKeywords) {
            parts.push("[Generating hashtags...]");
        }
    }

    const useNewline = document.getElementById('opt-newline').checked;
    return parts.join(useNewline ? "\n" : " ");
}

const updatePreview = (title, url) => {
    const text = generatePreviewText(title, url);
    const previewArea = document.getElementById('share-preview');
    previewArea.value = text;
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

    if (providerSelect.selectedOptions[0].hidden) {
        const firstVisible = Array.from(providerSelect.options).find(opt => !opt.hidden);
        if (firstVisible) providerSelect.value = firstVisible.value;
    }

    const selectedProvider = providerSelect.value;
    const apiKey = selectedProvider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
    const hasApiKey = !!apiKey;
    const showAi = settings.showAi !== false;
    const showQr = settings.showQr !== false;

    const aiSections = document.querySelectorAll('.ai-section');
    aiSections.forEach(sec => sec.style.display = (showAi) ? 'block' : 'none');

    const qrSection = document.getElementById('tools-section');
    qrSection.style.display = (showQr) ? 'block' : 'none');

    // Enable checkboxes if API key is present
    const optSummary = document.getElementById('opt-summary');
    optSummary.disabled = !isShareable || !hasApiKey;

    const optSummaryX = document.getElementById('opt-summary-x');
    optSummaryX.disabled = !isShareable || !hasApiKey;

    const optEyecatchAi = document.getElementById('opt-eyecatch-ai');
    optEyecatchAi.disabled = !isShareable || !hasApiKey;

    const optHashtags = document.getElementById('opt-hashtags');
    optHashtags.disabled = !isShareable || !hasApiKey;

    const summarizeBtn = document.getElementById('summarize');
    summarizeBtn.disabled = !hasApiKey || !isShareable;

    const generateImageBtn = document.getElementById('generate-image');
    generateImageBtn.disabled = !isShareable;
    if (!hasApiKey && document.getElementById('opt-eyecatch-ai').checked) {
        document.getElementById('opt-eyecatch-ai').checked = false;
    }
}

const downloadCanvas = (canvas, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

const onInit = async () => {
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

    document.getElementById('opt-title').checked = true;

    updateVisibilityUI(settings, data.isShareable);
    updatePreview(data.title, data.url);

    const triggerSummarize = async (targetXMode = false) => {
        if (isSummarizing) return;

        const btn = document.getElementById("summarize");
        const area = document.getElementById("summary-text");
        const resDiv = document.getElementById("ai-result");

        const provider = providerSelect.value;
        const apiKey = provider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
        const model = provider === 'groq' ? (settings.groqModel || 'llama-3.1-8b-instant') : (settings.openrouterModel || 'openai/gpt-4o-mini');
        const language = settings.summaryLanguage || 'Japanese';

        let maxLength = settings.summaryMaxLength || 200;

        if (targetXMode) {
            const urlLen = 23;
            // Keywords length estimate
            const hashtagLen = lastKeywords ? lastKeywords.length : 30;
            const titleLen = document.getElementById('opt-title').checked ? data.title.length : 0;
            const separatorLen = 4;
            const fixedPartsLen = urlLen + hashtagLen + titleLen + separatorLen;
            maxLength = Math.max(10, 140 - fixedPartsLen - 2);
            document.getElementById("opt-x-mode").checked = true;
        } else {
            document.getElementById("opt-x-mode").checked = false;
        }

        isSummarizing = true;
        btn.disabled = true;
        resDiv.style.display = "block";
        area.value = chrome.i18n.getMessage("summarizing");
        updatePreview(data.title, data.url);

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: data.tabId },
                func: () => document.body.innerText,
            });
            const summary = await window.aiService.getSummary(results[0].result, provider, apiKey, model, language, maxLength);
            area.value = summary;

            if (targetXMode) {
                lastSummaryX = summary;
                document.getElementById('opt-summary-x').checked = true;
            } else {
                lastSummary = summary;
                document.getElementById('opt-summary').checked = true;
            }
        } catch (e) {
            area.value = "Error: " + e.message;
        } finally {
            isSummarizing = false;
            btn.disabled = false;
            updateVisibilityUI(settings, data.isShareable);
            updatePreview(data.title, data.url);
        }
    };

    const triggerKeywords = async () => {
        if (isGeneratingKeywords || lastKeywords) return;

        isGeneratingKeywords = true;
        updatePreview(data.title, data.url);

        try {
            const provider = providerSelect.value;
            const apiKey = provider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
            const model = provider === 'groq' ? (settings.groqModel || 'llama-3.1-8b-instant') : (settings.openrouterModel || 'openai/gpt-4o-mini');
            const language = settings.summaryLanguage || 'Japanese';

            const results = await chrome.scripting.executeScript({
                target: { tabId: data.tabId },
                func: () => document.body.innerText,
            });
            lastKeywords = await window.aiService.getKeywords(results[0].result, provider, apiKey, model, language);
        } catch (e) {
            console.error("Keyword Error:", e);
            lastKeywords = "#Article";
        } finally {
            isGeneratingKeywords = false;
            updatePreview(data.title, data.url);
        }
    };

    // Event Listeners
    providerSelect.onchange = () => {
        updateVisibilityUI(settings, data.isShareable);
        chrome.storage.sync.set({ aiProvider: providerSelect.value });
    };

    document.querySelectorAll('.checkbox-item input').forEach(input => {
        input.onchange = () => {
            if (input.id === 'opt-summary' && input.checked && !lastSummary) {
                triggerSummarize(false);
            } else if (input.id === 'opt-summary-x' && input.checked && !lastSummaryX) {
                triggerSummarize(true);
            } else if (input.id === 'opt-hashtags' && input.checked && !lastKeywords) {
                triggerKeywords();
            } else {
                updatePreview(data.title, data.url);
                updateVisibilityUI(settings, data.isShareable);
            }
        };
    });

    document.getElementById('copy-clipboard').onclick = () => {
        const text = document.getElementById('share-preview').value;
        copyText(text);
    };

    document.getElementById("summarize").onclick = () => {
        const xMode = document.getElementById("opt-x-mode").checked;
        triggerSummarize(xMode);
    };

    // Eye-catch
    document.getElementById("generate-image").onclick = async () => {
        const btn = document.getElementById("generate-image");
        const canvas = document.getElementById("eyecatch-canvas");
        const template = document.getElementById("eyecatch-template").value;
        const aiAssist = document.getElementById("opt-eyecatch-ai").checked;

        let displayTitle = data.title;

        if (aiAssist) {
            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = chrome.i18n.getMessage("summarizing");

            try {
                const provider = providerSelect.value;
                const apiKey = provider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;
                const model = provider === 'groq' ? (settings.groqModel || 'llama-3.1-8b-instant') : (settings.openrouterModel || 'openai/gpt-4o-mini');
                const language = settings.summaryLanguage || 'Japanese';

                displayTitle = await window.aiService.getCatchyTitle(data.title, provider, apiKey, model, language);
            } catch (e) {
                console.error("AI Assist Title Error:", e);
                // Fallback to original title
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }

        document.getElementById("eyecatch-preview").style.display = "block";
        window.imageService.generateEyeCatch(canvas, displayTitle, data.url, template);
    };

    document.getElementById("download-eyecatch").onclick = () => {
        const canvas = document.getElementById("eyecatch-canvas");
        downloadCanvas(canvas, `eyecatch-${Date.now()}.png`);
    };

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
