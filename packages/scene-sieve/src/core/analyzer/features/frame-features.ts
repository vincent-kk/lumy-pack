import type { AKAZE, KeyPointVector, Mat } from '@techstark/opencv-js';

/** Initialized OpenCV runtime supplied by the analyzer. */
type CvLib = typeof import('@techstark/opencv-js');

/** Grayscale bytes whose length matches width times height. */
type PreprocessedFrame = {
  data: Uint8Array;
  width: number;
  height: number;
};

/** Caller-owned AKAZE features for one frame; delete releases both handles once. */
export interface FrameFeatures {
  /** Width of the analyzed grayscale image. */
  readonly width: number;
  /** Height of the analyzed grayscale image. */
  readonly height: number;
  /** Keypoints in descriptor row order. */
  readonly keypoints: KeyPointVector;
  /** Descriptor rows equal keypoints.size(). */
  readonly descriptors: Mat;
  /** Release both native handles; repeated calls have no effect. */
  delete(): void;
}

/**
 * Detect one frame's features without retaining its image or mask.
 * @param cvLib - Initialized OpenCV runtime.
 * @param akaze - Detector owned and released by the caller.
 * @param frame - Grayscale bytes with matching width and height.
 * @returns Feature handles that the caller must delete.
 * @throws Propagates native errors after releasing partial allocations.
 */
export function computeFrameFeatures(
  cvLib: CvLib,
  akaze: AKAZE,
  frame: PreprocessedFrame,
): FrameFeatures {
  let image: Mat | null = null;
  let mask: Mat | null = null;
  let keypoints: KeyPointVector | null = null;
  let descriptors: Mat | null = null;
  try {
    image = new cvLib.Mat(frame.height, frame.width, cvLib.CV_8UC1);
    image.data.set(frame.data);
    mask = new cvLib.Mat();
    keypoints = new cvLib.KeyPointVector();
    descriptors = new cvLib.Mat();
    akaze.detectAndCompute(image, mask, keypoints, descriptors);

    const ownedKeypoints = keypoints;
    const ownedDescriptors = descriptors;
    let deleted = false;
    const features: FrameFeatures = {
      width: frame.width,
      height: frame.height,
      keypoints: ownedKeypoints,
      descriptors: ownedDescriptors,
      /** Release the transferred handles exactly once. */
      delete() {
        if (deleted) return;
        deleted = true;
        try {
          ownedKeypoints.delete();
        } finally {
          ownedDescriptors.delete();
        }
      },
    };
    keypoints = null;
    descriptors = null;
    return features;
  } finally {
    image?.delete();
    mask?.delete();
    keypoints?.delete();
    descriptors?.delete();
  }
}
