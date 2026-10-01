# utils/speech_to_text.py
import whisper
from pydub import AudioSegment
import os
import tempfile

import shutil

# === Portable FFmpeg Setup ===
ffmpeg_in_path = shutil.which("ffmpeg")
if ffmpeg_in_path:
    AudioSegment.converter = ffmpeg_in_path
else:
    # Check default Windows build path if system PATH lookup fails
    default_win_ffmpeg = r"C:\ffmpeg-8.0-essentials_build\bin\ffmpeg.exe"
    if os.path.exists(default_win_ffmpeg):
        os.environ["PATH"] += os.pathsep + os.path.dirname(default_win_ffmpeg)
        AudioSegment.converter = default_win_ffmpeg

# === Load Whisper model once ===
model = whisper.load_model("base")

def convert_speech_to_text(audio_path: str) -> str:
    """
    Converts an audio file (mp3, wav, etc.) to text using Whisper.
    Returns the transcribed text as a string.
    Raises Exception on failure.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"File not found: {audio_path}")

    # Convert to WAV if not already
    ext = os.path.splitext(audio_path)[1].lower()
    if ext != ".wav":
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = tmp.name
        try:
            AudioSegment.from_file(audio_path).export(wav_path, format="wav")
            audio_path = wav_path
        except Exception as e:
            raise RuntimeError(f"Audio conversion failed: {str(e)}")

    # Transcribe
    try:
        result = model.transcribe(audio_path)
        return result["text"]
    except Exception as e:
        raise RuntimeError(f"Transcription failed: {str(e)}")
    finally:
        # Cleanup temp WAV
        if 'wav_path' in locals() and os.path.exists(wav_path):
            os.remove(wav_path)
