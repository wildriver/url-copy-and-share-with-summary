const AMAZON_HOST = "www.amazon.co.jp";

const copyText = text => {
    const copyTextArea = document.querySelector("#copy-textarea");
    copyTextArea.value = text;
    copyTextArea.style.display = "block";
    copyTextArea.select();
    document.execCommand('copy');
    copyTextArea.style.display = "none";
}

const extractAmazonUrl = rawUrl => {
    const url = new URL(rawUrl);
    if (url.host == AMAZON_HOST && url.pathname.match(/\/dp\/[A-Za-z0-9]/)) {
        return url.origin + url.pathname.replace(/(^\S+)(\/dp\/[A-Za-z0-9]{10})(.*)/, '$2');
    }
    return rawUrl;
}

const showCopied = _ => {
    const copied = document.querySelector("#copied");
    copied.classList.remove("fadeout");
    setTimeout(_ => copied.classList.add("fadeout"), 300);
}

const getUrlData = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return {
        url: extractAmazonUrl(tab.url),
        title: tab.title,
        rawUrl: tab.url,
        tabId: tab.id
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
        // Simple hashtag logic: maybe extract from title or just generic
        parts.push("#URLCopyAndShare");
    }
    return parts.join("\n");
}

const updateAiDependentUI = (hasApiKey, hasWebhook) => {
    const aiElements = document.querySelectorAll('.ai-dependent');
    aiElements.forEach(el => {
        el.disabled = !hasApiKey;
        if (el.id === 'share-slack' && !hasWebhook) el.disabled = true;
    });
}

const renderDynamicButtons = (enabledButtons) => {
    const container = document.getElementById('copy-buttons');
    const types = ['markdown', 'backlog', 'scrapbox', 'onlyUrl'];

    types.forEach(type => {
        if (enabledButtons && enabledButtons[type] === false) return;

        const btn = document.createElement('button');
        btn.id = type;
        btn.className = 'primary-button secondary-button';
        btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        btn.addEventListener('click', async () => {
            const data = await getUrlData();
            copyText(formatTemplate(type, data.title, data.url));
            showCopied();
        });
        container.appendChild(btn);
    });
}

const onInit = async () => {
    // i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    });

    const settings = await chrome.storage.sync.get(['apiKey', 'slackWebhook', 'enabledButtons']);
    updateAiDependentUI(!!settings.apiKey, !!settings.slackWebhook);
    renderDynamicButtons(settings.enabledButtons);

    // Initial copy
    const initialData = await getUrlData();
    copyText(formatTemplate("simple", initialData.title, initialData.url));

    // Standard buttons
    document.getElementById("simple").onclick = async () => {
        const data = await getUrlData();
        copyText(formatTemplate("simple", data.title, data.url));
        showCopied();
    };
    document.getElementById("simpleBreak").onclick = async () => {
        const data = await getUrlData();
        copyText(formatTemplate("simpleBreak", data.title, data.url));
        showCopied();
    };
    document.getElementById("summaryUrl").onclick = async () => {
        const data = await getUrlData();
        copyText(formatTemplate("summaryUrl", data.title, data.url));
        showCopied();
    };

    // AI Summary
    document.getElementById("summarize").onclick = async () => {
        const btn = document.getElementById("summarize");
        const area = document.getElementById("summary-text");
        const resDiv = document.getElementById("ai-result");

        btn.disabled = true;
        resDiv.style.display = "block";
        area.value = chrome.i18n.getMessage("summarizing");

        try {
            const data = await getUrlData();
            const results = await chrome.scripting.executeScript({
                target: { tabId: data.tabId },
                func: () => document.body.innerText,
            });
            const summary = await window.aiService.getSummary(results[0].result);
            area.value = summary;
            updateAiDependentUI(true, !!settings.slackWebhook); // Re-enable if summary now exists
        } catch (e) {
            area.value = "Error: " + e.message;
        } finally {
            btn.disabled = false;
        }
    };

    // Eye-catch
    document.getElementById("generate-image").onclick = async () => {
        const data = await getUrlData();
        const canvas = document.getElementById("eyecatch-canvas");
        document.getElementById("eyecatch-preview").style.display = "block";
        window.imageService.generateEyeCatch(canvas, data.title, data.url);
    };

    // Sharing
    document.getElementById("share-x").onclick = async () => {
        const data = await getUrlData();
        const summary = document.getElementById("summary-text").value;
        const text = generateShareText(data.title, data.url, summary);
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    };

    document.getElementById("share-fb").onclick = async () => {
        const data = await getUrlData();
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`, '_blank');
    };

    document.getElementById("share-slack").onclick = async () => {
        const data = await getUrlData();
        const summary = document.getElementById("summary-text").value;
        const text = generateShareText(data.title, data.url, summary);
        try {
            await window.slackService.postToSlack(text, settings.slackWebhook);
            alert(chrome.i18n.getMessage("slackPostSuccess"));
        } catch (e) {
            alert("Slack Error: " + e.message);
        }
    };

    // QR Code
    const qrData = await getUrlData();
    new QRCode(document.getElementById("qrcode"), {
        text: qrData.rawUrl,
        width: 128,
        height: 128,
        correctLevel: QRCode.CorrectLevel.L
    });
}

document.addEventListener("DOMContentLoaded", onInit);
