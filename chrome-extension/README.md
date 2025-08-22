# Nexus Guard MUFG Chrome Extension

A comprehensive Chrome extension that integrates with the Nexus Guard MUFG security system to detect scams, phishing attempts, and spoofed content across multiple platforms.

## 🚀 Features

### Core Security Functions
- **Text Analysis**: Scan text content for phishing and scam patterns
- **File Scanning**: Analyze images, audio, and video files for threats and spoofing
- **URL Analysis**: Detect suspicious links and URL patterns
- **Form Monitoring**: Identify suspicious form submissions and sensitive data collection
- **Real-time Protection**: Monitor web pages for threats as you browse

### Media Analysis
- **Image Analysis**: OCR text extraction and threat detection
- **Audio Analysis**: Deepfake and spoofing detection using RawNetLite
- **Video Analysis**: Combined audio and visual threat detection
- **Spoof Detection**: Advanced algorithms to detect manipulated media

### User Experience
- **Modern Dark Theme**: Professional, easy-on-the-eyes interface
- **Drag & Drop**: Easy file upload for scanning
- **Real-time Notifications**: Instant alerts for detected threats
- **Settings Management**: Customizable API endpoints and preferences
- **Auto-scanning**: Optional automatic page content analysis

## 📋 Requirements

- Google Chrome browser (version 88 or higher)
- Nexus Guard MUFG backend server running on `http://127.0.0.1:5000`
- Python backend with required ML models loaded

## 🛠️ Installation

### 1. Download the Extension
- Clone or download this repository
- Navigate to the `chrome-extension` folder

### 2. Load in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension should now appear in your extensions list

### 3. Verify Backend Connection
1. Click the Nexus Guard extension icon in your toolbar
2. Go to Settings
3. Verify the API endpoint is set to `http://127.0.0.1:5000`
4. Ensure your backend server is running

## 🔧 Configuration

### API Endpoint
- Default: `http://127.0.0.1:5000`
- Change in Settings if your backend runs on a different port/address

### Auto-scanning
- Enable to automatically analyze page content
- Monitors for threats as you browse
- Can be disabled for performance reasons

### Notifications
- Enable/disable browser notifications
- Control warning popups on web pages
- Manage threat alerts

## 📱 Usage

### Quick Actions
1. **Scan Text**: Click "Scan Text" to analyze copied text
2. **Scan File**: Click "Scan File" to upload and analyze files

### Context Menu Integration
- **Right-click on selected text** to access quick scanning options
- **Right-click on any page** for page-wide threat analysis
- **Right-click on links** to scan for suspicious URLs
- **Right-click on images** for basic image threat detection

### File Scanning
- **Supported Formats**:
  - Images: JPG, PNG, GIF, BMP, WebP
  - Audio: MP3, WAV, FLAC, OGG, M4A
  - Video: MP4, MOV, AVI, MKV, WMV, FLV, WebM

- **Drag & Drop**: Simply drag files onto the upload area
- **Batch Processing**: Upload multiple files at once

### Text Analysis
- Paste suspicious text into the text area
- Click "Scan Text" for instant analysis
- Get confidence scores and recommendations



## 🚨 Threat Detection

### Text Threats
- Phishing keywords and patterns
- Excessive urgency indicators
- Suspicious financial requests
- Social engineering attempts

### Link Threats
- URL shorteners (bit.ly, tinyurl, etc.)
- Mismatched link text and destinations
- Suspicious domain patterns
- Known malicious URLs

### Form Threats
- Suspicious form actions
- Sensitive data collection
- Unusual input patterns
- Potential data harvesting

### Media Threats
- Deepfake detection
- Audio spoofing
- Video manipulation
- Suspicious content patterns

## 🔍 API Integration

The extension integrates with your Nexus Guard MUFG backend through these endpoints:

- `POST /predict-text` - Text analysis
- `POST /predict-image` - Image analysis
- `POST /predict-audio` - Audio analysis
- `POST /predict-video` - Video analysis

### Request Format
```json
{
  "text": "content to analyze"
}
```

### Response Format
```json
{
  "prediction": 1,
  "confidence": 0.85,
  "is_spoofed": "spoofed",
  "spoof_confidence": 0.92
}
```

## 🛡️ Security Features

### Content Script Protection
- Monitors DOM changes for dynamic threats
- Analyzes form submissions before sending
- Validates file uploads
- Checks link destinations

### Background Monitoring
- Continuous API health checks
- Suspicious request detection
- Network activity monitoring
- Threat pattern recognition

### User Privacy
- No data is stored permanently
- All analysis happens locally or on your backend
- No external data transmission
- Configurable notification levels

## 🐛 Troubleshooting

### Extension Not Working
1. Check if backend server is running
2. Verify API endpoint in settings
3. Check browser console for errors
4. Ensure all permissions are granted

### API Connection Issues
1. Verify server is running on correct port
2. Check firewall settings
3. Ensure CORS is properly configured
4. Test API endpoints manually

### Performance Issues
1. Disable auto-scanning
2. Reduce notification frequency
3. Limit file upload sizes
4. Check browser memory usage

## 🔄 Updates

### Manual Updates
1. Download new version
2. Remove old extension
3. Load new version
4. Restore settings if needed

### Automatic Updates
- Chrome will automatically update from Chrome Web Store
- Check for updates in `chrome://extensions/`

## 📚 Development

### File Structure
```
chrome-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── content.js            # Content script for web pages
└── README.md             # This file
```

### Customization
- Modify `popup.css` for styling changes
- Update `popup.js` for functionality changes
- Adjust `content.js` for page monitoring
- Configure `background.js` for background tasks

### Testing
1. Load extension in Chrome
2. Test on various websites
3. Verify API integration
4. Check error handling

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console logs
3. Verify backend server status
4. Check API endpoint connectivity

## 📄 License

This extension is part of the Nexus Guard MUFG security system. Please refer to the main project license for usage terms.

## 🔗 Related Projects

- **Nexus Guard MUFG Backend**: Python Flask API server
- **RawNetLite**: Audio spoofing detection model
- **Phishing Detection Models**: Text and email analysis
- **Dashboard**: Web-based monitoring interface

---

**Version**: 1.0.0  
**Last Updated**: August 2025  
**Compatibility**: Chrome 88+  
**Backend**: Python Flask + ML Models
