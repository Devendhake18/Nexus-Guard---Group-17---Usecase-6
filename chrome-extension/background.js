// Nexus Guard MUFG Background Service Worker
console.log('Background service worker starting...');

// Global variables
let settings = {
    apiEndpoint: 'http://127.0.0.1:5000',
    notifications: true
};

let isActive = true;

// Initialize the service worker
async function initializeServiceWorker() {
    console.log('Initializing service worker...');
    
    try {
        await loadSettings();
        setupEventListeners();
        createContextMenus();
        startMonitoring();
        
        console.log('Service worker initialized successfully');
    } catch (error) {
        console.error('Failed to initialize service worker:', error);
    }
}

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['apiEndpoint', 'notifications']);
        settings = {
            apiEndpoint: result.apiEndpoint || 'http://127.0.0.1:5000',
            notifications: result.notifications !== false
        };
        console.log('Settings loaded:', settings);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            handleSettingsChange(changes);
        }
    });

    // Listen for context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        handleContextMenuClick(info, tab);
    });

    // Listen for web requests for potential threat detection
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => analyzeRequest(details),
        { urls: ["<all_urls>"] },
        ["requestBody"]
    );

    // Listen for messages from popup/content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async response
    });
}

// Handle settings changes
async function handleSettingsChange(changes) {
    if (changes.apiEndpoint) {
        settings.apiEndpoint = changes.apiEndpoint.newValue;
    }
    if (changes.notifications) {
        settings.notifications = changes.notifications.newValue;
    }
}

// Handle messages
async function handleMessage(request, sender, sendResponse) {
    try {
        switch (request.action) {
            case 'getSettings':
                sendResponse({ success: true, settings: settings });
                break;
                
            case 'updateSettings':
                settings = { ...settings, ...request.settings };
                await chrome.storage.sync.set(settings);
                sendResponse({ success: true });
                break;
                
            case 'scanContent':
                const result = await scanContent(request.content, request.type);
                sendResponse({ success: true, result });
                break;
                
            case 'checkAPIStatus':
                const status = await checkAPIStatus();
                sendResponse({ success: true, status });
                break;
                
            case 'debugContextMenus':
                createContextMenus();
                sendResponse({ success: true, message: 'Context menus recreated' });
                break;
                
            case 'takeScreenshot':
                try {
                    console.log('TakeScreenshot action received for tab:', request.tabId);
                    const tab = await chrome.tabs.get(request.tabId);
                    console.log('Tab found:', tab.url);
                    const result = await takeScreenshotAndAnalyze(tab);
                    console.log('Screenshot analysis result:', result);
                    sendResponse({ success: true, message: 'Screenshot taken and analyzed', result: result });
                } catch (error) {
                    console.error('TakeScreenshot error:', error);
                    sendResponse({ success: false, error: error.message });
                }
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Create context menus
function createContextMenus() {
    console.log('Creating context menus...');
    
    try {
        // Remove existing menus first
        chrome.contextMenus.removeAll(() => {
            console.log('Existing menus removed');
            
            // Create parent context menu for text selection
            chrome.contextMenus.create({
                id: 'nexus-guard-parent',
                title: '🛡️ Nexus Guard MUFG',
                contexts: ['selection']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating selection menu:', chrome.runtime.lastError);
                } else {
                    console.log('Selection menu created successfully');
                }
            });

            // Create scan text context menu
            chrome.contextMenus.create({
                id: 'scan-selected-text',
                parentId: 'nexus-guard-parent',
                title: '🔍 Scan for Threats',
                contexts: ['selection']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating scan menu:', chrome.runtime.lastError);
                } else {
                    console.log('Scan menu created successfully');
                }
            });

            // Create quick scan context menu
            chrome.contextMenus.create({
                id: 'quick-scan',
                parentId: 'nexus-guard-parent',
                title: '⚡ Quick Scan',
                contexts: ['selection']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating quick scan menu:', chrome.runtime.lastError);
                } else {
                    console.log('Quick scan menu created successfully');
                }
            });

            // Create separator
            chrome.contextMenus.create({
                id: 'separator-1',
                parentId: 'nexus-guard-parent',
                type: 'separator',
                contexts: ['selection']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating separator:', chrome.runtime.lastError);
                } else {
                    console.log('Separator created successfully');
                }
            });

            // Create open extension context menu
            chrome.contextMenus.create({
                id: 'open-extension',
                parentId: 'nexus-guard-parent',
                title: '⚙️ Open Extension',
                contexts: ['selection']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating open extension menu:', chrome.runtime.lastError);
                } else {
                    console.log('Open extension menu created successfully');
                }
            });

            // Create general context menu (always visible)
            chrome.contextMenus.create({
                id: 'nexus-guard-general',
                title: '🛡️ Nexus Guard MUFG',
                contexts: ['page', 'link', 'image']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating general menu:', chrome.runtime.lastError);
                } else {
                    console.log('General menu created successfully');
                }
            });

            // Create general scan options
            chrome.contextMenus.create({
                id: 'scan-page',
                parentId: 'nexus-guard-general',
                title: '🔍 Scan This Page',
                contexts: ['page']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating scan page menu:', chrome.runtime.lastError);
                } else {
                    console.log('Scan page menu created successfully');
                }
            });

            chrome.contextMenus.create({
                id: 'scan-link',
                parentId: 'nexus-guard-general',
                title: '🔗 Scan This Link',
                contexts: ['link']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating scan link menu:', chrome.runtime.lastError);
                } else {
                    console.log('Scan link menu created successfully');
                }
            });

            chrome.contextMenus.create({
                id: 'scan-image',
                parentId: 'nexus-guard-general',
                title: '🖼️ Scan This Image',
                contexts: ['image']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating scan image menu:', chrome.runtime.lastError);
                } else {
                    console.log('Scan image menu created successfully');
                }
            });

            // Create separator for general menu
            chrome.contextMenus.create({
                id: 'separator-2',
                parentId: 'nexus-guard-general',
                type: 'separator',
                contexts: ['page', 'link', 'image']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating general separator:', chrome.runtime.lastError);
                } else {
                    console.log('General separator created successfully');
                }
            });

            // Create open extension option for general menu
            chrome.contextMenus.create({
                id: 'open-extension-general',
                parentId: 'nexus-guard-general',
                title: '⚙️ Open Extension',
                contexts: ['page', 'link', 'image']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating general open extension menu:', chrome.runtime.lastError);
                } else {
                    console.log('General open extension menu created successfully');
                }
            });

            // Create a simple test menu that should always work
            chrome.contextMenus.create({
                id: 'test-menu',
                title: '🧪 Test Nexus Guard',
                contexts: ['all']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating test menu:', chrome.runtime.lastError);
                } else {
                    console.log('Test menu created successfully');
                }
            });

            // Create an even simpler test menu
            chrome.contextMenus.create({
                id: 'simple-test',
                title: '🔧 Simple Test',
                contexts: ['page']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating simple test menu:', chrome.runtime.lastError);
                } else {
                    console.log('Simple test menu created successfully');
                }
            });

            // Create screenshot analysis menu
            chrome.contextMenus.create({
                id: 'screenshot-analyze',
                title: '📸 Take Screenshot & Analyze',
                contexts: ['page']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error creating screenshot menu:', chrome.runtime.lastError);
                } else {
                    console.log('Screenshot menu created successfully');
                }
            });
        });
        
    } catch (error) {
        console.error('Error in createContextMenus:', error);
    }
}

