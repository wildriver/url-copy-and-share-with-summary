const generateEyeCatch = (canvas, title, url) => {
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const height = 630;

    // Set actual canvas size
    canvas.width = width;
    canvas.height = height;

    // Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#6a11cb');
    gradient.addColorStop(1, '#2575fc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Overlay Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(50, 50, width - 100, height - 100);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';

    // Simple text wrapping for title
    const words = title.split(' ');
    let line = '';
    let y = 280;
    const maxWidth = width - 200;
    const lineHeight = 70;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, width / 2, y);
            line = words[i] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, width / 2, y);

    // URL
    ctx.font = '30px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(url, width / 2, height - 100);

    return canvas.toDataURL('image/png');
};

window.imageService = { generateEyeCatch };
