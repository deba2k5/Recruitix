"""
Exam Proctoring — Python version
================================
Verifies the student against their registered photo at exam start, then
monitors continuously so the person in front of the camera cannot change.

What each library does (important distinction):
  - MediaPipe FaceMesh  -> landmarks only: face present? how many faces?
                           head pose (looking away)? It CANNOT verify identity.
  - face_recognition    -> 128-d face embeddings: is this the SAME person
                           as the registered photo?

Install:
    pip install mediapipe opencv-python face_recognition numpy

    (face_recognition needs dlib; on Windows install cmake first, or use
     `pip install face_recognition` inside conda. Alternative: DeepFace.)

Run:
    python exam_proctor.py --reference student_photo.jpg
    python exam_proctor.py --reference student_photo.jpg --camera 1 --no-window

Output:
    - Live status window (press Q to end the exam session)
    - violations.jsonl        one JSON line per confirmed violation
    - snapshots/*.jpg         frame captured at the moment of each violation
"""

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
# pyrefly: ignore [missing-import]
import face_recognition
import mediapipe as mp

# ----------------------------- configuration ------------------------------

MATCH_TOLERANCE = 0.55        # face_recognition distance; lower = stricter
IDENTITY_CHECK_EVERY_S = 8    # re-verify identity this often
PRESENCE_CHECK_EVERY_S = 1.0  # face count / head pose check interval
STRIKES_TO_VIOLATION = 3      # consecutive bad checks before flagging
MAX_YAW_DEG = 30              # head turned left/right beyond this = away
MAX_PITCH_DEG = 25            # head tilted up/down beyond this = away

SNAPSHOT_DIR = Path("snapshots")
LOG_FILE = Path("violations.jsonl")

# 3D reference points of a generic face model for head-pose (solvePnP).
# Indices are MediaPipe FaceMesh landmark ids.
POSE_LANDMARKS = {
    1: (0.0, 0.0, 0.0),          # nose tip
    152: (0.0, -63.6, -12.5),    # chin
    263: (-43.3, 32.7, -26.0),   # right eye outer corner
    33: (43.3, 32.7, -26.0),     # left eye outer corner
    287: (-28.9, -28.9, -24.1),  # right mouth corner
    57: (28.9, -28.9, -24.1),    # left mouth corner
}

# ------------------------------- helpers ----------------------------------


def load_reference_encoding(path: str) -> np.ndarray:
    """Encode the registered photo. Fail loudly BEFORE the exam starts."""
    image = face_recognition.load_image_file(path)
    encodings = face_recognition.face_encodings(image)
    if len(encodings) == 0:
        raise SystemExit(f"[FATAL] No face found in reference photo: {path}")
    if len(encodings) > 1:
        raise SystemExit(f"[FATAL] Reference photo must contain exactly one face: {path}")
    return encodings[0]


