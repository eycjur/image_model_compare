// Configuration
const CONFIG = {
    API: {
        OPENAI: {
            GENERATION_URL: 'https://api.openai.com/v1/images/generations',
            EDIT_URL: 'https://api.openai.com/v1/images/edits',
            MODELS: {
                DALLE2: 'dall-e-2',
                DALLE3: 'dall-e-3'
            },
            SIZES: {
                DALLE2: '512x512',
                DALLE3: '1024x1024'
            }
        },
        GEMINI: {
            URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent'
        }
    },
    UI: {
        MESSAGES: {
            NO_PROMPT: 'プロンプトを入力してください',
            NO_IMAGE: '画像をアップロードしてください',
            NO_OPENAI_KEY: 'OpenAI API Keyを入力してください',
            NO_GEMINI_KEY: 'Gemini API Keyを入力してください',
            INVALID_IMAGE: '画像ファイルを選択してください'
        },
        LABELS: {
            TEXT_MODE: '生成したい画像の説明を入力してください：',
            IMAGE_MODE: '画像に対する変更・編集の指示を入力してください：'
        },
        STATUS: {
            WAITING: { text: '待機中', class: 'bg-gray-100 text-gray-600' },
            GENERATING: { text: '生成中', class: 'bg-yellow-100 text-yellow-800' },
            COMPLETED: { text: '完了', class: 'bg-green-100 text-green-800' },
            ERROR: { text: 'エラー', class: 'bg-red-100 text-red-800' }
        }
    },
    MODES: {
        TEXT: 'text',
        IMAGE: 'image'
    }
};

// API Service
const APIService = {
    async makeRequest(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },

    async generateOpenAIImage(apiKey, model, prompt, size, quality = null) {
        const body = { model, prompt, n: 1, size };
        if (quality) body.quality = quality;

        return await this.makeRequest(CONFIG.API.OPENAI.GENERATION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });
    },

    async editOpenAIImage(apiKey, imageBlob, prompt, size, model = 'dall-e-2') {
        const formData = new FormData();
        formData.append('image', imageBlob);
        formData.append('prompt', prompt);
        formData.append('model', model);
        formData.append('n', '1');
        formData.append('size', size);

        return await this.makeRequest(CONFIG.API.OPENAI.EDIT_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData
        });
    },

    async generateGeminiImage(apiKey, requestBody) {
        return await this.makeRequest(CONFIG.API.GEMINI.URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
        });
    }
};

// Image utilities
const ImageUtils = {
    extractBase64Data(dataUrl) {
        return dataUrl.split(',')[1];
    },

    async base64ToBlob(dataUrl) {
        const response = await fetch(dataUrl);
        return await response.blob();
    },

    async convertToPngBlob(imageFile) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Keep original dimensions
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw image without cropping
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to convert to PNG'));
                        return;
                    }

                    // Check size limit (4MB)
                    if (blob.size > 4 * 1024 * 1024) {
                        reject(new Error('Image too large. DALLE-2 editing requires images under 4MB.'));
                        return;
                    }

                    resolve(blob);
                }, 'image/png', 0.9);
            };

            img.onerror = () => reject(new Error('Failed to load image'));

            if (typeof imageFile === 'string') {
                img.src = imageFile; // data URL
            } else {
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target.result;
                reader.onerror = () => reject(new Error('Failed to read image file'));
                reader.readAsDataURL(imageFile);
            }
        });
    }
};

// Encryption utilities
const CryptoUtils = {
    async generateKey() {
        return await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    async keyToString(key) {
        const exported = await crypto.subtle.exportKey('jwk', key);
        return JSON.stringify(exported);
    },

    async keyFromString(keyString) {
        const keyData = JSON.parse(keyString);
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    },

    async encrypt(text, key) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        return {
            encrypted: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv)
        };
    },

    async decrypt(encryptedData, key) {
        const { encrypted, iv } = encryptedData;
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            new Uint8Array(encrypted)
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }
};