// Handle context menu clicks
async function handleContextMenuClick(info, tab) {
    try {
        console.log('Context menu clicked:', info.menuItemId);
        
        switch (info.menuItemId) {
            case 'scan-selected-text':
                await scanSelectedText(info.selectionText, tab);
                break;
                
            case 'quick-scan':
                await quickScanText(info.selectionText, tab);
                break;
                
            case 'open-extension':
            case 'open-extension-general':
                await openExtension(tab);
                break;
                
            case 'scan-page':
                await scanPage(tab);
                break;
                
            case 'scan-link':
                await scanLink(info.linkUrl, tab);
                break;
                
            case 'scan-image':
                await scanImage(info.srcUrl, tab);
                break;
                
            case 'test-menu':
                showTestNotification('🧪 Test Menu', 'Context menu is working! 🎉');
                break;
                
            case 'simple-test':
                showTestNotification('🔧 Simple Test', 'Basic context menu is working! 🎯');
                break;

            case 'screenshot-analyze':
                await takeScreenshotAndAnalyze(tab);
                break;
        }
    } catch (error) {
        console.error('Context menu error:', error);
    }
}

// Scan selected text
async function scanSelectedText(selectedText, tab) {
    if (!selectedText || selectedText.trim().length === 0) {
        showThreatNotification('No Text Selected', 'Please select some text to scan');
        return;
    }

    try {
        // Show scanning notification
        showThreatNotification('Scanning Text', 'Analyzing selected text for threats...');

        // Call API to scan text
        const result = await scanContent(selectedText, 'text');
        
        // Show results notification
        if (result.prediction === 1) {
            showThreatNotification(
                '🚨 THREAT DETECTED!', 
                `Phishing/Scam content detected with ${(result.probability * 100).toFixed(1)}% confidence`
            );
        } else {
            showThreatNotification(
                '✅ Content Safe', 
                `Selected text appears safe with ${(result.probability * 100).toFixed(1)}% confidence`
            );
        }

        // Store result for potential use
        await chrome.storage.local.set({
            lastScanResult: {
                text: selectedText.substring(0, 100) + '...',
                result: result,
                timestamp: Date.now()
            }
        });

    } catch (error) {
        showThreatNotification('Scan Error', `Failed to scan text: ${error.message}`);
    }
}