def head_pose_degrees(landmarks, frame_w: int, frame_h: int):
    """Estimate (yaw, pitch) in degrees from FaceMesh landmarks via solvePnP."""
    image_pts, model_pts = [], []
    for idx, model_pt in POSE_LANDMARKS.items():
        lm = landmarks.landmark[idx]
        image_pts.append((lm.x * frame_w, lm.y * frame_h))
        model_pts.append(model_pt)

    image_pts = np.array(image_pts, dtype=np.float64)
    model_pts = np.array(model_pts, dtype=np.float64)

    focal = frame_w
    camera_matrix = np.array(
        [[focal, 0, frame_w / 2], [0, focal, frame_h / 2], [0, 0, 1]],
        dtype=np.float64,
    )
    ok, rvec, _ = cv2.solvePnP(
        model_pts, image_pts, camera_matrix, np.zeros((4, 1)),
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not ok:
        return None, None

    rot, _ = cv2.Rodrigues(rvec)
    # yaw around Y, pitch around X
    yaw = np.degrees(np.arcsin(np.clip(rot[0, 2], -1.0, 1.0)))
    pitch = np.degrees(np.arctan2(-rot[1, 2], rot[2, 2]))
    # normalize pitch to a small angle around 0
    if pitch > 90:
        pitch -= 180
    elif pitch < -90:
        pitch += 180
    return float(yaw), float(pitch)


def verify_identity(frame_bgr: np.ndarray, reference: np.ndarray):
    """Return (face_found, matched, distance) for the current frame."""
    # downscale for speed
    small = cv2.resize(frame_bgr, (0, 0), fx=0.5, fy=0.5)
    rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(rgb, model="hog")
    if not locations:
        return False, False, None
    # use the largest face in frame
    largest = max(locations, key=lambda b: (b[2] - b[0]) * (b[1] - b[3]))
    encodings = face_recognition.face_encodings(rgb, [largest])
    if not encodings:
        return False, False, None
    distance = float(face_recognition.face_distance([reference], encodings[0])[0])
    return True, distance <= MATCH_TOLERANCE, distance


class ViolationLog:
    """Debounced violation recorder with JSONL log + frame snapshots."""

    def __init__(self):
        self.strikes = defaultdict(int)
        self.count = 0
        SNAPSHOT_DIR.mkdir(exist_ok=True)

    def strike(self, vtype: str, message: str, frame: np.ndarray) -> bool:
        """Register a failed check. Returns True if a violation was confirmed."""
        self.strikes[vtype] += 1
        if self.strikes[vtype] < STRIKES_TO_VIOLATION:
            return False
        self.strikes[vtype] = 0
        self.count += 1

        ts = time.time()
        snap_path = SNAPSHOT_DIR / f"{int(ts)}_{vtype}.jpg"
        cv2.imwrite(str(snap_path), frame)
        record = {
            "type": vtype,
            "message": message,
            "timestamp": ts,
            "snapshot": str(snap_path),
        }
        with LOG_FILE.open("a") as f:
            f.write(json.dumps(record) + "\n")
        print(f"[VIOLATION] {vtype}: {message}")
        return True

    def clear(self, vtype: str):
        self.strikes[vtype] = 0


# --------------------------------- main -----------------------------------


def main():
    parser = argparse.ArgumentParser(description="Exam proctoring monitor")
    parser.add_argument("--reference", required=True, help="Registered photo of the student")
    parser.add_argument("--camera", type=int, default=0, help="Webcam index")
    parser.add_argument("--no-window", action="store_true", help="Run headless (no preview)")
    args = parser.parse_args()

    print("[*] Loading reference photo...")
    reference = load_reference_encoding(args.reference)

    print("[*] Starting MediaPipe FaceMesh...")
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        max_num_faces=4,              # so we can catch a second person
        refine_landmarks=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit("[FATAL] Cannot open camera.")

    log = ViolationLog()

    # ---- initial identity gate: exam cannot start until the student matches
    print("[*] Verifying identity against registered photo...")
    verified = False
    gate_deadline = time.time() + 30
    while time.time() < gate_deadline:
        ok, frame = cap.read()
        if not ok:
            continue
        found, matched, dist = verify_identity(frame, reference)
        if found and matched:
            print(f"[OK] Identity verified (distance={dist:.3f}). Exam may begin.")
            verified = True
            break
        label = "No face visible" if not found else f"Face does not match (distance={dist:.3f})"
        print(f"    {label} — retrying...")
        time.sleep(1)

    if not verified:
        raise SystemExit("[FATAL] Identity could not be verified. Exam blocked.")

    # ---- continuous monitoring loop
    last_presence = 0.0
    last_identity = time.time()
    status_text, status_color = "MONITORING", (0, 200, 0)

    print("[*] Monitoring... press Q in the preview window to end the session.")
    while True:
        ok, frame = cap.read()
        if not ok:
            log.strike("CAMERA_ERROR", "Camera frame could not be read.", np.zeros((10, 10, 3), np.uint8))
            time.sleep(1)
            continue

        now = time.time()
        h, w = frame.shape[:2]

        # -- presence / face count / head pose (MediaPipe FaceMesh)
        if now - last_presence >= PRESENCE_CHECK_EVERY_S:
            last_presence = now
            results = face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            faces = results.multi_face_landmarks or []
            clean = True

            if len(faces) == 0:
                clean = False
                log.strike("NO_FACE", "Student not visible in camera.", frame)
            else:
                log.clear("NO_FACE")

            if len(faces) > 1:
                clean = False
                log.strike("MULTIPLE_FACES", f"{len(faces)} people detected in frame.", frame)
            else:
                log.clear("MULTIPLE_FACES")

            if len(faces) == 1:
                yaw, pitch = head_pose_degrees(faces[0], w, h)
                if yaw is not None and (abs(yaw) > MAX_YAW_DEG or abs(pitch) > MAX_PITCH_DEG):
                    clean = False
                    log.strike("LOOKING_AWAY",
                               f"Looking away (yaw={yaw:.0f}, pitch={pitch:.0f}).", frame)
                else:
                    log.clear("LOOKING_AWAY")

            status_text = "MONITORING" if clean else "CHECK: see console"
            status_color = (0, 200, 0) if clean else (0, 165, 255)

        # -- periodic identity re-verification (person-swap detection)
        if now - last_identity >= IDENTITY_CHECK_EVERY_S:
            last_identity = now
            found, matched, dist = verify_identity(frame, reference)
            if found and not matched:
                log.strike("IDENTITY_MISMATCH",
                           f"Person no longer matches registered photo (distance={dist:.3f}).",
                           frame)
                status_text, status_color = "IDENTITY MISMATCH", (0, 0, 255)
            elif found and matched:
                log.clear("IDENTITY_MISMATCH")

        # -- preview window
        if not args.no_window:
            cv2.putText(frame, status_text, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)
            cv2.putText(frame, f"violations: {log.count}", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            cv2.imshow("Exam Proctor", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()
    face_mesh.close()
    print(f"[*] Session ended. {log.count} violation(s) logged to {LOG_FILE}.")


if __name__ == "__main__":
    main()
