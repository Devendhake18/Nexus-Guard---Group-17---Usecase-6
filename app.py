from __future__ import annotations
import os

import asyncio
import aiohttp
import aiofiles
import datetime as dt
import signal
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# Third-party imports
from dotenv import load_dotenv
from imapclient import IMAPClient
from email.header import decode_header
import email

from win11toast import toast  # Windows only; guard usage
from telegram import Update, Bot
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes
import discord

from dash import Dash, html, dcc, Output, Input
import aiohttp
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# -------------------------------
# Global Shared State & Config
# -------------------------------
load_dotenv()

@dataclass
class Settings:
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

    DISCORD_TOKEN: str = os.getenv("DISCORD_TOKEN", "")
    DISCORD_CHANNEL_ID: int = int(os.getenv("DISCORD_CHANNEL_ID", "0") or 0)

    EMAIL_ADDRESS: str = os.getenv("EMAIL_ADDRESS", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")

    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))

    IMAP_HOST: str = os.getenv("IMAP_HOST", "imap.gmail.com")

    # EMAIL_API_URL: str = os.getenv("EMAIL_API_URL", "http://127.0.0.1:5000/predict-email")
    TEXT_API_URL: str = os.getenv("TEXT_API_URL", "http://127.0.0.1:5000/predict-text")
    AUDIO_API_URL: str = os.getenv("AUDIO_API_URL", "http://127.0.0.1:5000/predict-audio")
    IMAGE_API_URL: str = os.getenv("IMAGE_API_URL", "http://127.0.0.1:5000/predict-image")
    VIDEO_API_URL: str = os.getenv("VIDEO_API_URL", "http://127.0.0.1:5000/predict-video")

    TEMP_ROOT: str = os.getenv("TEMP_ROOT", "temp")

SET = Settings()

# Shared in-memory message store for dashboard
messages: List[Dict] = []

# Ensure temp root exists
os.makedirs(SET.TEMP_ROOT, exist_ok=True)

# -------------------------------
# Utilities: Email parsing helpers
# -------------------------------

def decode_subject(subject: Optional[str]) -> str:
    if not subject:
        return "(no subject)"
    decoded_parts = decode_header(subject)
    out: List[str] = []
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            try:
                out.append(part.decode(encoding or "utf-8", errors="ignore"))
            except Exception:
                out.append(part.decode("utf-8", errors="ignore"))
        else:
            out.append(part)
    return "".join(out)


def extract_body(msg: email.message.Message) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdisp = str(part.get("Content-Disposition", ""))
            if ctype == "text/plain" and "attachment" not in cdisp:
                try:
                    return part.get_payload(decode=True).decode(errors="ignore").strip()
                except Exception:
                    return (part.get_payload() or "").strip()
        return body
    else:
        try:
            return msg.get_payload(decode=True).decode(errors="ignore").strip()
        except Exception:
            return (msg.get_payload() or "").strip()

# -------------------------------
# API Clients (model inference)
# -------------------------------
async def call_email_prediction_api(text: str) -> Dict:
    async with aiohttp.ClientSession() as session:
        async with session.post(SET.TEXT_API_URL, json={"text": text}) as r:
            r.raise_for_status()
            return await r.json()
        
# async def call_text_prediction_api(text: str) -> Dict:
#     async with aiohttp.ClientSession() as session:
#         async with session.post(SET.TEXT_API_URL, json={"text": text}) as r:
#             r.raise_for_status()
#             return await r.json()

async def call_audio_prediction_api(file_path: str) -> Dict:
    async with aiohttp.ClientSession() as session:
        with open(file_path, "rb") as f:
            form = aiohttp.FormData()
            form.add_field("audio", f, filename=os.path.basename(file_path))
            async with session.post(SET.AUDIO_API_URL, data=form) as r:
                r.raise_for_status()
                response = await r.json()
                return response

async def call_video_prediction_api(file_path: str) -> Dict:
    async with aiohttp.ClientSession() as session:
        with open(file_path, "rb") as f:
            form = aiohttp.FormData()
            form.add_field(
                "video",
                f,
                filename=os.path.basename(file_path),
                content_type="video/mp4"
            )
            async with session.post(SET.VIDEO_API_URL, data=form) as resp:
                resp.raise_for_status()
                response = await resp.json()
                return response

async def call_image_prediction_api(file_path: str) -> Dict:
    async with aiohttp.ClientSession() as session:
        with open(file_path, "rb") as f:
            form = aiohttp.FormData()
            form.add_field("image", f, filename=os.path.basename(file_path))
            async with session.post(SET.IMAGE_API_URL, data=form) as r:
                r.raise_for_status()
                return await r.json()
            
# -------------------------------
# Alerts (Windows toast, Telegram, Discord, Email)
# -------------------------------
telegram_bot = Bot(token=SET.TELEGRAM_BOT_TOKEN) if SET.TELEGRAM_BOT_TOKEN else None

