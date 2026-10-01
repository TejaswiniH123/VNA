import edge_tts
import asyncio
import uuid
import os

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def generate_tts_file(text: str, filename: str):
    """Generate and save TTS file using Microsoft Edge TTS."""
    filepath = filename  # Use full path given by caller

    communicate = edge_tts.Communicate(text, "en-US-AriaNeural")
    await communicate.save(filepath)
    print(f"✅ TTS file saved: {filepath}")
    return filepath
