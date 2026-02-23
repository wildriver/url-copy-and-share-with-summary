const AMAZON_HOST = "www.amazon.co.jp";

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

const generatePreviewText = (title, url, summary) => {
    let parts = [];
    const isSummaryChecked = document.getElementById('opt-summary').checked;
    const isTitleChecked = document.getElementById('opt-title').checked;
    const isHashtagsChecked = document.getElementById('opt-hashtags').checked;

    if (isSummaryChecked && summary && !summary.includes("...") && !summary.startsWith("Error")) {
        parts.push(summary);
        if (isTitleChecked) {
            parts.push("-");
        }
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
    const summaryArea = document.getElementById("summary-text");
    const summary = summaryArea ? summaryArea.value : "";
    const text = generatePreviewText(title, url, summary);
    document.getElementById('share-preview').value = text;
}

const updateVisibilityUI = (settings, isShareable) => {
    const selectedProvider = document.getElementById('popup-ai-provider').value;
    const apiKey = selectedProvider === 'groq' ? settings.groqApiKey : settings.openrouterApiKey;

    const summaryArea = document.getElementById("summary-text");
    const summaryVal = summaryArea ? summaryArea.value : "";
    const hasSummary = summaryVal && !summaryVal.includes("...") && !summaryVal.startsWith("Error");
    const hasApiKey = !!apiKey;
    const showAi = settings.showAi !== false;
    const showQr = settings.showQr !== false;

    // Independent Sections (Hide/Visible based on settings)
    const aiSections = document.querySelectorAll('.ai-section');
    aiSections.forEach(sec => sec.style.display = (showAi) ? 'block' : 'none');

    const qrSection = document.getElementById('tools-section');
    qrSection.style.display = (showQr) ? 'block' : 'none';

    // Checkboxes (Always visible, but disabled without prerequisites)
    const optSummary = document.getElementById('opt-summary');
    optSummary.disabled = !hasApiKey || !isShareable || !hasSummary;

    const optHashtags = document.getElementById('opt-hashtags');
    optHashtags.disabled = !hasApiKey || !isShareable;

    // AI Dependent inputs (Main summary/image actions)
    const aiMenus = document.querySelectorAll('.ai-menu');
    aiMenus.forEach(btn => btn.disabled = !hasApiKey || !isShareable);
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

    // Default: Only Title Checked
    document.getElementById('opt-title').checked = true;
    document.getElementById('opt-summary').checked = false;
    document.getElementById('opt-hashtags').checked = false;

    updateVisibilityUI(settings, data.isShareable);

    if (!data.isShareable) {
        const info = document.getElementById('shortcutInfo');
        info.textContent = chrome.i18n.getMessage("invalidUrl");
        info.style.color = "#ff6b6b";
    }

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
            const urlLen = 23;
            const hashtagLen = document.getElementById('opt-hashtags').checked ? 16 : 0;
            const titleLen = document.getElementById('opt-title').checked ? data.title.length : 0;
            const newline = document.getElementById('opt-newline').checked;
            const separatorLen = 3;
            const fixedPartsLen = urlLen + hashtagLen + titleLen + separatorLen;
            maxLength = Math.max(10, 140 - fixedPartsLen - 5);
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

            // Auto check summary if successful
            document.getElementById('opt-summary').checked = true;

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
