// Nexus Guard MUFG Content Script
class ContentAnalyzer {
    constructor() {
        this.settings = {};
        this.isActive = true;
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.analyzePageContent();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                'notifications'
            ]);
            
            this.settings = {
                notifications: result.notifications !== false
            };
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    setupEventListeners() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // Monitor form submissions
        document.addEventListener('submit', (e) => this.analyzeFormSubmission(e));

        // Monitor link clicks
        document.addEventListener('click', (e) => this.analyzeLinkClick(e));

        // Monitor file uploads
        document.addEventListener('change', (e) => this.analyzeFileUpload(e));

        // Monitor text input for suspicious content
        document.addEventListener('input', (e) => this.analyzeTextInput(e));

        // Monitor for dynamic content changes
        this.observeDOMChanges();
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'analyzePage':
                    const analysis = await this.analyzePageContent();
                    sendResponse({ success: true, analysis });
                    break;
                    
                case 'extractContent':
                    const content = this.extractPageContent();
                    sendResponse({ success: true, content });
                    break;
                    
                case 'scanElement':
                    const result = await this.scanElement(request.element);
                    sendResponse({ success: true, result });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    async analyzePageContent() {
        const analysis = {
            url: window.location.href,
            title: document.title,
            text: this.extractTextContent(),
            links: this.extractLinks(),
            forms: this.extractForms(),
            images: this.extractImages(),
            scripts: this.extractScripts(),
            threats: []
        };

        // Analyze text content for threats
        if (analysis.text) {
            const textThreats = await this.analyzeTextThreats(analysis.text);
            analysis.threats.push(...textThreats);
        }

        // Analyze links for threats
        const linkThreats = this.analyzeLinkThreats(analysis.links);
        analysis.threats.push(...linkThreats);

        // Analyze forms for threats
        const formThreats = this.analyzeFormThreats(analysis.forms);
        analysis.threats.push(...formThreats);

        return analysis;
    }

    extractTextContent() {
        // Extract main text content, excluding scripts and styles
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span, li, td, th');
        let text = '';
        
        textElements.forEach(element => {
            if (element.offsetParent !== null && element.textContent.trim()) {
                text += element.textContent.trim() + ' ';
            }
        });
        
        return text.substring(0, 5000); // Limit text length
    }

    extractLinks() {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.map(link => ({
            href: link.href,
            text: link.textContent.trim(),
            title: link.title,
            target: link.target
        }));
    }

    extractForms() {
        const forms = Array.from(document.querySelectorAll('form'));
        return forms.map(form => ({
            action: form.action,
            method: form.method,
            inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
                type: input.type,
                name: input.name,
                placeholder: input.placeholder,
                required: input.required
            }))
        }));
    }

    extractImages() {
        const images = Array.from(document.querySelectorAll('img'));
        return images.map(img => ({
            src: img.src,
            alt: img.alt,
            title: img.title
        }));
    }

    extractScripts() {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.map(script => ({
            src: script.src,
            type: script.type,
            content: script.textContent.substring(0, 200) // Limit content length
        }));
    }

    async analyzeTextThreats(text) {
        const threats = [];
        
        // Check for suspicious keywords
        const suspiciousKeywords = [
            'urgent', 'immediate action', 'account suspended', 'verify now',
            'click here', 'limited time', 'free money', 'lottery winner',
            'bank account', 'credit card', 'social security', 'password',
            'login', 'sign in', 'update now', 'security alert'
        ];

        suspiciousKeywords.forEach(keyword => {
            if (text.toLowerCase().includes(keyword.toLowerCase())) {
                threats.push({
                    type: 'suspicious_keyword',
                    severity: 'medium',
                    description: `Suspicious keyword detected: "${keyword}"`,
                    location: 'text_content'
                });
            }
        });

        // Check for excessive urgency
        const urgencyPatterns = [
            /(?:immediate|urgent|asap|right now|quickly)/gi,
            /(?:limited time|expires|deadline)/gi,
            /(?:act now|don't wait|hurry)/gi
        ];

        urgencyPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches && matches.length > 2) {
                threats.push({
                    type: 'excessive_urgency',
                    severity: 'high',
                    description: 'Excessive urgency detected in text',
                    location: 'text_content'
                });
            }
        });

        return threats;
    }

    analyzeLinkThreats(links) {
        const threats = [];
        
        links.forEach(link => {
            // Check for suspicious URL patterns
            if (this.isSuspiciousURL(link.href)) {
                threats.push({
                    type: 'suspicious_link',
                    severity: 'high',
                    description: `Suspicious link detected: ${link.href}`,
                    location: 'link',
                    element: link
                });
            }

            // Check for mismatched link text and URL
            if (this.isLinkMismatch(link)) {
                threats.push({
                    type: 'link_mismatch',
                    severity: 'medium',
                    description: 'Link text does not match destination URL',
                    location: 'link',
                    element: link
                });
            }
        });

        return threats;
    }

    isSuspiciousURL(url) {
        const suspiciousPatterns = [
            /bit\.ly/i,
            /tinyurl\.com/i,
            /goo\.gl/i,
            /t\.co/i,
            /is\.gd/i,
            /cli\.gs/i,
            /ow\.ly/i,
            /su\.pr/i,
            /twurl\.nl/i,
            /snipurl\.com/i,
            /short\.to/i,
            /BudURL\.com/i,
            /ping\.fm/i,
            /tr\.im/i,
            /bkite\.com/i,
            /snipr\.com/i,
            /shortie\.io/i,
            /short\.io/i,
            /rb\.gy/i,
            /tiny\.cc/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(url)) ||
               url.includes('suspicious') ||
               url.includes('phishing') ||
               url.includes('scam') ||
               url.includes('malware');
    }

    isLinkMismatch(link) {
        const url = new URL(link.href);
        const domain = url.hostname;
        const linkText = link.text.toLowerCase();
        
        // Check if link text suggests a different domain
        if (linkText.includes('google') && !domain.includes('google')) return true;
        if (linkText.includes('facebook') && !domain.includes('facebook')) return true;
        if (linkText.includes('amazon') && !domain.includes('amazon')) return true;
        if (linkText.includes('paypal') && !domain.includes('paypal')) return true;
        
        return false;
    }

    analyzeFormThreats(forms) {
        const threats = [];
        
        forms.forEach(form => {
            // Check for suspicious form actions
            if (this.isSuspiciousFormAction(form.action)) {
                threats.push({
                    type: 'suspicious_form',
                    severity: 'high',
                    description: `Suspicious form action: ${form.action}`,
                    location: 'form',
                    element: form
                });
            }

            // Check for sensitive input fields
            const sensitiveInputs = form.inputs.filter(input => 
                input.type === 'password' || 
                input.name.toLowerCase().includes('password') ||
                input.name.toLowerCase().includes('credit') ||
                input.name.toLowerCase().includes('ssn') ||
                input.name.toLowerCase().includes('social')
            );

            if (sensitiveInputs.length > 0) {
                threats.push({
                    type: 'sensitive_inputs',
                    severity: 'medium',
                    description: `Form contains sensitive input fields: ${sensitiveInputs.map(i => i.name).join(', ')}`,
                    location: 'form',
                    element: form
                });
            }
        });

        return threats;
    }

    isSuspiciousFormAction(action) {
        const suspiciousPatterns = [
            /phishing/i,
            /scam/i,
            /fraud/i,
            /malware/i,
            /suspicious/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(action));
    }

    analyzeFormSubmission(event) {
        const form = event.target;
        const formData = new FormData(form);
        
        // Check for suspicious form submissions
        let hasSuspiciousContent = false;
        
        for (let [key, value] of formData.entries()) {
            if (this.isSuspiciousFormValue(key, value)) {
                hasSuspiciousContent = true;
                break;
            }
        }

        if (hasSuspiciousContent) {
            this.showWarning('Suspicious form submission detected');
            // Could prevent submission here if needed
            // event.preventDefault();
        }
    }

    isSuspiciousFormValue(key, value) {
        const suspiciousPatterns = [
            /password/i,
            /credit.*card/i,
            /ssn|social.*security/i,
            /bank.*account/i,
            /routing.*number/i
        ];

        return suspiciousPatterns.some(pattern => 
            pattern.test(key) || pattern.test(value)
        );
    }

    analyzeLinkClick(event) {
        const link = event.target.closest('a');
        if (link && this.isSuspiciousURL(link.href)) {
            this.showWarning('Suspicious link detected');
            // Could prevent navigation here if needed
            // event.preventDefault();
        }
    }

    analyzeFileUpload(event) {
        const input = event.target;
        if (input.type === 'file' && input.files.length > 0) {
            const file = input.files[0];
            
            // Check for suspicious file types
            const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            if (suspiciousExtensions.includes(fileExtension)) {
                this.showWarning('Suspicious file type detected');
            }
        }
    }

    analyzeTextInput(event) {
        const input = event.target;
        const value = input.value;
        
        // Check for suspicious input content
        if (this.isSuspiciousInput(value)) {
            this.showWarning('Suspicious input detected');
        }
    }

    isSuspiciousInput(value) {
        const suspiciousPatterns = [
            /javascript:/i,
            /data:text\/html/i,
            /vbscript:/i,
            /onload/i,
            /onerror/i,
            /onclick/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(value));
    }

    observeDOMChanges() {
        // Monitor for dynamic content changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.analyzeNewContent(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    analyzeNewContent(element) {
        // Analyze newly added content for threats
        if (element.tagName === 'A') {
            this.analyzeLinkThreats([{
                href: element.href,
                text: element.textContent.trim(),
                title: element.title,
                target: element.target
            }]);
        }
    }

    showWarning(message) {
        if (!this.settings.notifications) return;

        // Create warning notification
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #451a03;
            color: #fbbf24;
            padding: 12px 16px;
            border-radius: 8px;
            border: 2px solid #f59e0b;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        warning.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>⚠️</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #fbbf24; cursor: pointer; margin-left: auto;">×</button>
            </div>
        `;

        // Add animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(warning);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (warning.parentNode) {
                warning.remove();
            }
        }, 5000);
    }

    async scanElement(element) {
        // Scan a specific element for threats
        const analysis = {
            tagName: element.tagName,
            text: element.textContent,
            attributes: Array.from(element.attributes).map(attr => ({
                name: attr.name,
                value: attr.value
            })),
            threats: []
        };

        // Analyze element text
        if (analysis.text) {
            const textThreats = await this.analyzeTextThreats(analysis.text);
            analysis.threats.push(...textThreats);
        }

        // Analyze element attributes
        const attributeThreats = this.analyzeAttributeThreats(analysis.attributes);
        analysis.threats.push(...attributeThreats);

        return analysis;
    }

    analyzeAttributeThreats(attributes) {
        const threats = [];
        
        attributes.forEach(attr => {
            if (this.isSuspiciousAttribute(attr.name, attr.value)) {
                threats.push({
                    type: 'suspicious_attribute',
                    severity: 'medium',
                    description: `Suspicious attribute detected: ${attr.name}="${attr.value}"`,
                    location: 'element_attribute'
                });
            }
        });

        return threats;
    }

    isSuspiciousAttribute(name, value) {
        const suspiciousPatterns = [
            /javascript:/i,
            /data:text\/html/i,
            /vbscript:/i,
            /on\w+/i, // Event handlers
            /expression/i
        ];

        return suspiciousPatterns.some(pattern => 
            pattern.test(name) || pattern.test(value)
        );
    }
}

// Initialize content analyzer
const contentAnalyzer = new ContentAnalyzer();

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (contentAnalyzer) {
        contentAnalyzer.handleMessage(request, sender, sendResponse);
    }
    return true;
});

// Notify background script that content script is loaded
chrome.runtime.sendMessage({
    action: 'contentScriptLoaded',
    url: window.location.href,
    timestamp: Date.now()
});