def _fmt_alert_block(account_source: str, sender_name: str, scam_message: str, is_spoofed: str = None, media_type: str = None) -> str:
    timestamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    spoof_warning = ""
    if is_spoofed == "spoofed" and media_type in ("audio", "video"):
        spoof_warning = f"\n🎭 SPOOFED {media_type.upper()} DETECTED!"
    
    return (
        "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n"
        "█ 🚨🚨🚨 SCAM ALERT 🚨🚨🚨 █\n"
        "▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄\n\n"
        "⚠️  FRAUD DETECTED  ⚠️\n\n"
        f"🌐Source: {account_source}\n\n"
        f"📧 Account Name: {sender_name}\n\n"
        f"🕒 Timestamp: {timestamp}\n\n"
        "💬 Suspicious Message:\n"
        f"【 {scam_message} 】\n"
        "☝️ POTENTIAL SCAM CONTENT\n"
        f"{spoof_warning}\n"
        "🛑 DO NOT ENGAGE - REPORT IMMEDIATELY\n"
        "✅ Verify through official channels only"
    )


async def send_windows_notification(account_name: str, sender_name: str, alert_msg: str):
    if toast is None:
        return
    await asyncio.to_thread(
        toast,
        "🚨 Scam Alert 🚨",
        f"Source: {account_name}\nSender: {sender_name}\nSubject: {alert_msg[:100]}",
        icon=os.path.abspath("logo.png") if os.path.exists("logo.png") else None,
        duration="short",
    )

async def send_telegram_alert(account_source: str, sender_name: str, scam_message: str, is_spoofed: str = None, media_type: str = None):
    if not (telegram_bot and SET.TELEGRAM_CHAT_ID):
        return
    msg = _fmt_alert_block(account_source, sender_name, scam_message, is_spoofed, media_type)
    try:
        if os.path.exists("scam.jpg"):
            with open("scam.jpg", "rb") as img:
                await telegram_bot.send_photo(chat_id=SET.TELEGRAM_CHAT_ID, photo=img)
        await telegram_bot.send_message(chat_id=SET.TELEGRAM_CHAT_ID, text=msg)
    except Exception as e:
        print(f"[WARN] Telegram alert failed: {e}")

# Discord client and helpers
intents = discord.Intents.default()
intents.messages = True
intents.message_content = True

discord_client = discord.Client(intents=intents)
discord_ready = asyncio.Event()

@discord_client.event
async def on_ready():
    print(f"✅ Discord logged in as {discord_client.user}")
    discord_ready.set()


async def send_discord_alert(account_source: str, sender_name: str, scam_message: str, is_spoofed: str = None, media_type: str = None):
    await discord_ready.wait()
    channel = discord_client.get_channel(1405486013803135029)
    if channel is None:
        print("❌ Discord channel not found")
        return
    
    timestamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    spoof_warning = ""
    if is_spoofed == "spoofed" and media_type in ("audio", "video"):
        spoof_warning = f"\n🎭 **SPOOFED {media_type.upper()} DETECTED!**"
    
    message = (
        "```diff\n"
        "████████████████████████████████\n"
        "█ 🚨🚨🚨  SCAM ALERT  🚨🚨🚨 █\n"
        "████████████████████████████████\n"
        "```\n"
        "**⚠️ FRAUD DETECTED ⚠️**\n\n"
        f"🌐Source: {account_source}\n\n"
        f"📧 Account Name: {sender_name}\n\n"
        f"**🕒 Timestamp:** `{timestamp}`\n\n"
        "**💬 Suspicious Message:**\n"
        f"> {scam_message}\n\n"
        "☝️ **Potential Scam Content**\n"
        f"{spoof_warning}\n"
        "🛑 **Do NOT engage — report immediately**\n"
        "✅ **Verify through official channels only**"
    )
    try:
        await channel.send(message)
    except Exception as e:
        print(f"[WARN] Discord alert failed: {e}")


# Email alert

def send_alert_email(to_email: str, account_source: str, sender: str, sender_email: str, email_subject_title: str):
    msg = MIMEMultipart("alternative")
    msg["From"] = SET.EMAIL_ADDRESS
    msg["To"] = to_email
    msg["Subject"] = f"🚨 Scam Alert - Suspicious Email from {sender}"

    html_content = f"""
    <html><body style="font-family: Arial, sans-serif; background-color: #0b0f17; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: #121826; padding: 20px; border-radius: 10px; border: 1px solid #1f2a44; color:#e5e7eb;">
        <h2 style="color: #ef4444; text-align: center;">🚨 SCAM ALERT DETECTED 🚨</h2>
        <p>We detected a suspicious message that may be a <strong>scam attempt</strong>. Details below:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
          <tr><td style="padding:8px;border:1px solid #1f2a44;">Source</td><td style="padding:8px;border:1px solid #1f2a44;">{account_source}</td></tr>
          <tr><td style="padding:8px;border:1px solid #1f2a44;">Sender Name</td><td style="padding:8px;border:1px solid #1f2a44;">{sender}</td></tr>
          <tr><td style="padding:8px;border:1px solid #1f2a44;">Sender Email</td><td style="padding:8px;border:1px solid #1f2a44;">{sender_email}</td></tr>
          <tr><td style="padding:8px;border:1px solid #1f2a44;">Subject</td><td style="padding:8px;border:1px solid #1f2a44;">{email_subject_title}</td></tr>
        </table>
        <p style="margin-top: 12px; color: #f59e0b;">⚠ Do not click links or open attachments. Verify via trusted channels.</p>
      </div>
    </body></html>
    """

    msg.attach(MIMEText(html_content, "html"))

    server = smtplib.SMTP(SET.SMTP_SERVER, SET.SMTP_PORT)
    try:
        server.ehlo()
        server.starttls()
        server.login(SET.EMAIL_ADDRESS, SET.EMAIL_PASSWORD)
        server.send_message(msg)
        print(f"✅ Alert email sent to {to_email}")
    finally:
        server.quit()

