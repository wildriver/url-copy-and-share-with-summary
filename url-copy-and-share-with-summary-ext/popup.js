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

const formatTemplate = (type, title, url) => {
    const summaryArea = document.getElementById("summary-text");
    const summary = summaryArea ? summaryArea.value : "";
    switch (type) {
        case "scrapbox": return `[${title} ${url}]`;
        case "markdown": return `[${title}](${url})`;
        case "backlog": return `[[${title}:${url}]]`;
        case "onlyUrl": return url;
        case "simpleBreak": return `${title}\n${url}`;
        case "summaryUrl": {
            return summary && !summary.includes("...") && !summary.startsWith("Error") ? `${summary}\n${url}` : `${title}\n${url}`;
        }
        case "simple":
        default: return `${title} ${url}`;
    }
}

const generateShareText = (title, url, summary) => {
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

const updateCopyPreview = (data, type = "simple") => {
    const text = formatTemplate(type, data.title, data.url);
    const previewArea = document.getElementById('copy-preview');
    previewArea.value = text;
}

const updatePreview = (title, url) => {
    const summaryArea = document.getElementById("summary-text");
    const summary = summaryArea ? summaryArea.value : "";
    const text = generateShareText(title, url, summary);
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
    const aiSection = document.getElementById('result-section');
    aiSection.style.display = (showAi) ? 'block' : 'none';

    const qrSection = document.getElementById('tools-section');
    qrSection.style.display = (showQr) ? 'block' : 'none';

    // Share Checkboxes (Always visible, but disabled without prerequisites)
    const optSummary = document.getElementById('opt-summary');
    optSummary.closest('.checkbox-item').style.display = 'flex'; // Always show
    optSummary.disabled = !hasApiKey || !isShareable || !hasSummary;

    const optImage = document.getElementById('opt-image');
    optImage.closest('.checkbox-item').style.display = 'flex'; // Always show
    optImage.disabled = !hasApiKey || !isShareable;

    const optHashtags = document.getElementById('opt-hashtags');
    optHashtags.closest('.checkbox-item').style.display = 'flex'; // Always show
    optHashtags.disabled = !hasApiKey || !isShareable;

    // Copy Buttons (Always show, but disable without prerequisites)
    const summaryUrlBtn = document.getElementById('summaryUrl');
    summaryUrlBtn.style.display = 'inline-block'; // Always show
    summaryUrlBtn.disabled = !hasApiKey || !isShareable || !hasSummary;

    // AI Dependent inputs (Main summary/image actions)
    const aiMenus = document.querySelectorAll('.ai-menu');
    aiMenus.forEach(btn => btn.disabled = !hasApiKey || !isShareable);

    // Slack Button
    const slackBtn = document.getElementById('share-slack');
    slackBtn.disabled = !settings.slackWebhook || !isShareable;

    // Social buttons general shareability
    const shareBtns = document.querySelectorAll('.social-btn:not(.ai-dependent)');
    shareBtns.forEach(btn => btn.disabled = !isShareable);
}

const renderDynamicButtons = (enabledButtons, data) => {
    const container = document.getElementById('copy-buttons');
    const types = ['markdown', 'backlog', 'scrapbox', 'onlyUrl'];

    types.forEach(type => {
        if (enabledButtons && enabledButtons[type] === false) return;

        const btn = document.createElement('button');
        btn.id = type;
        btn.className = 'primary-button secondary-button';
        btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        btn.onclick = () => {
            currentCopyFormat = type;
            const text = formatTemplate(type, data.title, data.url);
            copyText(text);
            updateCopyPreview(data, type);
        };
        container.appendChild(btn);
    });
}

const downloadCanvas = (canvas, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

let currentCopyFormat = "simple";

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
        'slackWebhook', 'enabledButtons', 'showAi', 'showQr'
    ]);

    const providerSelect = document.getElementById('popup-ai-provider');
    if (settings.aiProvider) providerSelect.value = settings.aiProvider;

    updateVisibilityUI(settings, data.isShareable);
    renderDynamicButtons(settings.enabledButtons, data);

    if (!data.isShareable) {
        const info = document.getElementById('shortcutInfo');
        info.textContent = chrome.i18n.getMessage("invalidUrl");
        info.style.color = "#ff6b6b";
    }

    updatePreview(data.title, data.url);
    updateCopyPreview(data, "simple");
    copyText(formatTemplate("simple", data.title, data.url));

    // Event Listeners
    providerSelect.onchange = () => {
        updateVisibilityUI(settings, data.isShareable);
        chrome.storage.sync.set({ aiProvider: providerSelect.value });
    };

    document.getElementById("simple").onclick = () => {
        currentCopyFormat = "simple";
        const text = formatTemplate("simple", data.title, data.url);
        copyText(text);
        updateCopyPreview(data, "simple");
    };
    document.getElementById("simpleBreak").onclick = () => {
        currentCopyFormat = "simpleBreak";
        const text = formatTemplate("simpleBreak", data.title, data.url);
        copyText(text);
        updateCopyPreview(data, "simpleBreak");
    };
    document.getElementById("summaryUrl").onclick = () => {
        currentCopyFormat = "summaryUrl";
        const text = formatTemplate("summaryUrl", data.title, data.url);
        copyText(text);
        updateCopyPreview(data, "summaryUrl");
    };

    document.querySelectorAll('.checkbox-item input').forEach(input => {
        input.onchange = () => {
            updatePreview(data.title, data.url);
            updateVisibilityUI(settings, data.isShareable);
        };
    });

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
            // X limit is 140. 
            // Fixed parts: URL (23), hashtags (#URLCopyAndShare = 16), title, separators
            const urlLen = 23;
            const hashtagLen = document.getElementById('opt-hashtags').checked ? 16 : 0;
            const titleLen = document.getElementById('opt-title').checked ? data.title.length : 0;
            const newline = document.getElementById('opt-newline').checked;

            // parts: summary, [separator], title, [separator], url, [separator], hashtags
            // Worst case separators: 3 separators.
            const separatorLen = newline ? 3 : 3;
            const fixedPartsLen = urlLen + hashtagLen + titleLen + separatorLen;

            maxLength = Math.max(10, 140 - fixedPartsLen - 5); // 5 for buffer
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
            updateVisibilityUI(settings, data.isShareable);
            updatePreview(data.title, data.url);
            updateCopyPreview(data, currentCopyFormat);
        } catch (e) {
            area.value = "Error: " + e.message;
        } finally {
            btn.disabled = false;
        }
    };

    // Eye-catch
    document.getElementById("generate-image").onclick = () => {
        const canvas = document.getElementById("eyecatch-canvas");
        document.getElementById("eyecatch-preview").style.display = "block";
        window.imageService.generateEyeCatch(canvas, data.title, data.url);
    };

    document.getElementById("download-eyecatch").onclick = () => {
        const canvas = document.getElementById("eyecatch-canvas");
        downloadCanvas(canvas, `eyecatch-${Date.now()}.png`);
    };

    // Sharing
    document.getElementById("share-x").onclick = () => {
        const text = document.getElementById('share-preview').value;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    };

    document.getElementById("share-fb").onclick = () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`, '_blank');
    };

    document.getElementById("share-slack").onclick = async () => {
        const text = document.getElementById('share-preview').value;
        try {
            await window.slackService.postToSlack(text, settings.slackWebhook);
            alert(chrome.i18n.getMessage("slackPostSuccess"));
        } catch (e) {
            alert("Slack Error: " + e.message);
        }
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
