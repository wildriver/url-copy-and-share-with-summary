const AMAZON_HOST = "www.amazon.co.jp";

const copyText = text => {
    let copyTextArea = document.querySelector("#copy-textarea");
    copyTextArea.textContent = text;
    copyTextArea.select();
    document.execCommand('copy');
}

const extractAmazonUrl = rawUrl => {
    const url = new URL(rawUrl);
    if (url.host == AMAZON_HOST && url.pathname.match(/\/dp\/[A-Za-z0-9]/)) {
        newUrl = url.origin + url.pathname.replace(/(^\S+)(\/dp\/[A-Za-z0-9]{10})(.*)/, '$2');
        return newUrl;
    } else {
        return rawUrl;
    }
}

const showCopied = _ => {
    let copied = document.querySelector("#copied");
    copied.classList.remove("fadeout");
    setTimeout(_ => copied.classList.add("fadeout"), 300);
}

const copyUrl = menuType => {
    chrome.tabs.query({ active: true, currentWindow: true, lastFocusedWindow: true }, function (tabs) {
        let url = tabs[0].url;
        const title = tabs[0].title;

        // Process AmazonURL
        url = extractAmazonUrl(url);

        let text;
        switch (menuType) {
            case "scrapbox":
                text = `[${title} ${url}]`
                break;
            case "markdown":
                text = `[${title}](${url})`
                break;
            case "backlog":
                text = `[[${title}:${url}]]`
                break;
            case "onlyUrl":
                text = `${url}`
                break;
            case "simpleBreak":
                text = `${title}\n${url}`
                break;
            case "simple":
                text = `${title} ${url}`
                break;
        }
        copyText(text);
        showCopied();
    })
}

const onInit = _ => {
    // First copy simple
    copyUrl("simple");
    document.querySelectorAll(".bettercopy-menu").forEach(el => {
        el.addEventListener("click", onClickCopyMenu);
    });

    document.getElementById("summarize").addEventListener("click", async () => {
        const summaryText = document.getElementById("summary-text");
        const aiResult = document.getElementById("ai-result");
        aiResult.style.display = "block";
        summaryText.innerText = "Summarizing...";

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText,
            });
            const text = results[0].result;
            const summary = await window.aiService.getSummary(text);
            summaryText.innerText = summary;
        } catch (e) {
            summaryText.innerText = "Error: " + e.message;
        }
    });

    document.getElementById("generate-image").addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const canvas = document.getElementById("eyecatch-canvas");
        const preview = document.getElementById("eyecatch-preview");
        preview.style.display = "block";
        window.imageService.generateEyeCatch(canvas, tab.title, tab.url);
    });

    document.getElementById("share-x").addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const summary = document.getElementById("summary-text").innerText;
        const text = summary && summary !== "Summarizing..." ? summary + "\n" : "";
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + tab.title)}&url=${encodeURIComponent(tab.url)}`;
        window.open(url, '_blank');
    });

    document.getElementById("share-fb").addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(tab.url)}`;
        window.open(url, '_blank');
    });

    document.getElementById("share-slack").addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const summary = document.getElementById("summary-text").innerText;
        const text = summary && summary !== "Summarizing..." ? `${summary}\n${tab.url}` : `${tab.title}\n${tab.url}`;
        // Slack web hook or direct link is limited, usually simple copy is better or deep link
        copyText(text);
        alert("Slack share text copied to clipboard!");
    });

    chrome.tabs.query({ active: true, currentWindow: true, lastFocusedWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        new QRCode(document.getElementById("qrcode"), {
            text: tabs[0].url,
            width: 128,
            height: 128,
            correctLevel: QRCode.CorrectLevel.L
        });
    });
}


const onClickCopyMenu = function (evt) {
    const menuType = this.id;
    copyUrl(menuType);
}

document.addEventListener("DOMContentLoaded", onInit);
