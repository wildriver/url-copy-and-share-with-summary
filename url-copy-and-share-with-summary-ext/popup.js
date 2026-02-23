const AMAZON_HOST = "www.amazon.co.jp";

const copyText = async text => {
    try {
        await navigator.clipboard.writeText(text);
        showCopied();
    } catch (err) {
        // Fallback for older browsers or restricted contexts
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

const updatePreview = (title, url) => {
    const summary = document.getElementById("summary-text").value;
    const text = generateShareText(title, url, summary);
    document.getElementById('share-preview').value = text;
}

const updateAiDependentUI = (hasApiKey, hasWebhook, isShareable) => {
    const aiElements = document.querySelectorAll('.ai-dependent');
    const summaryVal = document.getElementById("summary-text").value;
    const hasSummary = summaryVal && summaryVal !== chrome.i18n.getMessage("summarizing");

    aiElements.forEach(el => {
        // Summary checkbox depends on summary existing
        if (el.id === 'opt-summary' || el.id === 'summaryUrl') {
            el.disabled = !hasApiKey || !isShareable || !hasSummary;
        } else if (el.id === 'share-slack') {
            el.disabled = !hasApiKey || !isShareable || !hasWebhook;
        } else {
            el.disabled = !hasApiKey || !isShareable;
        }
    });

    const shareBtns = document.querySelectorAll('.social-btn:not(.ai-dependent)');
    shareBtns.forEach(btn => btn.disabled = !isShareable);

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
        btn.onclick = () => copyText(formatTemplate(type, data.title, data.url));
        container.appendChild(btn);
    });
}

const onInit = async () => {
    // i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });

    const data = await getUrlData();
    if (!data) return;

    const settings = await chrome.storage.sync.get(['apiKey', 'slackWebhook', 'enabledButtons', 'showAi', 'showQr']);

    // UI Toggles
    if (settings.showAi === false) document.querySelector('.ai-section').style.display = 'none';
    if (settings.showQr === false) document.querySelector('.qr-section').style.display = 'none';

    updateAiDependentUI(!!settings.apiKey, !!settings.slackWebhook, data.isShareable);
    renderDynamicButtons(settings.enabledButtons, data);

    if (!data.isShareable) {
        const info = document.getElementById('shortcutInfo');
        info.textContent = chrome.i18n.getMessage("invalidUrl");
        info.style.color = "#ff6b6b";
    }

    // Initial Preview
    updatePreview(data.title, data.url);

    // Initial copy
    copyText(formatTemplate("simple", data.title, data.url));

    // Event Listeners
    document.getElementById("simple").onclick = () => copyText(formatTemplate("simple", data.title, data.url));
    document.getElementById("simpleBreak").onclick = () => copyText(formatTemplate("simpleBreak", data.title, data.url));
    document.getElementById("summaryUrl").onclick = () => copyText(formatTemplate("summaryUrl", data.title, data.url));

    // Checkboxes change preview
    document.querySelectorAll('.checkbox-item input').forEach(input => {
        input.onchange = () => updatePreview(data.title, data.url);
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
            updateAiDependentUI(!!settings.apiKey, !!settings.slackWebhook, data.isShareable);
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
