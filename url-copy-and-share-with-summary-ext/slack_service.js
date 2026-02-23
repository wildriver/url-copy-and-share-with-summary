const postToSlack = async (text, webhookUrl) => {
    if (!webhookUrl) {
        throw new Error('Slack Webhook URL is missing. Please set it in the Settings page.');
    }

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API Error: ${response.status} ${errorText}`);
    }

    return true;
};

window.slackService = { postToSlack };