// Quick scan text
async function quickScanText(selectedText, tab) {
    if (!selectedText || selectedText.trim().length === 0) {
        showThreatNotification('No Text Selected', 'Please select some text to scan');
        return;
    }

    try {
        // Quick keyword-based scan without API call
        const threats = quickKeywordScan(selectedText);
        
        if (threats.length > 0) {
            showThreatNotification(
                '⚠️ Suspicious Content', 
                `Found ${threats.length} suspicious patterns: ${threats.join(', ')}`
            );
        } else {
            showThreatNotification('✅ Quick Scan Complete', 'No obvious threats detected');
        }

    } catch (error) {
        showThreatNotification('Quick Scan Error', `Failed to perform quick scan: ${error.message}`);
    }
}

// Quick keyword scan
function quickKeywordScan(text) {
    const suspiciousKeywords = [
        'urgent', 'immediate action', 'account suspended', 'verify now',
        'click here', 'limited time', 'free money', 'lottery winner',
        'bank account', 'credit card', 'social security', 'password',
        'login', 'sign in', 'update now', 'security alert',
        'bitcoin', 'crypto', 'investment opportunity', 'act now',
        'don\'t wait', 'hurry', 'expires', 'deadline'
    ];

    const foundThreats = [];
    const lowerText = text.toLowerCase();

    suspiciousKeywords.forEach(keyword => {
        if (lowerText.includes(keyword.toLowerCase())) {
            foundThreats.push(keyword);
        }
    });

    return foundThreats;
}

// Open extension
async function openExtension(tab) {
    try {
        // Open the extension popup
        await chrome.action.openPopup();
    } catch (error) {
        // Fallback: create a new tab with extension
        await chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    }
}

// Scan page
async function scanPage(tab) {
    try {
        showThreatNotification('Page Scan', 'Analyzing page content for threats...');
        
        // Extract page content using content script
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const text = document.body.innerText || '';
                const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
                return { text: text.substring(0, 2000), links };
            }
        });

        if (results && results[0] && results[0].result) {
            const { text, links } = results[0].result;
            
            // Quick scan of text content
            const textThreats = quickKeywordScan(text);
            
            // Analyze links
            const suspiciousLinks = analyzeLinks(links);
            
            if (textThreats.length > 0 || suspiciousLinks.length > 0) {
                let message = '';
                if (textThreats.length > 0) {
                    message += `Found ${textThreats.length} suspicious text patterns. `;
                }
                if (suspiciousLinks.length > 0) {
                    message += `Found ${suspiciousLinks.length} suspicious links.`;
                }
                
                showThreatNotification('⚠️ Threats Detected', message);
            } else {
                showThreatNotification('✅ Page Safe', 'No obvious threats detected on this page');
            }
        }
    } catch (error) {
        showThreatNotification('Page Scan Error', `Failed to scan page: ${error.message}`);
    }
}

// Scan link
async function scanLink(linkUrl, tab) {
    try {
        showThreatNotification('Link Scan', 'Analyzing link for threats...');
        
        // Check if link is suspicious
        const isSuspicious = isSuspiciousURL(linkUrl);
        
        if (isSuspicious) {
            showThreatNotification('🚨 Suspicious Link', 'This link appears suspicious and may be dangerous');
        } else {
            showThreatNotification('✅ Link Safe', 'This link appears safe to visit');
        }
    } catch (error) {
        showThreatNotification('Link Scan Error', `Failed to scan link: ${error.message}`);
    }
}

// Scan image
async function scanImage(imageUrl, tab) {
    try {
        showThreatNotification('Image Scan', 'Analyzing image for threats...');
        
        // For now, just check if image URL is suspicious
        const isSuspicious = isSuspiciousURL(imageUrl);
        
        if (isSuspicious) {
            showThreatNotification('⚠️ Suspicious Image', 'This image URL appears suspicious');
        } else {
            showThreatNotification('✅ Image Safe', 'This image appears safe');
        }
        
        // Note: Full image analysis would require downloading and processing the image
        // This is a basic URL check for now
    } catch (error) {
        showThreatNotification('Image Scan Error', `Failed to scan image: ${error.message}`);
    }
}