// Storage utilities
const StorageUtils = {
    STORAGE_KEY: 'ai-comparison-keys',

    async saveKeys(apiKeys, shouldSave = false) {
        if (!shouldSave) return;

        try {
            // Generate or get existing encryption key
            let encryptionKey = localStorage.getItem('ai-comparison-encryption-key');
            if (!encryptionKey) {
                const key = await CryptoUtils.generateKey();
                encryptionKey = await CryptoUtils.keyToString(key);
                localStorage.setItem('ai-comparison-encryption-key', encryptionKey);
            }

            const key = await CryptoUtils.keyFromString(encryptionKey);
            const data = {
                timestamp: Date.now(),
                keys: {}
            };

            if (apiKeys.openai) {
                data.keys.openai = await CryptoUtils.encrypt(apiKeys.openai, key);
            }

            if (apiKeys.gemini) {
                data.keys.gemini = await CryptoUtils.encrypt(apiKeys.gemini, key);
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            console.log('API keys saved securely');
        } catch (error) {
            console.error('Failed to save API keys:', error);
        }
    },

    async loadKeys() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            const encryptionKey = localStorage.getItem('ai-comparison-encryption-key');

            if (!stored || !encryptionKey) return {};

            const data = JSON.parse(stored);

            const key = await CryptoUtils.keyFromString(encryptionKey);
            const apiKeys = {};

            if (data.keys.openai) {
                apiKeys.openai = await CryptoUtils.decrypt(data.keys.openai, key);
            }

            if (data.keys.gemini) {
                apiKeys.gemini = await CryptoUtils.decrypt(data.keys.gemini, key);
            }

            return apiKeys;
        } catch (error) {
            console.error('Failed to load API keys:', error);
            this.clearKeys(); // Clear corrupted data
            return {};
        }
    },

    clearKeys() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem('ai-comparison-encryption-key');
        console.log('Saved API keys cleared');
    },

    hasSavedKeys() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    }
};

// Vue App
const { createApp } = Vue;