async def send_alert_email_async(to_email: str, account_source: str, sender: str, sender_email: str, email_subject_title: str):
    await asyncio.to_thread(send_alert_email, to_email, account_source, sender, sender_email, email_subject_title)

# -------------------------------
# Telegram ingestion
# -------------------------------
# -------------------------------
# Telegram ingestion (updated: no prediction, no deletion)
# -------------------------------
async def handle_telegram_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sender_name = (update.message.from_user.first_name if update.message and update.message.from_user else "Unknown")
    text = update.message.text if update.message else ""
    messages.append({
        "source": "Telegram",
        "sender_name": sender_name,
        "type": "text",
        "content": text,
        "email": "[N/A]",
        "file_path": "",          # no file for text
        "prediction": "pending",  # let process_message handle it
    })
    print(f"💬 Telegram text from {sender_name}: {text}")


async def handle_telegram_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    sender_name = update.message.from_user.first_name if update.message.from_user else "Unknown"
    audio_message = update.message.audio or update.message.voice
    if not audio_message:
        return

    original_filename = getattr(audio_message, "file_name", None) or f"audio_{audio_message.file_unique_id}.ogg"
    file_path = os.path.join(SET.TEMP_ROOT, os.path.basename(original_filename))

    file_obj = await audio_message.get_file()
    await file_obj.download_to_drive(file_path)
    print(f"🎵 Telegram audio saved: {file_path}")

    messages.append({
        "source": "Telegram",
        "sender_name": sender_name,
        "type": "audio",
        "content": f"{original_filename} ⮜ The provided audio file may be fraudulent or contain suspicious content.",
        "email": "[N/A]",
        "file_path": file_path,
        "prediction": "pending",
    })


async def handle_telegram_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.photo:
        return
    sender_name = update.message.from_user.first_name if update.message.from_user else "Unknown"
    photo = update.message.photo[-1]

    file_path = os.path.join(SET.TEMP_ROOT, f"{photo.file_unique_id}.jpg")
    file = await photo.get_file()
    await file.download_to_drive(file_path)
    print(f"📷 Telegram photo saved: {file_path}")

    messages.append({
        "source": "Telegram",
        "sender_name": sender_name,
        "type": "photo",
        "content": f"Recent Image from {sender_name} may be fraudulent or contain suspicious content.",
        "email": "[N/A]",
        "file_path": file_path,
        "prediction": "pending",
    })


async def handle_telegram_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.video:
        return
    sender_name = update.message.from_user.first_name if update.message.from_user else "Unknown"
    video = update.message.video

    file_path = os.path.join(SET.TEMP_ROOT, f"{video.file_unique_id}.mp4")
    file = await video.get_file()
    await file.download_to_drive(file_path)
    print(f"🎥 Telegram video saved: {file_path}")

    messages.append({
        "source": "Telegram",
        "sender_name": sender_name,
        "type": "video",
        "content": f"Recent Video from {sender_name} may be fraudulent or contain suspicious content.",
        "email": "[N/A]",
        "file_path": file_path,
        "prediction": "pending",
    })

