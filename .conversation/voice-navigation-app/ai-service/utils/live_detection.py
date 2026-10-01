import cv2
import asyncio
import threading
import os
import uuid
import time
from datetime import datetime
from ultralytics import YOLO
from utils.text_to_speech import generate_tts_file

# ===============================================================
#                   INITIAL CONFIGURATION
# ===============================================================

# Load YOLO model (small, fast version)
model = YOLO("yolov8n.pt")

# Reference object widths (meters) for distance estimation
KNOWN_WIDTHS = {
    "person": 0.5,
    "car": 1.8,
    "bicycle": 1.2,
    "dog": 0.4,
    "cat": 0.25
}

FOCAL_LENGTH = 800                # approximate, can be calibrated
MIN_CONFIDENCE = 0.5              # ignore weak detections
GLOBAL_COOLDOWN = 6               # min time between any two announcements
OBJECT_COOLDOWN = 12              # cooldown per object type
DISTANCE_VARIATION_TOLERANCE = 0.4  # announce only if distance varies significantly
AUDIO_DIR = "audio_logs"          # base directory for storing TTS outputs

# Tracking state
last_announcement_time = 0
last_object_times = {}            # {label: timestamp}
last_distances = {}               # {label: distance}
running = False
# Add these global variables at the top with your other globals
current_detections = []
detection_lock = threading.Lock()


# ===============================================================
#                     HELPER FUNCTIONS
# ===============================================================

def ensure_dir(path):
    """Ensure directory exists."""
    if not os.path.exists(path):
        os.makedirs(path)


def cleanup_old_files(folder, keep_latest=5):
    """Remove older audio files to avoid clutter."""
    files = sorted(
        [os.path.join(folder, f) for f in os.listdir(folder)],
        key=os.path.getctime,
        reverse=True
    )
    for f in files[keep_latest:]:
        try:
            os.remove(f)
        except Exception:
            pass


def estimate_distance(known_width, pixel_width):
    """Estimate distance (in meters) from object width in pixels."""
    if pixel_width == 0:
        return None
    distance_m = (known_width * FOCAL_LENGTH) / pixel_width
    return round(distance_m, 2)


def get_direction(center_x, frame_width):
    """Estimate horizontal direction of object."""
    ratio = center_x / frame_width
    if ratio < 0.33:
        return "on your left"
    elif ratio < 0.66:
        return "in front of you"
    else:
        return "on your right"


def speak_async(text, label="unknown"):
    """Run TTS asynchronously with file logging."""
    def run():
        try:
            date_folder = os.path.join(AUDIO_DIR, datetime.now().strftime("%Y-%m-%d"))
            ensure_dir(date_folder)
            filename = os.path.join(date_folder, f"{label}_{uuid.uuid4().hex}.mp3")

            asyncio.run(generate_tts_file(text,filename))

            # Clean up older files
            cleanup_old_files(date_folder)

        except Exception as e:
            print("TTS Error:", e)

    threading.Thread(target=run, daemon=True).start()


# ===============================================================
#                     MAIN DETECTION FUNCTION
# ===============================================================

def start_live_detection():
    """Main real-time detection and voice guidance loop."""
    global running, last_announcement_time, current_detections
    running = True
    with detection_lock:
        current_detections = []
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Camera not accessible.")
        return

    print("🎥 Live detection started. Press 'q' to quit.")

    while running:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame, stream=True)
        detected_objects = []
        frame_width = frame.shape[1]

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf < MIN_CONFIDENCE:
                    continue

                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                pixel_width = x2 - x1

                # Distance estimation
                distance = None
                if label in KNOWN_WIDTHS:
                    distance = estimate_distance(KNOWN_WIDTHS[label], pixel_width)

                # Direction estimation
                center_x = (x1 + x2) / 2
                direction = get_direction(center_x, frame_width)

                # Draw visuals
                color = (0, 255, 0)
                text = f"{label} {conf:.2f}"
                if distance:
                    text += f" ~{distance}m"
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, text, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

                detected_objects.append((label, distance, direction))

        with detection_lock:
            current_detections = detected_objects.copy()


        # =============================
        #       VOICE ANNOUNCEMENTS
        # =============================
        now = time.time()
        for label, distance, direction in detected_objects:
            if label not in KNOWN_WIDTHS:
                continue

            last_time = last_object_times.get(label, 0)
            last_dist = last_distances.get(label, None)

            # Check cooldowns
            if (now - last_time < OBJECT_COOLDOWN) or (now - last_announcement_time < GLOBAL_COOLDOWN):
                continue
            # Check for meaningful distance change
            if last_dist and distance and abs(distance - last_dist) / last_dist < DISTANCE_VARIATION_TOLERANCE:
                continue

            # Construct sentence
            if distance:
                sentence = f"{label} detected approximately {distance} meters {direction}"
            else:
                sentence = f"{label} detected {direction}"

            speak_async(sentence, label)

            last_announcement_time = now
            last_object_times[label] = now
            last_distances[label] = distance

        # Small sleep to yield CPU in headless loop
        time.sleep(0.01)

    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    running = False
    print("🛑 Live detection stopped.")

def get_current_detections():
    """Get the latest detections for frontend API"""
    with detection_lock:
        return current_detections.copy()


def stop_live_detection():
    """Stop the detection loop gracefully."""
    global running
    running = False
    print("🛑 Stop signal received.")


def process_frame(frame):
    """
    Process a single OpenCV image frame using YOLO, estimate distance and direction.
    Returns a list of dicts: [{'class_name': str, 'distance': float|None, 'direction': str, 'confidence': float}]
    """
    if frame is None:
        return []

    results = model(frame)[0]
    detected_objects = []
    frame_width = frame.shape[1]

    for box in results.boxes:
        conf = float(box.conf[0])
        if conf < MIN_CONFIDENCE:
            continue

        cls_id = int(box.cls[0])
        label = model.names[cls_id]
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        pixel_width = x2 - x1

        # Distance estimation
        distance = None
        if label in KNOWN_WIDTHS:
            distance = estimate_distance(KNOWN_WIDTHS[label], pixel_width)

        # Direction estimation
        center_x = (x1 + x2) / 2
        direction = get_direction(center_x, frame_width)

        detected_objects.append({
            "class_name": label,
            "distance": distance,
            "direction": direction,
            "confidence": round(conf, 2)
        })

    return detected_objects

