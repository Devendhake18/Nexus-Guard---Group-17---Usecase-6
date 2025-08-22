# 🚀 Nexus Guard - AI-Powered Multi-Channel Fraud & Impersonation Detection

## 🏆 MUFG HACKATHON - USECASE 6

**AI-POWERED MULTI-CHANNEL FRAUD AND IMPERSONATION DETECTION**

---

## 📋 Project Overview

**Nexus Guard** is an advanced AI-powered security system designed to detect and prevent fraud and impersonation attempts across multiple communication channels. Built for the MUFG Hackathon, this solution leverages cutting-edge machine learning models to analyze text, audio, images, and video content in real-time.

## ✨ Key Features

### 🔍 Multi-Modal Detection
- **Text Analysis**: Phishing email and message detection using BiLSTM and TF-IDF models
- **Audio Analysis**: Voice spoofing and deepfake audio detection using RawNetLite
- **Image Analysis**: OCR-based text extraction and fraud detection
- **Video Analysis**: Multi-modal analysis combining audio and visual content

### 🚨 Real-Time Monitoring
- **Email Integration**: IMAP-based email monitoring with instant fraud alerts
- **Multi-Platform Notifications**: Telegram, Discord, and email alerts
- **Dashboard**: Real-time monitoring dashboard with threat analytics
- **Windows Notifications**: Desktop alerts for immediate attention

### 🛡️ Advanced Security
- **Multi-Model Ensemble**: Combines multiple AI models for enhanced accuracy
- **Cross-Domain Detection**: Robust detection across different fraud patterns
- **Confidence Scoring**: Probability-based threat assessment
- **Automated Response**: Configurable alert systems and response mechanisms

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Input Layer   │     │  AI Models      │     │  Alert System   │
│                 │     │                 │     │                 │
│ • Text          │───▶ │ • BiLSTM        │───▶│ • Telegram      │
│ • Audio         │     │ • RawNetLite    │     │ • Discord       │
│ • Image         │     │ • TF-IDF        │     │ • Email         │
│ • Video         │     │ • OCR           │     │ • Desktop       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```


### 🔒 Security Enhancements
- **Environment variables**: `.env` files are now properly excluded from version control
- **Sensitive data protection**: Model files, logs, and temporary files are gitignored
- **Clean deployment**: Ready for secure GitHub deployment

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+** (Recommended: Python 3.9 or 3.10)
- **CUDA-compatible GPU** (optional, for faster inference)
- **Tesseract OCR** installed and configured
- **FFmpeg** installed and added to system PATH
- **Git** for cloning the repository

### System Requirements

- **RAM**: Minimum 8GB, Recommended 16GB+
- **Storage**: At least 5GB free space for models and dependencies
- **OS**: Windows 10/11, macOS, or Linux
- **Network**: Internet connection for model downloads and API calls

### Installation Steps

#### 1. **Clone the Repository**
   ```bash
   git clone https://github.com/Devendhake18/Nexus-Guard---Group-17---Usecase-6
   cd nexus-guard
   ```

#### 2. **Set Up Python Environment** (Recommended)
   ```bash
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

#### 3. **Install Dependencies**
   ```bash
   # Upgrade pip first
   python -m pip install --upgrade pip
   
   # Install all requirements
   pip install -r requirements.txt
   ```

