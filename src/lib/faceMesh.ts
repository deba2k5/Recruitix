import { FaceLandmarker, FilesetResolver, type Classifications } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Loads the MediaPipe FaceLandmarker once (memoized) from same-origin assets — never a CDN. */
export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_PATH).then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: 'VIDEO',
        numFaces: 4, // detect extra faces so MULTIPLE_FACES can be flagged
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }),
    );
  }
  return landmarkerPromise;
}

export interface FrameDetection {
  faceCount: number;
  yawDeg: number | null;
  pitchDeg: number | null;
  blendshapes: Classifications | null;
}

const toDeg = (rad: number) => (rad * 180) / Math.PI;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Decodes yaw/pitch from MediaPipe's column-major 4x4 facialTransformationMatrix
 * (R = Rz(roll)*Ry(yaw)*Rx(pitch) convention). Approximate by design — good enough
 * for a threshold-based "looking away" check, not precise biomechanical pose.
 */
function decodeYawPitch(data: number[]): { yawDeg: number; pitchDeg: number } {
  const yawRad = Math.asin(clamp(-data[2], -1, 1));
  const pitchRad = Math.atan2(data[6], data[10]);
  return { yawDeg: toDeg(yawRad), pitchDeg: toDeg(pitchRad) };
}

export function detectFrame(landmarker: FaceLandmarker, video: HTMLVideoElement, timestampMs: number): FrameDetection {
  const result = landmarker.detectForVideo(video, timestampMs);
  const faceCount = result.faceLandmarks?.length ?? 0;

  const matrix = result.facialTransformationMatrixes?.[0];
  const pose = matrix ? decodeYawPitch(matrix.data) : null;

  return {
    faceCount,
    yawDeg: pose?.yawDeg ?? null,
    pitchDeg: pose?.pitchDeg ?? null,
    blendshapes: result.faceBlendshapes?.[0] ?? null,
  };
}
