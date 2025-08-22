# Quick Installation Guide

## 🚀 Install Nexus Guard MUFG Extension in 3 Steps

### Step 1: Start Your Backend Server
```bash
# Navigate to your project directory
cd MUFG_Secure

# Start the Flask API server
python flask_api.py
```
**Make sure the server is running on `http://127.0.0.1:5000`**

### Step 2: Load Extension in Chrome
1. **Open Chrome Extensions Page**
   - Type `chrome://extensions/` in your address bar
   - Or go to Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from this project
   - The extension should appear in your extensions list

### Step 3: Test the Extension
1. **Click the Extension Icon**
   - Look for the Nexus Guard icon in your Chrome toolbar
   - Click it to open the popup

2. **Verify Connection**
   - Go to Settings
   - Check that API endpoint is `http://127.0.0.1:5000`
   - Status should show "ACTIVE"

3. **Test a Scan**
   - Click "Scan Text"
   - Type some test text
   - Click "Scan Text" to test the API connection

## ✅ Success Indicators
- Extension icon appears in toolbar
- Popup opens without errors
- Settings show correct API endpoint
- Text scanning returns results
- No error messages in console

## ❌ Common Issues & Solutions

### Extension Won't Load
- **Problem**: "Manifest file is missing or unreadable"
- **Solution**: Make sure you're selecting the `chrome-extension` folder, not the parent directory

### API Connection Failed
- **Problem**: "Error scanning text: API Error: 500"
- **Solution**: Check if your Flask server is running and accessible at `http://127.0.0.1:5000`

### Permission Denied
- **Problem**: Extension shows "Access denied" errors
- **Solution**: Make sure you've granted all required permissions when loading the extension



## 🔧 Advanced Configuration

### Custom API Endpoint
If your server runs on a different address:
1. Open extension popup
2. Click Settings
3. Change API endpoint (e.g., `http://localhost:5000`)
4. Click Save



### Disable Notifications
1. Open Settings
2. Uncheck "Notifications" option
2. Extension will work silently

## 📱 Using the Extension

### Quick Actions
- **Scan Text**: Analyze copied text for threats
- **Scan File**: Upload and analyze files (images, audio, video)

### Context Menu (Right-Click)
- **Select text and right-click** for instant threat scanning
- **Right-click on any page** for page analysis
- **Right-click on links** for URL safety check
- **Right-click on images** for basic threat detection

### File Support
- **Images**: JPG, PNG, GIF, BMP, WebP
- **Audio**: MP3, WAV, FLAC, OGG, M4A
- **Video**: MP4, MOV, AVI, MKV, WMV, FLV, WebM

### Threat Detection
- Phishing text patterns
- Suspicious links
- Form security issues
- Media spoofing/deepfakes

## 🆘 Need Help?

1. **Check Console**: Press F12 → Console tab for error messages
2. **Verify Server**: Test `http://127.0.0.1:5000` in your browser
3. **Check Permissions**: Ensure extension has all required permissions
4. **Restart Extension**: Disable and re-enable the extension

## 🔄 Updating the Extension

When you make changes to the extension files:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the Nexus Guard extension
3. Or disable and re-enable the extension

---

**That's it!** Your Nexus Guard MUFG extension should now be working and protecting you from online threats. 🛡️