createApp({
    data() {
        return {
            inputMode: CONFIG.MODES.TEXT,
            textPrompt: '',
            uploadedImage: null,
            apiKeys: {
                openai: '',
                gemini: ''
            },
            saveKeys: false,
            models: {
                dalle2: {
                    status: 'waiting',
                    image: null,
                    time: null,
                    name: 'DALLE-2'
                },
                dalle3: {
                    status: 'waiting',
                    image: null,
                    time: null,
                    name: 'DALLE-3'
                },
                gemini: {
                    status: 'waiting',
                    image: null,
                    time: null,
                    name: 'Gemini'
                }
            },
            isGenerating: false
        }
    },
    computed: {
        isImageMode() {
            return this.inputMode === CONFIG.MODES.IMAGE;
        },
        showDalle3() {
            return !this.isImageMode;
        },
        promptLabel() {
            return this.isImageMode ? CONFIG.UI.LABELS.IMAGE_MODE : CONFIG.UI.LABELS.TEXT_MODE;
        },
        canGenerate() {
            return !this.isGenerating &&
                   this.textPrompt.trim() &&
                   this.apiKeys.openai &&
                   this.apiKeys.gemini &&
                   (!this.isImageMode || this.uploadedImage);
        }
    },
    methods: {
        toggleInputMode(mode) {
            this.inputMode = mode;
            if (mode === CONFIG.MODES.TEXT) {
                this.removeUploadedImage();
            }
        },

        handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file || !file.type.startsWith('image/')) {
                alert(CONFIG.UI.MESSAGES.INVALID_IMAGE);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.uploadedImage = e.target.result;
            };
            reader.readAsDataURL(file);
        },

        removeUploadedImage() {
            this.uploadedImage = null;
            this.$refs.fileInput.value = '';
        },

        getStatusConfig(status) {
            return CONFIG.UI.STATUS[status.toUpperCase()] || CONFIG.UI.STATUS.WAITING;
        },

        async saveApiKeys() {
            await StorageUtils.saveKeys(this.apiKeys, this.saveKeys);
        },

        async loadApiKeys() {
            const saved = await StorageUtils.loadKeys();
            if (saved.openai) this.apiKeys.openai = saved.openai;
            if (saved.gemini) this.apiKeys.gemini = saved.gemini;
        },

        clearSavedKeys() {
            StorageUtils.clearKeys();
            this.saveKeys = false;
        },

        hasSavedKeys() {
            return StorageUtils.hasSavedKeys();
        },

        resetResults() {
            Object.keys(this.models).forEach(key => {
                this.models[key].status = 'waiting';
                this.models[key].image = null;
                this.models[key].time = null;
            });
        },

        async generateImages() {
            if (!this.canGenerate) return;

            // Save API keys if requested
            await this.saveApiKeys();

            this.isGenerating = true;
            this.resetResults();

            const generators = [
                this.generateDALLE2(),
                this.generateGemini()
            ];

            if (!this.isImageMode) {
                generators.splice(1, 0, this.generateDALLE3());
            }

            try {
                await Promise.allSettled(generators);
            } finally {
                this.isGenerating = false;
            }
        },

        async generateDALLE2() {
            const startTime = Date.now();
            this.models.dalle2.status = 'generating';

            try {
                let data;
                if (this.isImageMode) {
                    // Convert to square PNG for DALLE-2 editing requirements
                    const pngBlob = await ImageUtils.convertToPngBlob(this.uploadedImage);
                    data = await APIService.editOpenAIImage(
                        this.apiKeys.openai,
                        pngBlob,
                        this.textPrompt,
                        CONFIG.API.OPENAI.SIZES.DALLE2,
                        CONFIG.API.OPENAI.MODELS.DALLE2
                    );
                } else {
                    data = await APIService.generateOpenAIImage(
                        this.apiKeys.openai,
                        CONFIG.API.OPENAI.MODELS.DALLE2,
                        this.textPrompt,
                        CONFIG.API.OPENAI.SIZES.DALLE2
                    );
                }

                const duration = Math.round((Date.now() - startTime) / 1000);
                this.models.dalle2.image = data.data[0].url;
                this.models.dalle2.status = 'completed';
                this.models.dalle2.time = duration;
            } catch (error) {
                console.error('DALLE-2 generation failed:', error);
                this.models.dalle2.status = 'error';
            }
        },

        async generateDALLE3() {
            const startTime = Date.now();
            this.models.dalle3.status = 'generating';

            try {
                const data = await APIService.generateOpenAIImage(
                    this.apiKeys.openai,
                    CONFIG.API.OPENAI.MODELS.DALLE3,
                    this.textPrompt,
                    CONFIG.API.OPENAI.SIZES.DALLE3,
                    'standard'
                );

                const duration = Math.round((Date.now() - startTime) / 1000);
                this.models.dalle3.image = data.data[0].url;
                this.models.dalle3.status = 'completed';
                this.models.dalle3.time = duration;
            } catch (error) {
                console.error('DALLE-3 generation failed:', error);
                this.models.dalle3.status = 'error';
            }
        },

        async generateGemini() {
            const startTime = Date.now();
            this.models.gemini.status = 'generating';

            try {
                let requestBody;
                if (this.isImageMode && this.uploadedImage) {
                    const base64Data = ImageUtils.extractBase64Data(this.uploadedImage);
                    requestBody = {
                        contents: [{
                            parts: [
                                { text: this.textPrompt },
                                {
                                    inline_data: {
                                        mime_type: "image/jpeg",
                                        data: base64Data
                                    }
                                }
                            ]
                        }]
                    };
                } else {
                    requestBody = {
                        contents: [{
                            parts: [{ text: `Generate an image: ${this.textPrompt}` }]
                        }]
                    };
                }

                const data = await APIService.generateGeminiImage(this.apiKeys.gemini, requestBody);

                if (!data.candidates?.[0]?.content?.parts) {
                    throw new Error('Invalid response format');
                }

                const imagePart = data.candidates[0].content.parts.find(part => part.inlineData);
                if (!imagePart) {
                    throw new Error('No image data in response');
                }

                const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                const duration = Math.round((Date.now() - startTime) / 1000);

                this.models.gemini.image = imageUrl;
                this.models.gemini.status = 'completed';
                this.models.gemini.time = duration;
            } catch (error) {
                console.error('Gemini generation failed:', error);
                this.models.gemini.status = 'error';
            }
        }
    },

    async mounted() {
        // Load saved API keys
        await this.loadApiKeys();

        // Validation checks
        this.$watch('textPrompt', () => {
            if (!this.textPrompt.trim() && this.isGenerating) {
                alert(CONFIG.UI.MESSAGES.NO_PROMPT);
            }
        });

        this.$watch('isImageMode', (newVal) => {
            if (newVal && !this.uploadedImage && this.isGenerating) {
                alert(CONFIG.UI.MESSAGES.NO_IMAGE);
            }
        });

        this.$watch('apiKeys.openai', (newVal) => {
            if (!newVal && this.isGenerating) {
                alert(CONFIG.UI.MESSAGES.NO_OPENAI_KEY);
            }
        });

        this.$watch('apiKeys.gemini', (newVal) => {
            if (!newVal && this.isGenerating) {
                alert(CONFIG.UI.MESSAGES.NO_GEMINI_KEY);
            }
        });
    }
}).mount('#app');