// Nexus Guard MUFG Chrome Extension
class NexusGuardExtension {
    constructor() {
        this.apiEndpoint = 'http://127.0.0.1:5000';
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                'apiEndpoint',
                'notifications'
            ]);
            
            this.settings = {
                apiEndpoint: result.apiEndpoint || 'http://127.0.0.1:5000',
                notifications: result.notifications !== false
            };
            
            this.updateSettingsUI();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    updateSettingsUI() {
        const apiEndpointInput = document.getElementById('api-endpoint');
        const notificationsCheckbox = document.getElementById('notifications');
        
        if (apiEndpointInput) apiEndpointInput.value = this.settings.apiEndpoint;
        if (notificationsCheckbox) notificationsCheckbox.checked = this.settings.notifications;
    }

    setupEventListeners() {
        // Quick action buttons
        document.getElementById('scan-text').addEventListener('click', () => this.showTextArea());
        document.getElementById('scan-file').addEventListener('click', () => this.showUploadArea());
        document.getElementById('screenshot-analyze').addEventListener('click', () => this.takeScreenshot());

        // Text scanning
        document.getElementById('scan-text-btn').addEventListener('click', () => this.scanText());

        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.hideSettings());
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());

        // File input
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));

        // Upload area click
        document.querySelector('.upload-content').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('upload-area');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#3b82f6';
            uploadArea.style.background = '#1e3a8a15';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#374151';
            uploadArea.style.background = '#1f2937';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#374151';
            uploadArea.style.background = '#1f2937';
            
            const files = Array.from(e.dataTransfer.files);
            this.processFiles(files);
        });
    }

    showTextArea() {
        this.hideAllAreas();
        document.getElementById('text-area').style.display = 'block';
        document.getElementById('text-input').focus();
    }

    showUploadArea() {
        this.hideAllAreas();
        document.getElementById('upload-area').style.display = 'block';
    }

    hideAllAreas() {
        document.getElementById('text-area').style.display = 'none';
        document.getElementById('upload-area').style.display = 'none';
        document.getElementById('results').style.display = 'none';
    }

    async scanText() {
        const text = document.getElementById('text-input').value.trim();
        if (!text) {
            this.showNotification('Please enter some text to scan', 'error');
            return;
        }

        this.showResults();
        this.updateResultStatus('Analyzing text...', 'analyzing');
        
        try {
            const response = await this.callAPI('/predict-text', { text });
            this.displayTextResults(response);
        } catch (error) {
            this.displayError('Error scanning text: ' + error.message);
        }
    }



    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            this.processFiles(files);
        }
    }

    async processFiles(files) {
        this.showResults();
        this.updateResultStatus(`Processing ${files.length} file(s)...`, 'analyzing');
        
        const results = [];
        
        for (const file of files) {
            try {
                const result = await this.scanFile(file);
                results.push({ file: file.name, result });
            } catch (error) {
                results.push({ file: file.name, error: error.message });
            }
        }
        
        this.displayFileResults(results);
    }

    async scanFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        let endpoint = '';
        if (file.type.startsWith('image/')) {
            endpoint = '/predict-image';
            formData.append('image', file);
        } else if (file.type.startsWith('audio/')) {
            endpoint = '/predict-audio';
            formData.append('audio', file);
        } else if (file.type.startsWith('video/')) {
            endpoint = '/predict-video';
            formData.append('video', file);
        } else {
            throw new Error('Unsupported file type');
        }
        
        return await this.callAPI(endpoint, formData, true);
    }

    async callAPI(endpoint, data, isFormData = false) {
        const url = this.settings.apiEndpoint + endpoint;
        
        const options = {
            method: 'POST',
            headers: isFormData ? {} : { 'Content-Type': 'application/json' },
            body: isFormData ? data : JSON.stringify(data)
        };
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }

    showResults() {
        this.hideAllAreas();
        document.getElementById('results').style.display = 'block';
    }

    updateResultStatus(message, type = 'info') {
        const statusElement = document.getElementById('result-status');
        const iconElement = statusElement.querySelector('i');
        const textElement = statusElement.querySelector('span');
        
        // Remove existing status classes
        statusElement.className = 'result-status';
        
        // Set icon and text based on type
        switch (type) {
            case 'analyzing':
                iconElement.className = 'fas fa-spinner fa-spin';
                textElement.textContent = message;
                break;
            case 'safe':
                iconElement.className = 'fas fa-check-circle';
                textElement.textContent = message;
                statusElement.classList.add('status-safe');
                break;
            case 'threat':
                iconElement.className = 'fas fa-exclamation-triangle';
                textElement.textContent = message;
                statusElement.classList.add('status-threat');
                break;
            case 'spoofed':
                iconElement.className = 'fas fa-exclamation-triangle';
                textElement.textContent = message;
                statusElement.classList.add('status-spoofed');
                break;
            default:
                iconElement.className = 'fas fa-info-circle';
                textElement.textContent = message;
        }
    }

    displayTextResults(response) {
        const isThreat = response.prediction === 1;
        const confidence = response.probability || 0;
        
        if (isThreat) {
            this.updateResultStatus('THREAT DETECTED!', 'threat');
            this.showNotification('🚨 Phishing/Scam content detected!', 'warning');
        } else {
            this.updateResultStatus('Content appears safe', 'safe');
            this.showNotification('✅ Content appears safe', 'success');
        }
        
        const details = document.getElementById('result-details');
        details.innerHTML = `
            <div style="margin-bottom: 16px;">
                <strong>Analysis Result:</strong> ${isThreat ? '🚨 THREAT' : '✅ SAFE'}
            </div>
            <div style="margin-bottom: 16px;">
                <strong>Confidence:</strong> ${(confidence * 100).toFixed(1)}%
            </div>
            <div style="margin-bottom: 16px;">
                <strong>Recommendation:</strong> ${isThreat ? 
                    'Do not engage with this content. Report if suspicious.' : 
                    'Content appears legitimate and safe to interact with.'}
            </div>
        `;
    }

    displayFileResults(results) {
        let hasThreats = false;
        let hasSpoofed = false;
        
        const details = document.getElementById('result-details');
        let html = '<div style="margin-bottom: 16px;"><strong>File Analysis Results:</strong></div>';
        
        results.forEach(({ file, result, error }) => {
            if (error) {
                html += `
                    <div style="margin-bottom: 12px; padding: 8px; background: #7f1d1d; border-radius: 6px; border: 1px solid #ef4444;">
                        <strong>${file}:</strong> Error - ${error}
                    </div>
                `;
                return;
            }
            
            const isThreat = result.prediction === 1;
            const isSpoofed = result.is_spoofed === 'spoofed';
            const confidence = result.confidence || 0;
            
            if (isThreat) hasThreats = true;
            if (isSpoofed) hasSpoofed = true;
            
            let statusClass = isThreat ? 'status-threat' : 'status-safe';
            let statusIcon = isThreat ? '🚨' : '✅';
            let statusText = isThreat ? 'THREAT' : 'SAFE';
            
            if (isSpoofed) {
                statusClass = 'status-spoofed';
                statusIcon = '🎭';
                statusText = 'SPOOFED';
            }
            
            html += `
                <div style="margin-bottom: 12px; padding: 12px; background: #374151; border-radius: 8px; border: 1px solid #4b5563;">
                    <div style="margin-bottom: 8px;">
                        <strong>${file}</strong>
                    </div>
                    <div style="margin-bottom: 6px;">
                        <span class="${statusClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${statusIcon} ${statusText}
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #9ca3af;">
                        <div>Confidence: ${(confidence * 100).toFixed(1)}%</div>
                        ${result.is_spoofed ? `<div>Spoof Detection: ${result.is_spoofed === 'spoofed' ? '🎭 SPOOFED' : '✅ AUTHENTIC'}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        details.innerHTML = html;
        
        // Update overall status
        if (hasSpoofed) {
            this.updateResultStatus('🎭 SPOOFED CONTENT DETECTED!', 'spoofed');
            this.showNotification('🎭 Deepfake/Spoofed content detected!', 'warning');
        } else if (hasThreats) {
            this.updateResultStatus('🚨 THREATS DETECTED!', 'threat');
            this.showNotification('🚨 Threat content detected!', 'warning');
        } else {
            this.updateResultStatus('All files appear safe', 'safe');
            this.showNotification('✅ All files appear safe', 'success');
        }
    }

    displayError(message) {
        this.updateResultStatus('Error occurred', 'error');
        const details = document.getElementById('result-details');
        details.innerHTML = `
            <div style="color: #ef4444; padding: 12px; background: #7f1d1d; border-radius: 6px; border: 1px solid #ef4444;">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }

    showSettings() {
        document.getElementById('settings-modal').style.display = 'block';
    }

    hideSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    async saveSettings() {
        const apiEndpoint = document.getElementById('api-endpoint').value.trim();
        const notifications = document.getElementById('notifications').checked;
        
        this.settings = { apiEndpoint, notifications };
        
        try {
            await chrome.storage.sync.set(this.settings);
            this.showNotification('Settings saved successfully!', 'success');
            this.hideSettings();
        } catch (error) {
            this.showNotification('Error saving settings: ' + error.message, 'error');
        }
    }

    async takeScreenshot() {
        try {
            console.log('TakeScreenshot called from popup');
            this.showNotification('Taking screenshot and analyzing...', 'info');
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Active tab found:', tab);
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            // Send message to background script to take screenshot
            console.log('Sending takeScreenshot message to background script');
            const response = await chrome.runtime.sendMessage({
                action: 'takeScreenshot',
                tabId: tab.id
            });
            
            console.log('Response from background script:', response);
            
            if (response && response.success) {
                this.showNotification('Screenshot captured and analyzed!', 'success');
                // Handle case where result might be undefined
                const result = response.result || { threats: [], confidence: 0 };
                console.log('Processing result:', result);
                this.showScreenshotResult(result);
            } else {
                throw new Error(response?.error || 'Failed to take screenshot');
            }
            
        } catch (error) {
            console.error('Screenshot error:', error);
            this.showNotification('Screenshot failed: ' + error.message, 'error');
        }
    }

    showScreenshotResult(result) {
        this.hideAllAreas();
        const results = document.getElementById('results');
        results.style.display = 'block';
        
        // Determine status based on result
        const hasThreats = result.threats && result.threats.length > 0;
        const confidence = result.confidence || 0;
        
        if (hasThreats) {
            this.updateResultStatus('⚠️ Threats Detected', 'threat');
        } else {
            this.updateResultStatus('✅ Screenshot Safe', 'safe');
        }
        
        const details = document.getElementById('result-details');
        if (hasThreats) {
            details.innerHTML = `
                <div style="color: #f59e0b; padding: 12px; background: #451a03; border-radius: 6px; border: 1px solid #f59e0b;">
                    <strong>⚠️ Threats Detected:</strong><br>
                    ${result.threats.join(', ')}
                </div>
                <div style="margin-top: 12px; color: #9ca3af; font-size: 12px;">
                    Confidence: ${(confidence * 100).toFixed(1)}%<br>
                    Screenshot saved to downloads folder.
                </div>
            `;
        } else {
            details.innerHTML = `
                <div style="color: #10b981; padding: 12px; background: #064e3b; border-radius: 6px; border: 1px solid #10b981;">
                    <strong>✅ No Threats Detected</strong><br>
                    Screenshot analysis completed successfully.
                </div>
                <div style="margin-top: 12px; color: #9ca3af; font-size: 12px;">
                    Confidence: ${(confidence * 100).toFixed(1)}%<br>
                    Screenshot saved to downloads folder.
                </div>
            `;
        }
        
        // Show additional info if available
        if (result.apiResult) {
            details.innerHTML += `
                <div style="margin-top: 12px; padding: 8px; background: #374151; border-radius: 6px; border: 1px solid #4b5563;">
                    <strong>AI Analysis:</strong> ${result.apiResult.prediction === 1 ? '🚨 Threat Detected' : '✅ Safe'} 
                    (${(result.apiResult.probability * 100).toFixed(1)}% confidence)
                </div>
            `;
        } else if (result.basicAnalysis) {
            details.innerHTML += `
                <div style="margin-top: 12px; padding: 8px; background: #374151; border-radius: 6px; border: 1px solid #4b5563;">
                    <strong>Basic Analysis:</strong> Keyword-based scan completed
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        if (!this.settings.notifications) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#7f1d1d' : type === 'warning' ? '#451a03' : '#064e3b'};
            color: 'white';
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Add close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => notification.remove());
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        // Add to body
        document.body.appendChild(notification);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NexusGuardExtension();
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('settings-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});
