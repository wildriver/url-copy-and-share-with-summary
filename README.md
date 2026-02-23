# URL Copy with Summary

An intelligent Chrome extension that helps you copy URLs in various formats, generates AI-powered summaries, extracts smart hashtags, and creates stunning social media eye-catch images.

## ✨ New in v2.4.x
- **API Resilience & Rate Limit Tracking**: The extension now displays your remaining daily API requests directly in the popup, so you know exactly how much quota you have left.
- **Smart Fallback Mechanism**: If your primary AI provider (e.g., Groq) hits its rate limit, the extension will automatically switch to your secondary provider (e.g., OpenRouter) to ensure your workflow is never interrupted.
- **App Rename & New Branding**: Sleek new "URL Copy with Summary" logo and naming.
- **5 Eye-catch Templates**: Choose from Modern Gradient, Classic White, Navy Professional, Dark Mode Pop, and Elegant Gold.
- **AI Assist for Eye-catches**: Let AI generate a striking, short title (under 30 chars) specifically optimized for the eye-catch image.
- **Dynamic Smart Hashtags**: Automatically generates context-aware hashtags based on the page content.
- **Smart QR Codes**: Dynamic resizing for long URLs and a convenient "Download QR Code" button.
- **UI Freedom**: Resizable text areas and an uncluttered, modern interface.

## 🚀 Features
- **Premium Design**: Modern, glassmorphism-inspired UI with a sleek dark mode.
- **Bilingual Support**: Fully localized in English and Japanese.
- **URL Copy**: Copy current URL with customizable title, summary, and hashtags.
- **AI Summary**: Generate a concise summary of the page using Groq or OpenRouter with configurable length and language.
- **Eye-catch Generation**: Create a beautiful 1200x630px social share image instantly with 5 premium templates.
- **Amazon & Tracking URL Cleanup**: Automatically cleans up and shortens Amazon product URLs and strips tracking parameters (like `fbclid`, `utm_source`).

## 📥 Installation
1. Download the latest `extension.zip` release from this repository.
2. **Unzip** the file into a folder.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **"Developer mode"** in the top right corner.
5. Click **"Load unpacked"** and select the **folder** you just unzipped (the one containing `manifest.json`).

## ⚙️ Setup
1. Open the extension popup.
2. Click **Settings** to configure your AI provider (Groq or OpenRouter) and enter your API key. Features requiring an API key are marked with an asterisk (`*`).
   - **Groq Limits**: `llama-3.1-8b-instant` allows up to 14,400 requests/day. High-performance models like `llama-3.3-70b-versatile` may be limited to 1,000 requests/day.
   - **OpenRouter Limits**: Free tier allows roughly ~50 requests/day. Upgrading to a $10 credit unlocks 1,000+ requests/day.
   - *Tip: Configure both providers! If one goes down or hits a limit, the extension will automatically fallback to the other.*

## 🛠 Development
- **Manifest V3**: Built with modern Chrome extension standards.
- **Canvas API**: Local image generation for performance and privacy.
- **AI Integration**: Connects to your choice of LLM provider.

## 🙏 Acknowledgements
This project is a fork of the original [Simple URL Copy](https://github.com/MISONLN41/simple-url-copy) by [@ikedaosushi](https://github.com/ikedaosushi) and [Misoni](https://github.com/MISONLN41).

Special thanks to the original authors for providing the foundation for this extension.

---
*Enhanced by URL Copy with Summary.*