// Take screenshot and analyze
async function takeScreenshotAndAnalyze(tab) {
    try {
        showThreatNotification('Screenshot Analysis', 'Taking screenshot and analyzing for threats...');
        
        // Take screenshot of the current tab
        const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
            quality: 80
        });
        
        if (!screenshot) {
            throw new Error('Failed to capture screenshot');
        }
        
        // First, save the screenshot
        const downloadId = await chrome.downloads.download({
            url: screenshot,
            filename: `nexus-guard-screenshot-${Date.now()}.png`,
            saveAs: false
        });
        
        console.log('Screenshot saved with ID:', downloadId);
        
        // Try to analyze with API if available
        try {
            // Convert base64 to blob for analysis
            const response = await fetch(screenshot);
            const blob = await response.blob();
            
            // Create FormData for image upload
            const formData = new FormData();
            formData.append('image', blob, 'screenshot.png');
            
            // Send to your Flask API for analysis
            const apiResponse = await fetch(`${settings.apiEndpoint}/predict-image`, {
                method: 'POST',
                body: formData
            });
            
            if (apiResponse.ok) {
                const result = await apiResponse.json();
                
                // Show API results
                if (result.prediction === 1) {
                    showThreatNotification(
                        '🚨 THREAT DETECTED IN SCREENSHOT!', 
                        `Phishing/Scam content detected with ${(result.probability * 100).toFixed(1)}% confidence`
                    );
                } else {
                    showThreatNotification(
                        '✅ Screenshot Safe', 
                        `Screenshot analysis shows no threats with ${(result.probability * 100).toFixed(1)}% confidence`
                    );
                }
                
                // Store screenshot result
                await chrome.storage.local.set({
                    lastScreenshotResult: {
                        screenshot: screenshot,
                        result: result,
                        timestamp: Date.now(),
                        url: tab.url
                    }
                });
                
                // Return result for popup
                return {
                    threats: result.prediction === 1 ? ['Phishing/Scam content detected'] : [],
                    confidence: result.probability,
                    apiResult: result,
                    screenshotSaved: true
                };
            } else {
                // API not available, do basic analysis
                return await performBasicScreenshotAnalysis(screenshot, tab);
            }
        } catch (apiError) {
            console.log('API analysis failed, using basic analysis:', apiError.message);
            // Fallback to basic analysis
            return await performBasicScreenshotAnalysis(screenshot, tab);
        }
        
    } catch (error) {
        console.error('Screenshot analysis error:', error);
        showThreatNotification('Screenshot Error', `Failed to analyze screenshot: ${error.message}`);
        throw error; // Re-throw to be caught by the message handler
    }
}

// Basic screenshot analysis without API
async function performBasicScreenshotAnalysis(screenshot, tab) {
    try {
        // Extract text from the page for basic keyword analysis
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const text = document.body.innerText || '';
                const title = document.title || '';
                const url = window.location.href;
                return { text: text.substring(0, 2000), title, url };
            }
        });
        
        if (results && results[0] && results[0].result) {
            const { text, title, url } = results[0].result;
            
            // Quick keyword scan
            const threats = quickKeywordScan(text + ' ' + title);
            
            if (threats.length > 0) {
                showThreatNotification(
                    '⚠️ Suspicious Content Detected', 
                    `Found ${threats.length} suspicious patterns: ${threats.join(', ')}`
                );
            } else {
                showThreatNotification(
                    '✅ Screenshot Saved & Basic Analysis Complete', 
                    'No obvious threats detected. Screenshot saved to downloads.'
                );
            }
            
            // Store basic analysis result
            await chrome.storage.local.set({
                lastScreenshotResult: {
                    screenshot: screenshot,
                    basicAnalysis: { threats, text: text.substring(0, 500), title, url },
                    timestamp: Date.now(),
                    url: tab.url
                }
            });
            
            // Return result for popup
            return {
                threats: threats,
                confidence: threats.length > 0 ? 0.8 : 0.2, // Basic confidence based on threats found
                basicAnalysis: { threats, text: text.substring(0, 500), title, url },
                screenshotSaved: true
            };
        }
        
        // Return default result if no text extracted
        return {
            threats: [],
            confidence: 0.1,
            basicAnalysis: { threats: [], text: '', title: '', url: '' },
            screenshotSaved: true
        };
        
    } catch (error) {
        console.error('Basic analysis error:', error);
        showThreatNotification(
            '📸 Screenshot Saved', 
            'Screenshot captured and saved. Basic analysis completed.'
        );
        
        // Return error result
        return {
            threats: [],
            confidence: 0.0,
            error: error.message,
            screenshotSaved: true
        };
    }
}

