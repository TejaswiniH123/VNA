from ultralytics import YOLO
import cv2
import os
import uuid

# Use YOLOv8n model (make sure yolov8n.pt is in the same folder or path)
MODEL_PATH = "yolov8n.pt"
model = YOLO(MODEL_PATH)

def detect_objects(image_path: str):
    results = model(image_path)[0]

    img = cv2.imread(image_path)
    detections = []

    for box, cls, conf in zip(results.boxes.xyxy, results.boxes.cls, results.boxes.conf):
        # xyxy gives [x1, y1, x2, y2]
        x1, y1, x2, y2 = map(int, box.cpu().numpy())

        detections.append({
            "class_id": int(cls.cpu().numpy()),
            "class_name": model.names[int(cls.cpu().numpy())],  # human-readable label
            "confidence": float(conf.cpu().numpy()),
            "bbox": [x1, y1, x2, y2]
        })

        # Draw bounding box + label
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"{model.names[int(cls.cpu().numpy())]} {conf:.2f}"
        cv2.putText(img, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Save output
    os.makedirs("uploads", exist_ok=True)
    output_file = os.path.join("uploads", f"det_{uuid.uuid4().hex}.jpg")
    cv2.imwrite(output_file, img)

    return detections, output_file
