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
    switch (type) {
        case "scrapbox": return `[${title} ${url}]`;
        case "markdown": return `[${title}](${url})`;
        case "backlog": return `[[${title}:${url}]]`;
        case "onlyUrl": return url;
        case "simpleBreak": return `${title}\n${url}`;
        case "summaryUrl": {
            const summary = document.getElementById("summary-text").value;
            return summary ? `${summary}\n${url}` : `${title}\n${url}`;
        }
        case "simple":
        default: return `${title} ${url}`;
    }
}

const generateShareText = (title, url, summary) => {
    let parts = [];
    if (document.getElementById('opt-summary').checked && summary) {
        parts.push(summary);
        if (document.getElementById('opt-title').checked) {
            parts.push("-");
        }
    }
    if (document.getElementById('opt-title').checked) {
        parts.push(title);
    }
    parts.push(url);
    if (document.getElementById('opt-hashtags').checked) {
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
    const summary = document.getElementById("summary-text").value;
    const text = generateShareText(title, url, summary);
    document.getElementById('share-preview').value = text;
}

const updateVisibilityUI = (settings, isShareable) => {
    const summaryVal = document.getElementById("summary-text").value;
    const hasSummary = summaryVal && summaryVal !== chrome.i18n.getMessage("summarizing") && !summaryVal.startsWith("Error:");
    const hasApiKey = !!settings.apiKey;
    const showAi = settings.showAi !== false;
    const showQr = settings.showQr !== false;

    // AI Section Visibility
    const aiSection = document.getElementById('result-section');
    aiSection.style.display = (showAi && hasApiKey && isShareable) ? 'block' : 'none';

    // QR Section Visibility
    const qrSection = document.getElementById('tools-section');
    qrSection.style.display = (showQr) ? 'block' : 'none';

    // AI Dependent Buttons / Options
    const summaryUrlBtn = document.getElementById('summaryUrl');
    summaryUrlBtn.style.display = (showAi && hasApiKey && hasSummary) ? 'inline-block' : 'none';

    const optSummaryLabel = document.getElementById('opt-summary').closest('.checkbox-item');
    optSummaryLabel.style.display = (showAi && hasApiKey && hasSummary) ? 'flex' : 'none';

    const optImageLabel = document.getElementById('opt-image').closest('.checkbox-item');
    optImageLabel.style.display = (showAi && hasApiKey) ? 'flex' : 'none';

    const optHashtagsLabel = document.getElementById('opt-hashtags').closest('.checkbox-item');
    optHashtagsLabel.style.display = (showAi && hasApiKey) ? 'flex' : 'none';

    // Slack Button
    const slackBtn = document.getElementById('share-slack');
    slackBtn.style.display = (settings.slackWebhook && isShareable) ? 'flex' : 'none';

    // Social buttons general shareability
    const shareBtns = document.querySelectorAll('.social-btn:not(.ai-dependent)');
    shareBtns.forEach(btn => btn.disabled = !isShareable);

    // AI Dependent inputs
    document.querySelectorAll('.ai-dependent').forEach(el => {
        el.disabled = !hasApiKey || !isShareable;
    });

    const aiMenus = document.querySelectorAll('.ai-menu');
    aiMenus.forEach(btn => btn.disabled = !hasApiKey || !isShareable);
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

let currentCopyFormat = "simple";

const onInit = async () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });

    const data = await getUrlData();
    if (!data) return;

    const settings = await chrome.storage.sync.get(['apiKey', 'slackWebhook', 'enabledButtons', 'showAi', 'showQr']);

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

        btn.disabled = true;
        resDiv.style.display = "block";
        area.value = chrome.i18n.getMessage("summarizing");

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: data.tabId },
                func: () => document.body.innerText,
            });
            const summary = await window.aiService.getSummary(results[0].result);
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