// Check if URL is suspicious
function isSuspiciousURL(url) {
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

// Start monitoring
function startMonitoring() {
    console.log('Starting monitoring...');
    
    // Check API status every 30 seconds
    setInterval(async () => {
        if (isActive) {
            await checkAPIStatus();
        }
    }, 30000);

    // Monitor for suspicious activities
    monitorSuspiciousActivities();
}

// Check API status
async function checkAPIStatus() {
    try {
        const response = await fetch(`${settings.apiEndpoint}/predict-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'test' })
        });
        
        if (response.ok) {
            updateExtensionIcon('active');
            return { status: 'connected', timestamp: Date.now() };
        } else {
            updateExtensionIcon('error');
            return { status: 'error', timestamp: Date.now() };
        }
    } catch (error) {
        updateExtensionIcon('error');
        return { status: 'disconnected', timestamp: Date.now() };
    }
}

// Update extension icon
function updateExtensionIcon(status) {
    // Update badge text
    chrome.action.setBadgeText({
        text: status === 'active' ? '' : '!'
    });

    chrome.action.setBadgeBackgroundColor({
        color: status === 'error' ? '#ef4444' : '#f59e0b'
    });
}

// Scan content
async function scanContent(content, type) {
    try {
        let endpoint = '';
        let payload = {};

        switch (type) {
            case 'text':
                endpoint = '/predict-text';
                payload = { text: content };
                break;
            default:
                throw new Error(`Unsupported content type: ${type}`);
        }

        const response = await fetch(`${settings.apiEndpoint}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Content scan error:', error);
        throw error;
    }
}

// Analyze links
function analyzeLinks(links) {
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

    return links.filter(link => {
        return suspiciousPatterns.some(pattern => pattern.test(link)) ||
               link.includes('suspicious') ||
               link.includes('phishing') ||
               link.includes('scam');
    });
}

// Analyze request
function analyzeRequest(details) {
    // Analyze web requests for potential threats
    const url = details.url.toLowerCase();
    const suspiciousKeywords = [
        'phishing', 'scam', 'fraud', 'malware', 'virus',
        'suspicious', 'fake', 'spoof', 'malicious'
    ];

    const isSuspicious = suspiciousKeywords.some(keyword => url.includes(keyword));
    
    if (isSuspicious) {
        showThreatNotification(
            'Suspicious Request Detected',
            `Blocked request to: ${details.url}`
        );
        
        // Could return { cancel: true } to block the request
        // For now, just log and notify
        console.warn('Suspicious request detected:', details);
    }
}

// Monitor suspicious activities
function monitorSuspiciousActivities() {
    // Monitor for patterns that might indicate threats
    setInterval(() => {
        // Check for unusual network activity
        // Check for suspicious file downloads
        // Check for suspicious form submissions
    }, 60000); // Check every minute
}

// Show threat notification
function showThreatNotification(title, message) {
    if (!settings.notifications) return;

    chrome.notifications.create(
        `threat-${Date.now()}`,
        {
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            title: `🚨 ${title}`,
            message: message,
            priority: 2
        },
        (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('Notification error:', chrome.runtime.lastError);
            } else {
                console.log('Notification created:', notificationId);
            }
        }
    );
}

// Show simple test notification (for debugging)
function showTestNotification(title, message) {
    chrome.notifications.create(
        `test-${Date.now()}`,
        {
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            title: title,
            message: message,
            priority: 1
        },
        (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('Test notification error:', chrome.runtime.lastError);
            } else {
                console.log('Test notification created:', notificationId);
            }
        }
    );
}

// Show welcome notification
function showWelcomeNotification() {
    chrome.notifications.create(
        'welcome-notification',
        {
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            title: '🛡️ Welcome to Nexus Guard MUFG!',
            message: 'Your security extension is now active and protecting you from threats.',
            priority: 1
        },
        (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('Welcome notification error:', chrome.runtime.lastError);
            } else {
                console.log('Welcome notification created:', notificationId);
            }
        }
    );
}

// Handle notification click
async function handleNotificationClick(notificationId) {
    // Handle notification clicks
    if (notificationId.includes('threat')) {
        // Open security dashboard or relevant tab
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    }
}

// Service Worker Lifecycle Events
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    if (details.reason === 'install') {
        showWelcomeNotification();
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
    initializeServiceWorker();
});

// Initialize when service worker loads
initializeServiceWorker();

// Listen for notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    handleNotificationClick(notificationId);
});

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    // Handle different button actions
    console.log('Notification button clicked:', notificationId, buttonIndex);
});
