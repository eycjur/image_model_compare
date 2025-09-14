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
            ERROR: { text: 'エラー', class: 'bg-red-100 text-red-800' },
            RETRYING: { text: 'リトライ中', class: 'bg-orange-100 text-orange-800' }
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
            showCamera: false,
            cameraStream: null,
            availableCameras: [],
            selectedCameraId: null,
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
                    name: 'DALLE-2',
                    when: '2022年4月'
                },
                dalle3: {
                    status: 'waiting',
                    image: null,
                    time: null,
                    name: 'DALLE-3',
                    when: '2023年10月'
                },
                gemini: {
                    status: 'waiting',
                    image: null,
                    time: null,
                    name: 'Gemini 2.5 Flash Image (Nano Banana)',
                    when: '2025年8月'
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
            // Also stop camera if running
            this.stopCamera();
        },

        async enumerateCameras() {
            try {
                console.log('Getting device list...');
                const devices = await navigator.mediaDevices.enumerateDevices();

                console.log('All devices found:', devices.map(d => ({
                    kind: d.kind,
                    label: d.label || 'No label',
                    deviceId: d.deviceId.substring(0, 20) + '...'
                })));

                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                console.log(`Found ${videoDevices.length} video input devices`);

                this.availableCameras = videoDevices.map((device, index) => {
                    const label = device.label || `カメラ ${index + 1}`;

                    // More comprehensive iPhone/Continuity camera detection
                    const isIPhone = label.toLowerCase().includes('iphone') ||
                                    label.toLowerCase().includes('continuity') ||
                                    label.toLowerCase().includes('デスク表示') ||
                                    label.toLowerCase().includes('desk view') ||
                                    label.includes('iPhone') ||
                                    label.includes('Continuity') ||
                                    // Sometimes appears as just a generic name but has certain patterns
                                    (label.includes('Camera') && device.deviceId.length > 50);

                    console.log(`Camera ${index + 1}:`, {
                        label,
                        deviceId: device.deviceId.substring(0, 30) + '...',
                        isIPhone,
                        fullDeviceId: device.deviceId
                    });

                    return {
                        id: device.deviceId,
                        label,
                        isIPhone
                    };
                });

                console.log(`Processed ${this.availableCameras.length} cameras for UI`);

                // Auto-select iPhone camera if available, otherwise select first camera
                const iPhoneCamera = this.availableCameras.find(camera => camera.isIPhone);
                if (iPhoneCamera) {
                    this.selectedCameraId = iPhoneCamera.id;
                    console.log('✅ Auto-selected iPhone camera:', iPhoneCamera.label);
                } else if (this.availableCameras.length > 0) {
                    this.selectedCameraId = this.availableCameras[0].id;
                    console.log('✅ Auto-selected first camera:', this.availableCameras[0].label);
                } else {
                    console.warn('⚠️ No cameras available for selection');
                }

                // Additional debug: Try to detect Continuity cameras by deviceId pattern
                const suspectedContinuity = this.availableCameras.filter(camera =>
                    camera.id.length > 50 && !camera.isIPhone
                );
                if (suspectedContinuity.length > 0) {
                    console.log('🔍 Suspected Continuity cameras (by deviceId length):', suspectedContinuity);
                }

            } catch (error) {
                console.error('❌ Failed to enumerate cameras:', error);
                this.availableCameras = [];
            }
        },

        async startCamera() {
            try {
                // Show camera UI first
                this.showCamera = true;
                await this.$nextTick();

                console.log('Starting camera initialization...');

                // Request camera permission to enumerate devices properly
                console.log('Requesting initial camera access...');
                const tempStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 } }
                });

                console.log('Initial camera access granted, stopping temporary stream...');
                tempStream.getTracks().forEach(track => track.stop());

                // Small delay to ensure cleanup
                await new Promise(resolve => setTimeout(resolve, 100));

                // Now enumerate all available cameras
                console.log('Enumerating cameras...');
                await this.enumerateCameras();

                // Start the selected camera
                console.log('Starting selected camera...');
                await this.startSelectedCamera();

            } catch (error) {
                console.error('Camera initialization failed:', error);
                this.showCamera = false;

                let message = 'カメラにアクセスできませんでした。';
                if (error.name === 'NotAllowedError') {
                    message = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラの許可を確認してください。';
                } else if (error.name === 'NotFoundError') {
                    message = 'カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。';
                } else if (error.name === 'OverconstrainedError') {
                    message = 'カメラの設定に問題があります。別のカメラを試してください。';
                }
                alert(message);
            }
        },

        async startSelectedCamera() {
            try {
                const constraints = {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };

                const selectedCamera = this.availableCameras.find(c => c.id === this.selectedCameraId);
                console.log('Starting camera:', selectedCamera || 'Default camera');

                // Use selected camera if available
                if (this.selectedCameraId) {
                    constraints.video.deviceId = { exact: this.selectedCameraId };
                    console.log('Using specific camera with deviceId:', this.selectedCameraId.substring(0, 30) + '...');
                } else {
                    // Fallback to environment camera on mobile
                    constraints.video.facingMode = 'environment';
                    console.log('Using fallback with facingMode: environment');
                }

                console.log('Camera constraints:', constraints);

                this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('✅ Camera stream obtained successfully');

                // Wait for next tick to ensure video element is rendered
                await this.$nextTick();
                if (this.$refs.video) {
                    this.$refs.video.srcObject = this.cameraStream;
                    console.log('✅ Camera stream assigned to video element');

                    // Log actual video properties once metadata is loaded
                    this.$refs.video.addEventListener('loadedmetadata', () => {
                        console.log('📹 Video properties:', {
                            videoWidth: this.$refs.video.videoWidth,
                            videoHeight: this.$refs.video.videoHeight,
                            streamActive: this.cameraStream?.active
                        });
                    });
                } else {
                    console.error('❌ Video element not found');
                }

            } catch (error) {
                console.error('❌ Selected camera failed:', {
                    error: error.name,
                    message: error.message,
                    selectedCameraId: this.selectedCameraId?.substring(0, 30) + '...'
                });

                // Try with default constraints
                try {
                    console.log('🔄 Trying fallback camera...');
                    this.cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                    });

                    console.log('✅ Fallback camera stream obtained');

                    await this.$nextTick();
                    if (this.$refs.video) {
                        this.$refs.video.srcObject = this.cameraStream;
                        console.log('✅ Fallback camera stream assigned to video element');
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback camera also failed:', fallbackError);
                    throw fallbackError;
                }
            }
        },

        async switchCamera(cameraId) {
            this.selectedCameraId = cameraId;
            if (this.showCamera && this.cameraStream) {
                // Stop current stream
                this.cameraStream.getTracks().forEach(track => track.stop());
                this.cameraStream = null;

                // Start new camera stream
                await this.startSelectedCamera();
            }
        },

        stopCamera() {
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => track.stop());
                this.cameraStream = null;
            }
            this.showCamera = false;
            if (this.$refs.video) {
                this.$refs.video.srcObject = null;
            }
        },

        capturePhoto() {
            if (!this.cameraStream || !this.$refs.video || !this.$refs.canvas) {
                alert('カメラが正常に動作していません。');
                return;
            }

            const video = this.$refs.video;
            const canvas = this.$refs.canvas;
            const context = canvas.getContext('2d');

            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to data URL
            this.uploadedImage = canvas.toDataURL('image/jpeg', 0.8);

            // Stop camera after capture
            this.stopCamera();
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

        async retryWithBackoff(fn, maxRetries = 3, modelName = '') {
            let lastError;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Update status to show retry attempt
                    if (attempt > 1 && modelName) {
                        const statusConfig = CONFIG.UI.STATUS.GENERATING;
                        const statusElement = document.getElementById(`${modelName}-status`);
                        if (statusElement) {
                            statusElement.textContent = `リトライ中 (${attempt}/${maxRetries})`;
                            statusElement.className = `px-3 py-1 rounded-full text-xs font-medium ${statusConfig.class}`;
                        }
                    }

                    const result = await fn();
                    return result;
                } catch (error) {
                    lastError = error;
                    console.log(`Attempt ${attempt}/${maxRetries} failed for ${modelName}:`, error.message);

                    // Don't retry for certain error types
                    if (error.name === 'NotAllowedError' ||
                        error.name === 'AbortError' ||
                        error.message.includes('Invalid API key') ||
                        error.message.includes('insufficient quota')) {
                        console.log(`Non-retryable error for ${modelName}, stopping retries`);
                        throw error;
                    }

                    // If this wasn't the last attempt, wait before retrying
                    if (attempt < maxRetries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
                        console.log(`Waiting ${delay}ms before retry ${attempt + 1} for ${modelName}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            // All retries failed
            console.error(`All ${maxRetries} attempts failed for ${modelName}:`, lastError);
            throw lastError;
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
                const data = await this.retryWithBackoff(async () => {
                    if (this.isImageMode) {
                        // Convert to PNG for DALLE-2 editing requirements
                        const pngBlob = await ImageUtils.convertToPngBlob(this.uploadedImage);
                        return await APIService.editOpenAIImage(
                            this.apiKeys.openai,
                            pngBlob,
                            this.textPrompt,
                            CONFIG.API.OPENAI.SIZES.DALLE2,
                            CONFIG.API.OPENAI.MODELS.DALLE2
                        );
                    } else {
                        return await APIService.generateOpenAIImage(
                            this.apiKeys.openai,
                            CONFIG.API.OPENAI.MODELS.DALLE2,
                            this.textPrompt,
                            CONFIG.API.OPENAI.SIZES.DALLE2
                        );
                    }
                }, 3, 'dalle2');

                const duration = Math.round((Date.now() - startTime) / 1000);
                this.models.dalle2.image = data.data[0].url;
                this.models.dalle2.status = 'completed';
                this.models.dalle2.time = duration;
            } catch (error) {
                console.error('DALLE-2 generation failed after all retries:', error);
                this.models.dalle2.status = 'error';
            }
        },

        async generateDALLE3() {
            const startTime = Date.now();
            this.models.dalle3.status = 'generating';

            try {
                const data = await this.retryWithBackoff(async () => {
                    return await APIService.generateOpenAIImage(
                        this.apiKeys.openai,
                        CONFIG.API.OPENAI.MODELS.DALLE3,
                        this.textPrompt,
                        CONFIG.API.OPENAI.SIZES.DALLE3,
                        'standard'
                    );
                }, 3, 'dalle3');

                const duration = Math.round((Date.now() - startTime) / 1000);
                this.models.dalle3.image = data.data[0].url;
                this.models.dalle3.status = 'completed';
                this.models.dalle3.time = duration;
            } catch (error) {
                console.error('DALLE-3 generation failed after all retries:', error);
                this.models.dalle3.status = 'error';
            }
        },

        async generateGemini() {
            const startTime = Date.now();
            this.models.gemini.status = 'generating';

            try {
                const imageUrl = await this.retryWithBackoff(async () => {
                    let requestBody;
                    if (this.isImageMode && this.uploadedImage) {
                        const base64Data = ImageUtils.extractBase64Data(this.uploadedImage);
                        requestBody = {
                            contents: [{
                                parts: [
                                    { text: `Generate the edited image: ${this.textPrompt}` },
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

                    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                }, 3, 'gemini');

                const duration = Math.round((Date.now() - startTime) / 1000);

                this.models.gemini.image = imageUrl;
                this.models.gemini.status = 'completed';
                this.models.gemini.time = duration;
            } catch (error) {
                console.error('Gemini generation failed after all retries:', error);
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

        // Cleanup camera on page unload
        window.addEventListener('beforeunload', () => {
            this.stopCamera();
        });
    },

    beforeUnmount() {
        // Clean up camera stream when component is destroyed
        this.stopCamera();

        // Remove event listener
        window.removeEventListener('beforeunload', this.stopCamera);
    }
}).mount('#app');