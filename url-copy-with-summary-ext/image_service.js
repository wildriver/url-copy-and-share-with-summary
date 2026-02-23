const generateEyeCatch = (canvas, title, url, template = 'modern') => {
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const height = 630;

    // Set actual canvas size
    canvas.width = width;
    canvas.height = height;

    if (template === 'white') {
        // Template: Classic White (White bg, Thick Navy border)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#001f3f'; // Navy
        ctx.lineWidth = 40;
        ctx.strokeRect(20, 20, width - 40, height - 40);

        // Add Quotation Marks
        ctx.fillStyle = '#001f3f';
        ctx.font = 'bold 160px serif';
        ctx.textAlign = 'left';
        ctx.fillText('「', 60, 160);

        ctx.textAlign = 'right';
        ctx.fillText('」', width - 60, height - 80);

        ctx.fillStyle = '#001f3f'; // Navy text
    } else if (template === 'navy') {
        // Template: Navy Professional (Navy bg, white text)
        ctx.fillStyle = '#001f3f';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, width - 100, height - 100);

        ctx.fillStyle = '#ffffff'; // White text
    } else if (template === 'darkpop') {
        // Template: Dark Mode Pop (Dark, vibrant neon accents)
        ctx.fillStyle = '#111827'; // Dark grayish blue
        ctx.fillRect(0, 0, width, height);

        // Neon borders
        ctx.strokeStyle = '#8b5cf6'; // Vivid purple
        ctx.lineWidth = 8;
        ctx.strokeRect(40, 40, width - 80, height - 80);
        ctx.strokeStyle = '#3b82f6'; // Bright blue
        ctx.lineWidth = 4;
        ctx.strokeRect(52, 52, width - 104, height - 104);

        ctx.fillStyle = '#f9fafb'; // Off-white text
    } else if (template === 'gold') {
        // Template: Elegant Gold (Rich dark background with golden accents)
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1c1917'); // Dark stone
        gradient.addColorStop(1, '#292524');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Gold frame
        ctx.strokeStyle = '#d97706'; // Amber/Gold
        ctx.lineWidth = 6;
        ctx.strokeRect(60, 60, width - 120, height - 120);

        ctx.fillStyle = '#fef3c7'; // Light gold text
    } else {
        // Template: Modern Gradient (Default)
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#6a11cb');
        gradient.addColorStop(1, '#2575fc');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Overlay Box
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(50, 50, width - 100, height - 100);

        ctx.fillStyle = '#ffffff'; // White text
    }

    // Title
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';

    // Text wrapping for title
    const words = title.split(''); // Split by character for Japanese support
    let line = '';
    let lines = [];
    const maxWidth = width - 240;
    const lineHeight = 90;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            lines.push(line);
            line = words[i];
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    // Center vertical alignment
    let y = (height / 2) - ((lines.length - 1) * lineHeight / 2);

    // Shift slightly down if there are quotation marks to balance visual weight
    if (template === 'white') {
        y += 20;
    }

    lines.forEach(l => {
        ctx.fillText(l, width / 2, y);
        y += lineHeight;
    });

    // NOTE: URL drawing has been removed per v2.3.0 requirements

    return canvas.toDataURL('image/png');
};

window.imageService = { generateEyeCatch };
