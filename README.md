# AI Image Generator Comparison Tool

A Vue.js application for comparing image generation results from DALL-E 2, DALL-E 3, and Gemini AI models side by side.

## 🚀 Features

- **Multi-Model Support**: Compare DALL-E 2, DALL-E 3, and Gemini simultaneously
- **Two Generation Modes**:
  - Text-to-Image: Generate from text prompts only
  - Image Editing: Upload an image + text instructions for modifications
- **Smart Model Selection**: DALL-E 3 automatically hidden in image editing mode (not supported)
- **Drag & Drop Upload**: Easy image file uploading with preview
- **Real-time Status**: Live progress tracking and generation time display
- **Secure API Key Storage**: Encrypted local storage with Web Crypto API
- **Responsive Design**: Mobile-friendly interface
- **Zero Build Tools**: Pure CDN-based setup

## 🛠️ Tech Stack

- **Frontend**: Vue.js 3 (CDN)
- **Styling**: TailwindCSS (CDN)
- **Encryption**: Web Crypto API (AES-GCM)
- **Build**: None required

## 📦 Setup

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd image_model_compare

# Open in browser (no server required)
open index.html

# Or serve locally (recommended for CORS)
python3 -m http.server 8000
# Access at http://localhost:8000
```

**Required Files:**
- `index.html` - Main HTML with Vue.js CDN
- `script.js` - Vue.js application logic

That's it! No build process needed.

## 🔑 Usage

### API Key Setup

1. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/)
2. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Basic Usage

#### 1. Text-to-Image Mode
1. Enter your image description in the prompt field
2. Input both API keys
3. Optional: Check "Save API keys securely (permanent)" to store keys
4. Click "Generate and Compare Images"

#### 2. Image Editing Mode
1. Select "Image + Text" mode
2. Upload a reference image (drag & drop or click)
3. Enter editing instructions in the text field
4. Input API keys (if not saved)
5. Click "Generate and Compare Images"

**Note**: DALL-E 3 card is automatically hidden in image editing mode as it doesn't support image editing.

## 🔒 API Key Security

### Encrypted Storage
- **Encryption**: AES-256-GCM using Web Crypto API
- **Storage**: Encrypted keys stored in localStorage
- **Duration**: Permanent (until manually deleted)
- **Control**: User chooses whether to save keys

### Security Features
- Industry-standard AES-256 encryption
- Random initialization vectors for each encryption
- Browser-native Web Crypto API (no third-party libraries)
- Manual deletion button for saved keys

### Security Notes
- Frontend encryption is not completely secure (JavaScript is visible)
- Provides protection against accidental key exposure
- For production use, consider server-side API proxy

## ⚠️ API Limitations

### DALL-E 2 Image Editing Requirements
- **Format**: Automatically converts uploaded images to PNG
- **Size Limit**: Images are checked against 4MB limit
- **Dimensions**: Original dimensions preserved (no cropping)

### CORS Issues
Direct browser API calls may encounter CORS restrictions:

- **OpenAI API**: Generally works well
- **Gemini API**: May show fallback image on CORS errors

### CORS Workarounds

**1. Local Server (Recommended)**
```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

**2. CORS-Disabled Browser (Development Only)**
```bash
# Chrome
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
```

## 🔧 Customization

### Adding New AI Models

1. **Add API Configuration**
```javascript
CONFIG.API.NEWMODEL = {
    URL: 'https://api.example.com/generate',
    // other settings
};
```

2. **Add Model State**
```javascript
// In Vue data()
models: {
    newmodel: {
        status: 'waiting',
        image: null,
        time: null,
        name: 'New Model'
    }
}
```

3. **Add Generation Method**
```javascript
async generateNewModel() {
    // Implementation
}
```

4. **Add HTML Card**
```html
<!-- New model card in results section -->
<article class="bg-white/95 rounded-2xl p-6 shadow-xl">
    <!-- Card content -->
</article>
```

## 📁 File Structure

```
.
├── index.html              # Main HTML with Vue.js
├── script.js              # Vue.js application
├── index-vanilla.html     # Backup vanilla version
├── script-vanilla.js      # Backup vanilla version
└── README.md             # This file
```

## 🌟 Vue.js Benefits

- **Reactive**: Automatic UI updates on state changes
- **Declarative**: Template-based approach
- **Component**: Clean separation of concerns
- **No Build**: CDN-based, no compilation required
- **Lightweight**: Smaller codebase than vanilla JS

## 🔄 Migration from Vanilla JS

The project was migrated from vanilla JavaScript to Vue.js for better maintainability:

- **Before**: Manual DOM manipulation, ~15k lines
- **After**: Reactive data binding, ~12k lines (20% reduction)
- **Backup**: Original vanilla version preserved as `*-vanilla.*` files

## 🆚 Model Capabilities

| Feature | DALL-E 2 | DALL-E 3 | Gemini |
|---------|----------|----------|---------|
| Text-to-Image | ✅ | ✅ | ✅ |
| Image Editing | ✅ | ❌ | ✅ |
| PNG Conversion | Auto | N/A | N/A |
| Square Crop | No | N/A | No |

## 🐛 Troubleshooting

### Common Issues

1. **Vue not defined**: Check if Vue.js CDN is loaded
2. **CORS errors**: Use local server or try different browser
3. **Large images**: DALL-E 2 has 4MB limit, automatic conversion applied
4. **API keys not saving**: Check browser localStorage permissions

### Debug Mode

Open browser console to see detailed logs:
- API key save/load operations
- Image conversion process
- API request/response details

## 📄 License

MIT License - Feel free to use and modify!