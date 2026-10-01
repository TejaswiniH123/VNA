# app/utils/ocr_utils.py
from PIL import Image
import pytesseract
try:
    from gtts import gTTS
except ImportError:
    gTTS = None

def extract_text_from_image(image_path: str) -> str:
    img = Image.open(image_path)
    return pytesseract.image_to_string(img)

def text_to_speech(text: str, output_path: str):
    tts = gTTS(text=text, lang="en")
    tts.save(output_path)