async def run_telegram():
    if not SET.TELEGRAM_BOT_TOKEN:
        print("[INFO] TELEGRAM_BOT_TOKEN missing; skipping Telegram bot")
        return
    app = ApplicationBuilder().token(SET.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_telegram_text))
    app.add_handler(MessageHandler(filters.VOICE | filters.AUDIO, handle_telegram_audio))
    app.add_handler(MessageHandler(filters.PHOTO, handle_telegram_photo))
    app.add_handler(MessageHandler(filters.VIDEO, handle_telegram_video))

    print("✅ Telegram bot running...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    try:
        while True:
            await asyncio.sleep(10)
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()

# -------------------------------
# Discord ingestion
# -------------------------------
@discord_client.event
async def on_message(message: discord.Message):
    if message.author == discord_client.user:
        return
    if SET.DISCORD_CHANNEL_ID and message.channel.id != SET.DISCORD_CHANNEL_ID:
        return

    # Text -> enqueue; prediction handled later
    if message.content:
        messages.append({
            "source": "Discord",
            "sender_name": str(message.author),
            "type": "text",
            "content": message.content,
            "email": "[N/A]",
            "file_path": "",
            "prediction": "pending",
        })

    # Attachments -> save to ./temp, enqueue; prediction handled later
    for attachment in message.attachments:
        suffix = attachment.filename.lower()
        media_type = "file"
        if suffix.endswith((".mp3", ".wav", ".flac", ".ogg", ".m4a")):
            media_type = "audio"
        elif suffix.endswith((".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp")):
            media_type = "photo"
        elif suffix.endswith((".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm")):
            media_type = "video"

        file_path = os.path.join(SET.TEMP_ROOT, os.path.basename(attachment.filename))
        await attachment.save(file_path)
        print(f"📥 Discord saved {media_type}: {file_path}")

        content = {
            "audio": f"{attachment.filename} ⮜ The provided audio file may be fraudulent or contain suspicious content.",
            "photo": f"Recent Image from {message.author} may be fraudulent or contain suspicious content.",
            "video": f"Recent Video from {message.author} may be fraudulent or contain suspicious content.",
        }.get(media_type, f"[Attachment: {attachment.filename}]")

        messages.append({
            "source": "Discord",
            "sender_name": str(message.author),
            "type": media_type,
            "content": content,
            "email": "[N/A]",
            "file_path": file_path,
            "prediction": "pending",
        })

async def run_discord():
    if not SET.DISCORD_TOKEN:
        print("[INFO] DISCORD_TOKEN missing; skipping Discord bot")
        return
    await discord_client.start(SET.DISCORD_TOKEN)

# -------------------------------
# Gmail ingestion (IMAP)
# -------------------------------
def fetch_new_gmail_messages_once(seen_uids: set) -> Tuple[List[Dict], set]:
    new_msgs: List[Dict] = []
    if not (SET.EMAIL_ADDRESS and SET.EMAIL_PASSWORD):
        return new_msgs, seen_uids

    with IMAPClient(SET.IMAP_HOST) as server:
        server.login(SET.EMAIL_ADDRESS, SET.EMAIL_PASSWORD)
        server.select_folder("INBOX")
        unseen = server.search(["UNSEEN"]) or []
        new_uids = [uid for uid in unseen if uid not in seen_uids]

        for uid in new_uids:
            raw = server.fetch([uid], ["RFC822"])[uid][b"RFC822"]
            msg = email.message_from_bytes(raw)
            from_ = msg.get("From", "")
            name, addr = email.utils.parseaddr(from_)

            # Check if the email has attachments
            attachments = [
                part for part in msg.walk()
                if part.get_content_disposition() == "attachment"
            ]

            if attachments:
                # Only process attachments, skip subject/body
                for part in attachments:
                    filename = part.get_filename() or f"attachment_{uuid.uuid4().hex}"
                    data = part.get_payload(decode=True)
                    if not data:
                        continue

                    file_path = os.path.join(SET.TEMP_ROOT, os.path.basename(filename))
                    with open(file_path, "wb") as f:
                        f.write(data)

                    lower = filename.lower()
                    if lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp")):
                        mtype = "photo"
                        content = f"Recent image from {name or addr} may be fraudulent or contain suspicious content."
                    elif lower.endswith((".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm")):
                        mtype = "video"
                        content = f"Recent video from {name or addr} may be fraudulent or contain suspicious content."
                    elif lower.endswith((".mp3", ".wav", ".flac", ".ogg", ".m4a")):
                        mtype = "audio"
                        content = f"{filename} ⮜ The provided audio file may be fraudulent or contain suspicious content."
                    else:
                        mtype = "file"
                        content = f"[Attachment: {filename}]"

                    new_msgs.append({
                        "source": "Gmail",
                        "sender_name": name or addr or "Unknown",
                        "type": mtype,
                        "content": content,
                        "email": addr or "",
                        "file_path": file_path,
                        "prediction": "pending",
                    })
            else:
                # No attachments → only process subject + body
                subject = decode_subject(msg.get("Subject"))
                body = extract_body(msg)
                new_msgs.append({
                    "source": "Gmail",
                    "sender_name": name or addr or "Unknown",
                    "type": "email",
                    "content": f"Subject: {subject}\n\nBody: {body}",
                    "email": addr or "",
                    "file_path": "",
                    "prediction": "pending",
                })

            seen_uids.add(uid)

    return new_msgs, seen_uids

async def run_gmail():
    if not (SET.EMAIL_ADDRESS and SET.EMAIL_PASSWORD):
        print("[INFO] EMAIL creds missing; skipping Gmail watcher")
        return
    seen: set = set()
    while True:
        new_msgs, seen = await asyncio.to_thread(fetch_new_gmail_messages_once, seen)
        messages.extend(new_msgs)
        await asyncio.sleep(5)

# -------------------------------
# Dash Dashboard (dark theme)
# -------------------------------
CHANNEL_CONFIG = {
    "telegram": {"name": "Telegram", "icon": "fab fa-telegram-plane", "color": "#0088cc", "bg": "#0088cc15"},
    "discord": {"name": "Discord", "icon": "fab fa-discord", "color": "#5865f2", "bg": "#5865f215"},
    "gmail": {"name": "Gmail", "icon": "fas fa-envelope", "color": "#ea4335", "bg": "#ea433515"},
}

MESSAGE_TYPE_CONFIG = {
    "text": {"name": "Text", "icon": "fas fa-comment-alt", "color": "#10b981", "bg": "#064e3b", "border": "#10b981"},
    "audio": {"name": "Audio", "icon": "fas fa-volume-up", "color": "#f59e0b", "bg": "#451a03", "border": "#f59e0b"},
    "video": {"name": "Video", "icon": "fas fa-video", "color": "#8b5cf6", "bg": "#581c87", "border": "#8b5cf6"},
    "photo": {"name": "Image", "icon": "fas fa-image", "color": "#06b6d4", "bg": "#164e63", "border": "#06b6d4"},
    "email": {"name": "Email", "icon": "fas fa-envelope-open-text", "color": "#60a5fa", "bg": "#1e3a8a", "border": "#60a5fa"},
}

dash_app = Dash(__name__)

dash_app.layout = html.Div([
    html.Div([
        html.Div([
            html.H1("🛡️NEXUS GUARD", style={"margin":"0","fontSize":"28px","fontWeight":"700","color":"#f9fafb"}),
            html.P("Multi-platform threat detection system", style={"margin":"5px 0 0 0","fontSize":"14px","color":"#9ca3af"}),
        ], style={"flex":"1"}),
        html.Div([
            html.Div("●", style={"color":"#10b981","fontSize":"12px","marginRight":"8px"}),
            html.Span("ACTIVE", style={"fontSize":"12px","color":"#10b981","fontWeight":"600"}),
        ], style={"display":"flex","alignItems":"center"}),
    ], style={"display":"flex","alignItems":"center","justifyContent":"space-between","padding":"24px 32px","backgroundColor":"#1f2937","borderRadius":"12px","boxShadow":"0 4px 6px rgba(0,0,0,0.3)","marginBottom":"24px","border":"1px solid #374151"}),

    html.Div([
        # Threats
        html.Div([
            html.Div([
                html.Div([html.I(className="fas fa-exclamation-triangle", style={"fontSize":"20px","color":"#ef4444"})], style={"width":"48px","height":"48px","backgroundColor":"#1f2937","borderRadius":"12px","display":"flex","alignItems":"center","justifyContent":"center","marginBottom":"16px","border":"1px solid #ef4444"}),
                html.H2("0", id="threat-count", style={"fontSize":"32px","fontWeight":"700","color":"#f9fafb","margin":"0 0 4px 0"}),
                html.P("Threats Detected", style={"fontSize":"14px","color":"#9ca3af","margin":"0"}),
            ])
        ], style={"backgroundColor":"#1f2937","padding":"24px","borderRadius":"12px","boxShadow":"0 4px 6px rgba(0,0,0,0.3)","border":"1px solid #374151","flex":"1"}),
        # Safe
        html.Div([
            html.Div([
                html.Div([html.I(className="fas fa-check-circle", style={"fontSize":"20px","color":"#10b981"})], style={"width":"48px","height":"48px","backgroundColor":"#1f2937","borderRadius":"12px","display":"flex","alignItems":"center","justifyContent":"center","marginBottom":"16px","border":"1px solid #10b981"}),
                html.H2("0", id="safe-count", style={"fontSize":"32px","fontWeight":"700","color":"#f9fafb","margin":"0 0 4px 0"}),
                html.P("Safe Messages", style={"fontSize":"14px","color":"#9ca3af","margin":"0"}),
            ])
        ], style={"backgroundColor":"#1f2937","padding":"24px","borderRadius":"12px","boxShadow":"0 4px 6px rgba(0,0,0,0.3)","border":"1px solid #374151","flex":"1"}),
        # Active channels
        html.Div([
            html.Div([
                html.Div([html.I(className="fas fa-satellite-dish", style={"fontSize":"20px","color":"#3b82f6"})], style={"width":"48px","height":"48px","backgroundColor":"#1f2937","borderRadius":"12px","display":"flex","alignItems":"center","justifyContent":"center","marginBottom":"16px","border":"1px solid #3b82f6"}),
                html.H2("0", id="active-channels", style={"fontSize":"32px","fontWeight":"700","color":"#f9fafb","margin":"0 0 4px 0"}),
                html.P("Active Channels", style={"fontSize":"14px","color":"#9ca3af","margin":"0"}),
            ])
        ], style={"backgroundColor":"#1f2937","padding":"24px","borderRadius":"12px","boxShadow":"0 4px 6px rgba(0,0,0,0.3)","border":"1px solid #374151","flex":"1"}),
    ], style={"display":"flex","gap":"24px","marginBottom":"24px"}),

    html.Div([
        # Left panel
        html.Div([
            html.H3("Channels", style={"fontSize":"18px","fontWeight":"600","color":"#f9fafb","margin":"0 0 16px 0"}),
            html.Div([
                html.Div([
                    html.I(className=cfg["icon"], style={"fontSize":"18px","color":cfg["color"],"marginRight":"12px"}),
                    html.Span(cfg["name"], style={"fontSize":"14px","fontWeight":"500","color":"#d1d5db"}),
                    html.Div("●", style={"marginLeft":"auto","color":"#10b981","fontSize":"12px"}),
                ], style={"display":"flex","alignItems":"center","padding":"12px 16px","backgroundColor":"#374151","border":f"1px solid {cfg['color']}50","borderRadius":"8px","marginBottom":"8px"})
                for _key, cfg in CHANNEL_CONFIG.items()
            ]),

            html.Div(style={"height":"24px"}),
            html.H3("Message Types", style={"fontSize":"18px","fontWeight":"600","color":"#f9fafb","margin":"0 0 16px 0"}),
            html.Div([
                html.Div([
                    html.I(className=tcfg["icon"], style={"fontSize":"14px","color":tcfg["color"],"marginRight":"10px"}),
                    html.Span(tcfg["name"], style={"fontSize":"14px","color":"#d1d5db"}),
                ], style={"display":"flex","alignItems":"center","padding":"10px 16px","backgroundColor":tcfg["bg"],"border":f"1px solid {tcfg['border']}","borderRadius":"8px","marginBottom":"8px"})
                for _k, tcfg in MESSAGE_TYPE_CONFIG.items()
            ])
        ], style={"width":"280px","backgroundColor":"#1f2937","padding":"24px","borderRadius":"12px","boxShadow":"0 4px 6px rgba(0,0,0,0.3)","border":"1px solid #374151","display":"inline-block","verticalAlign":"top","marginRight":"24px"}),

        # Feed
        html.Div([
            html.Div([
                html.H3("Message Feed", style={"fontSize":"18px","fontWeight":"600","color":"#f9fafb","margin":"0"}),
                html.Div([html.I(className="fas fa-sync-alt", style={"fontSize":"12px","color":"#9ca3af","marginRight":"6px"}), html.Span("Auto-refresh", style={"fontSize":"12px","color":"#9ca3af"})], style={"display":"flex","alignItems":"center"}),
            ], style={"display":"flex","justifyContent":"space-between","alignItems":"center","marginBottom":"20px","paddingBottom":"16px","borderBottom":"1px solid #374151"}),
            dcc.Interval(id="interval", interval=3000, n_intervals=0),
            html.Div(id="messages-container", style={"maxHeight":"600px","overflowY":"auto"}),
        ], style={"flex":"1","backgroundColor":"#1f2937","padding":"24px","borderRadius":"12px","boxShadow":"0 4px 6px rgba(0,0,0,0.3)","border":"1px solid #374151","display":"inline-block","verticalAlign":"top","width":"calc(100% - 332px)"})
    ], style={"display":"flex"}),
], style={"fontFamily":"-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif","backgroundColor":"#111827","minHeight":"100vh","padding":"24px"})

@dash_app.callback(
    [Output("messages-container", "children"), Output("safe-count", "children"), Output("threat-count", "children"), Output("active-channels", "children")],
    Input("interval", "n_intervals"),
)
def update_dashboard(_):
    last_msgs = messages[-15:][::-1]
    safe_count = sum(1 for m in last_msgs if m.get("prediction") == "safe")
    threat_count = len(last_msgs) - safe_count
    active_channels = len(set(m.get("source", "unknown") for m in last_msgs))

    nodes = []
    for m in last_msgs:
        source = (m.get("source", "unknown") or "unknown").lower()
        mtype = (m.get("type", "text") or "text").lower()
        is_safe = m.get("prediction") == "safe"
        confidence = m.get("confidence")
        status = m.get("status", "completed")
        
        # Spoofing detection
        is_spoofed = m.get("is_spoofed")
        spoof_confidence = m.get("spoof_confidence")

        c_cfg = CHANNEL_CONFIG.get(source, {"name":"Unknown","icon":"fas fa-question-circle","color":"#9ca3af","bg":"#374151"})
        t_cfg = MESSAGE_TYPE_CONFIG.get(mtype, MESSAGE_TYPE_CONFIG["file"]) if mtype not in MESSAGE_TYPE_CONFIG else MESSAGE_TYPE_CONFIG[mtype]

        if status == "processing":
            status_color, status_bg, status_border, status_text, status_icon = ("#f59e0b", "#451a03", "#f59e0b", "Processing...", "spinner fa-spin")
        elif is_safe:
            status_color, status_bg, status_border, status_text, status_icon = ("#10b981", "#064e3b", "#10b981", "Safe", "check-circle")
        else:
            status_color, status_bg, status_border, status_text, status_icon = ("#ef4444", "#7f1d1d", "#ef4444", "Threat", "exclamation-triangle")

        # Create prominent spoofing tag for audio/video
        spoof_tag = html.Div()
        if mtype in ("audio", "video") and is_spoofed and status == "completed":
            if is_spoofed == "spoofed":
                spoof_color, spoof_bg, spoof_border = "#dc2626", "#991b1b", "#ef4444"
                spoof_text, spoof_icon = "🎭 SPOOFED", "exclamation-triangle"
                spoof_glow = "0 0 10px rgba(239, 68, 68, 0.5)"
            else:
                spoof_color, spoof_bg, spoof_border = "#059669", "#047857", "#10b981"
                spoof_text, spoof_icon = "✅ AUTHENTIC", "shield-alt"
                spoof_glow = "0 0 10px rgba(16, 185, 129, 0.3)"
            
            spoof_tag = html.Div([
                html.I(className=f"fas fa-{spoof_icon}", style={"fontSize":"14px","color":spoof_color,"marginRight":"8px"}),
                html.Span(spoof_text, style={"fontSize":"13px","fontWeight":"700","color":spoof_color,"textTransform":"uppercase","letterSpacing":"0.5px"}),
            ], style={
                "display":"flex",
                "alignItems":"center",
                "padding":"6px 12px",
                "backgroundColor":spoof_bg,
                "borderRadius":"20px",
                "border":f"2px solid {spoof_border}",
                "marginLeft":"10px",
                "boxShadow":spoof_glow,
                "animation":"pulse 2s infinite" if is_spoofed == "spoofed" else "none"
            })

        # Create status tags row
        status_row = html.Div([
            html.Div([
                html.I(className=f"fas fa-{status_icon}", style={"fontSize":"12px","color":status_color,"marginRight":"6px"}),
                html.Span(status_text, style={"fontSize":"12px","fontWeight":"600","color":status_color}),
            ], style={"display":"flex","alignItems":"center","padding":"4px 10px","backgroundColor":status_bg,"borderRadius":"16px","border":f"1px solid {status_border}"}),
            spoof_tag  # Add spoofing tag here
        ], style={"display":"flex","alignItems":"center","flexWrap":"wrap"})

        # Create spoofing alert banner for spoofed content
        spoof_banner = html.Div()
        if mtype in ("audio", "video") and is_spoofed == "spoofed" and status == "completed":
            spoof_banner = html.Div([
                html.Div([
                    html.I(className="fas fa-exclamation-triangle", style={"fontSize":"16px","color":"#fbbf24","marginRight":"10px","animation":"flash 1s infinite"}),
                    html.Span("⚠️ DEEPFAKE/SPOOFED CONTENT DETECTED", style={"fontSize":"14px","fontWeight":"700","color":"#fbbf24","textTransform":"uppercase","letterSpacing":"1px"}),
                    html.I(className="fas fa-exclamation-triangle", style={"fontSize":"16px","color":"#fbbf24","marginLeft":"10px","animation":"flash 1s infinite"}),
                ], style={"display":"flex","alignItems":"center","justifyContent":"center"}),
                html.P(f"This {mtype.upper()} file has been identified as potentially manipulated or artificially generated.", 
                       style={"fontSize":"12px","color":"#fed7aa","margin":"8px 0 0 0","textAlign":"center","fontStyle":"italic"})
            ], style={
                "backgroundColor":"#451a03",
                "border":"2px solid #f59e0b",
                "borderRadius":"8px",
                "padding":"12px",
                "marginBottom":"12px",
                "boxShadow":"0 0 15px rgba(245, 158, 11, 0.4)",
                "animation":"glow 2s ease-in-out infinite alternate"
            })

        nodes.append(html.Div([
            # Header with source, type, and status
            html.Div([
                html.Div([
                    html.I(className=c_cfg["icon"], style={"fontSize":"16px","color":c_cfg["color"],"marginRight":"10px"}),
                    html.Span(c_cfg["name"], style={"fontSize":"14px","fontWeight":"600","color":"#f9fafb","marginRight":"12px"}),
                    html.Span(t_cfg["name"], style={"fontSize":"12px","color":t_cfg["color"],"backgroundColor":t_cfg["bg"],"padding":"2px 8px","borderRadius":"12px","border":f"1px solid {t_cfg['border']}"}),
                ], style={"display":"flex","alignItems":"center"}),
                status_row
            ], style={"display":"flex","justifyContent":"space-between","alignItems":"center","marginBottom":"12px","flexWrap":"wrap","gap":"10px"}),

            # Spoofing alert banner (only for spoofed content)
            spoof_banner,

            # Message content
            html.Div([
                html.P(m.get("content", "No content"), style={"fontSize":"14px","lineHeight":"1.5","color":"#d1d5db","margin":"0 0 12px 0"}),
                html.Div([
                    html.I(className=t_cfg["icon"], style={"fontSize":"14px","color":t_cfg["color"],"marginRight":"8px"}),
                    html.Span(f"{t_cfg['name']} File", style={"fontSize":"12px","color":t_cfg["color"]}),
                    # Add spoofing indicator in file tag for audio/video
                    html.Span(
                        " (SPOOFED)" if mtype in ["audio","video"] and is_spoofed == "spoofed" else 
                        " (VERIFIED)" if mtype in ["audio","video"] and is_spoofed == "authentic" else "",
                        style={
                            "fontSize":"11px",
                            "fontWeight":"700",
                            "color":"#ef4444" if is_spoofed == "spoofed" else "#10b981",
                            "marginLeft":"4px"
                        }
                    )
                ], style={"display":"flex","alignItems":"center","padding":"8px 12px","backgroundColor":t_cfg["bg"],"borderRadius":"6px","border":f"1px solid {t_cfg['border']}","marginBottom":"12px"}) if mtype in ["audio","video","photo"] else html.Div(),
                
                # Footer with confidence scores and timestamp
                html.Div([
                    html.Div([
                        html.Span(
                            f"Threat: {confidence:.0%}" if confidence is not None and status == "completed" else ("Analyzing..." if status == "processing" else "Completed"),
                            style={"fontSize":"12px","color":"#9ca3af","marginRight":"15px"},
                        ),
                        # Prominent spoofing confidence for audio/video
                        html.Span(
                            f"Spoof Detection: {spoof_confidence:.0%}" if spoof_confidence is not None and mtype in ("audio", "video") and status == "completed" else "",
                            style={
                                "fontSize":"12px",
                                "color":"#ef4444" if is_spoofed == "spoofed" else "#10b981" if is_spoofed == "authentic" else "#9ca3af",
                                "fontWeight":"600" if is_spoofed else "normal"
                            },
                        ) if mtype in ("audio", "video") else html.Div(),
                    ], style={"display":"flex","alignItems":"center"}),
                    html.Span(m.get("timestamp", dt.datetime.now().strftime("%H:%M:%S")), style={"fontSize":"12px","color":"#9ca3af"}),
                ], style={"display":"flex","justifyContent":"space-between","alignItems":"center","paddingTop":"10px","borderTop":"1px solid #374151"}),
            ])
        ], style={
            "backgroundColor":"#1f2937",
            "border":"1px solid #374151",
            "borderRadius":"8px",
            "padding":"16px",
            "marginBottom":"12px",
            "boxShadow":"0 2px 4px rgba(0,0,0,0.3)",
            # Add special border for spoofed content
            "borderLeft": f"4px solid #ef4444" if mtype in ("audio", "video") and is_spoofed == "spoofed" else "4px solid transparent"
        }))

    if not nodes:
        nodes = [html.Div([
            html.I(className="fas fa-inbox", style={"fontSize":"48px","color":"#6b7280","marginBottom":"16px"}),
            html.H4("No messages yet", style={"color":"#9ca3af","fontSize":"18px","fontWeight":"500","margin":"0 0 8px 0"}),
            html.P("Messages will appear here as they're processed", style={"color":"#6b7280","fontSize":"14px","margin":"0"}),
        ], style={"textAlign":"center","padding":"60px","backgroundColor":"#1f2937","borderRadius":"8px","border":"2px dashed #374151"})]

    return nodes, safe_count, threat_count, active_channels
# Dark theme CSS

dash_app.index_string = '''
<!DOCTYPE html>
<html>
  <head>
    {%metas%}
    <title>NEXUS GUARD</title>
    {%favicon%}
    {%css%}
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
      body { background-color: #111827 !important; }
      ::-webkit-scrollbar { width: 8px; }
      ::-webkit-scrollbar-track { background: #374151; border-radius: 4px; }
      ::-webkit-scrollbar-thumb { background: #6b7280; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      .fa-spin { animation: fa-spin 2s infinite linear; }
      @keyframes fa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    {%app_entry%}
    <footer>
      {%config%}
      {%scripts%}
      {%renderer%}
    </footer>
  </body>
</html>
'''

# -------------------------------
# Message Processing pipeline
# -------------------------------
# Add these modifications to your existing code:


# 2. Update message processing to handle spoofing detection
async def process_message(msg: Dict):
    """Call respective API, set prediction, send alerts, then cleanup file."""
    try:
        msg["status"] = "processing"
        api_response: Dict = {}
        mtype = msg.get("type")

        if mtype in ("email", "text"):
            api_response = await call_email_prediction_api(msg.get("content", ""))
        elif mtype == "audio":
            api_response = await call_audio_prediction_api(msg.get("file_path", ""))
        elif mtype == "photo":
            api_response = await call_image_prediction_api(msg.get("file_path", ""))
        elif mtype == "video":
            api_response = await call_video_prediction_api(msg.get("file_path", ""))
        else:
            api_response = {"prediction": 0, "confidence": 0.0}

        # Handle main prediction
        pred_flag = api_response.get("prediction", 0)
        confidence = api_response.get("confidence", None)
        msg["prediction"] = "scam" if pred_flag == 1 else "safe"

        if confidence is not None:
            try:
                msg["confidence"] = float(confidence)
            except Exception:
                pass

        # Handle spoofing detection for audio/video
        if mtype in ("audio", "video"):
            spoof_flag = api_response.get("is_spoofed", None)
            spoof_confidence = api_response.get("spoof_confidence", None)
            print(spoof_flag)
            if spoof_flag is not None:
                msg["is_spoofed"] = str(spoof_flag)
                if spoof_confidence is not None:
                    try:
                        msg["spoof_confidence"] = float(spoof_confidence)
                    except Exception:
                        pass

        msg["status"] = "completed"

        # Enhanced alert message for spoofed content
        if msg["prediction"] == "scam":
            account_name = msg.get("source", "")
            alert_msg = (msg.get("content") or "")[:500]
            sender_name = msg.get("sender_name", "Unknown")
            sender_email = msg.get("email", "")
            
            # Add spoofing info to alert if applicable
            if mtype in ("audio", "video") and msg.get("is_spoofed") == "spoofed":
                alert_msg += f"\n⚠️ SPOOFED {mtype.upper()} DETECTED!"

            await asyncio.gather(
                send_windows_notification(account_name, sender_name, alert_msg),
                send_telegram_alert(account_name, sender_name, alert_msg),
                send_discord_alert(account_name, sender_name, alert_msg),
                send_alert_email_async(
                    to_email="mananctandel@gmail.com",
                    account_source=account_name,
                    sender=sender_name,
                    sender_email=sender_email,
                    email_subject_title=alert_msg[:50],
                ),
            )
    except Exception as e:
        msg["status"] = "completed"
        msg["prediction"] = msg.get("prediction") or "safe"
        print(f"Error in process_message: {e}")
    finally:  
        pass
        # if mtype != "video":
        #     fpath = msg.get("file_path")
        #     if fpath and os.path.isfile(fpath):
        #         try:
        #             os.remove(fpath)
        #         except Exception:
        #             pass
        #     msg["file_path"] = "[deleted]"

async def monitor_messages():
    while True:
        # Iterate over *current snapshot* to avoid processing newly appended in same loop
        for msg in list(messages):
            if msg.get("prediction") == "pending":
                await process_message(msg)
        await asyncio.sleep(2)

# -------------------------------
# Orchestration & entrypoint
# -------------------------------
async def run_all():
    # Start Dash in a background thread (non-async API)
    import threading
    threading.Thread(target=lambda: dash_app.run_server(debug=True, use_reloader=False), daemon=True).start()

    tasks = []
    # Telegram
    tasks.append(asyncio.create_task(run_telegram()))
    # Discord
    tasks.append(asyncio.create_task(run_discord()))
    # Gmail
    tasks.append(asyncio.create_task(run_gmail()))
    # Processor
    tasks.append(asyncio.create_task(monitor_messages()))

    # Graceful shutdown on SIGINT/SIGTERM
    stop_event = asyncio.Event()

    def _signal_handler(*_):
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass

    await stop_event.wait()
    print("\nShutting down…")

    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)

    # Discord close
    if SET.DISCORD_TOKEN:
        try:
            await discord_client.close()
        except Exception:
            pass

if __name__ == "__main__":
    try:
        asyncio.run(run_all())
    except KeyboardInterrupt:
        pass