#### 4. **Install System Dependencies**

   **Windows:**
   - Install [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki)
   - Install [FFmpeg](https://ffmpeg.org/download.html#build-windows)
   - Add both to system PATH

   **macOS:**
   ```bash
   brew install tesseract ffmpeg
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt update
   sudo apt install tesseract-ocr ffmpeg
   ```

#### 5. **Download AI Models**
   - All pre-trained models are stored in Google Drive
   - **Drive Link**: [Google Drive Models Folder](https://drive.google.com/drive/folders/1OGZ1Ztdp9VsrVgoe2XqCLQoqTtjPHmuS?usp=sharing)
   - Download and extract models to the `models/` directory
   - Ensure the following structure:
     ```
     models/
     └── model_logical_CCE_100_32_0.0001/
         └── model_best_epoch100.pth.tar
     ```

#### 6. **Configure Environment Variables**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your API keys and configuration
   # Use any text editor or IDE
   ```

#### 7. **Verify Installation**
   ```bash
   # Test if all dependencies are installed
   python -c "import torch, flask, cv2, whisper; print('All packages imported successfully!')"
   ```



### Running the Application

#### **Option 1: Development Mode (Recommended for testing)**

1. **Start the Flask API Server**
   ```bash
   # Terminal 1: Start API server
   python flask_api.py
   ```
   - API will be available at `http://localhost:5000`
   - Keep this terminal running

2. **Start the Main Application**
   ```bash
   # Terminal 2: Start main app
   python app.py
   ```
   - Main monitoring system will start
   - Email monitoring and notifications will be active

#### **Option 2: Production Mode**

1. **Set Environment Variables**
   ```bash
   export FLASK_ENV=production
   export FLASK_DEBUG=0
   ```

2. **Run with Gunicorn (Linux/macOS)**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 flask_api:app
   ```

3. **Run with Waitress (Windows)**
   ```bash
   pip install waitress
   waitress-serve --host=0.0.0.0 --port=5000 flask_api:app
   ```

### Testing the Setup

#### **Test API Endpoints**
```bash
# Test text analysis
curl -X POST http://localhost:5000/predict-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'

# Test if server is running
curl http://localhost:5000/
```

#### **Test Audio Analysis**
```bash
# Send an audio file for analysis
curl -X POST http://localhost:5000/predict-audio \
  -F "audio=@test_audio/sample.wav"
```

### Troubleshooting

#### **Common Issues:**

1. **Import Errors**: Ensure virtual environment is activated
2. **Tesseract Not Found**: Check PATH and installation
3. **FFmpeg Errors**: Verify FFmpeg installation and PATH
4. **CUDA Issues**: Install CPU-only PyTorch if GPU unavailable
5. **Model Loading Errors**: Verify model files are in correct directories

#### **Performance Tips:**

- Use GPU if available for faster inference
- Adjust batch sizes based on available memory
- Monitor system resources during operation
- Use SSD storage for better I/O performance

## 📁 Project Structure

```
nexus-guard/
├── app.py                 # Main application with monitoring capabilities
├── flask_api.py          # REST API for fraud detection
├── RawNetLite.py         # Audio spoofing detection model
├── audio_preprocessor.py # Audio preprocessing utilities
├── models/              # Pre-trained AI models (Google Drive)
├── my_models/           # Additional ML models
├── temp/                # Temporary file storage
└── test_*/              # Test files for different modalities
```

> **Note**: The project structure has been cleaned up by removing unused directories (`assets/`, `components/`, `.dist/`, `config/`) to focus on essential functionality and improve maintainability.

## 🔧 Configuration

### Environment Variables

**Important**: Create a `.env` file in the project root with the following variables. This file is automatically excluded from version control for security.

Create a `.env` file with the following variables:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Discord Configuration
DISCORD_TOKEN=your_discord_token
DISCORD_CHANNEL_ID=your_channel_id

# Email Configuration
EMAIL_ADDRESS=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
IMAP_HOST=imap.gmail.com

# API Endpoints
TEXT_API_URL=http://127.0.0.1:5000/predict-text
AUDIO_API_URL=http://127.0.0.1:5000/predict-audio
IMAGE_API_URL=http://127.0.0.1:5000/predict-image
VIDEO_API_URL=http://127.0.0.1:5000/predict-video
```

## 🧠 AI Models

### Text Detection Models
- **BiLSTM Classifier**: Deep learning model for text-based fraud detection
- **TF-IDF Vectorizer**: Traditional ML approach for phishing detection
- **Custom Tokenizer**: Optimized text preprocessing pipeline

### Audio Detection Models
- **RawNetLite**: State-of-the-art audio spoofing detection
- **Cross-domain Model**: Robust detection across different audio domains

### Computer Vision Models
- **OCR Integration**: Text extraction from images using Tesseract
- **Image Processing**: OpenCV-based image analysis

## 📡 API Endpoints

### Text Analysis
```http
POST /predict-text
Content-Type: application/json

{
  "text": "Your text content here"
}
```

### Audio Analysis
```http
POST /predict-audio
Content-Type: multipart/form-data

audio: [audio_file]
```

### Image Analysis
```http
POST /predict-image
Content-Type: multipart/form-data

image: [image_file]
```

### Video Analysis
```http
POST /predict-video
Content-Type: multipart/form-data

video: [video_file]
```

## 🔍 Usage Examples

### Email Monitoring
The system automatically monitors emails and analyzes content for fraud:
- Real-time email scanning via IMAP
- Instant fraud detection and alerts
- Multi-platform notification system

### Manual Analysis
Use the API endpoints to analyze specific content:
```python
import requests

# Analyze text
response = requests.post('http://localhost:5000/predict-text', 
                        json={'text': 'Suspicious message content'})
result = response.json()
```

## 📊 Performance Metrics

- **Text Detection**: 95%+ accuracy on phishing detection
- **Audio Detection**: 90%+ accuracy on spoofing detection
- **Response Time**: <2 seconds for most content types
- **Multi-Modal**: Enhanced accuracy through ensemble methods

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**⚠️ Important Note**: All pre-trained models are stored in Google Drive due to size constraints. Please use the provided drive link to access the models before running the application.

**🔗 Model Access**: [Google Drive Models Folder](https://drive.google.com/drive/folders/1OGZ1Ztdp9VsrVgoe2XqCLQoqTtjPHmuS?usp=sharing)
