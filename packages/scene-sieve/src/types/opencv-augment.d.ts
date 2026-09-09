declare module '@techstark/opencv-js' {
  export let onRuntimeInitialized: (() => void) | undefined;

  export class Mat {
    constructor();
    /** Allocate an image with the specified dimensions and OpenCV pixel type. */
    constructor(rows: number, cols: number, type: number);
    rows: number;
    cols: number;
    data: Uint8Array;
    delete(): void;
    /** Whether this Embind handle has been released. */
    isDeleted(): boolean;
  }

  export class AKAZE {
    constructor();
    detect(image: Mat, mask?: Mat): KeyPointVector;
    compute(image: Mat, keypoints: KeyPointVector, descriptors: Mat): void;
    detectAndCompute(
      image: Mat,
      mask: Mat,
      keypoints: KeyPointVector,
      descriptors: Mat,
    ): void;
    delete(): void;
  }

  export class BFMatcher {
    constructor(normType?: number, crossCheck?: boolean);
    knnMatch(
      queryDescriptors: Mat,
      trainDescriptors: Mat,
      matches: DMatchVectorVector,
      k: number,
    ): void;
    delete(): void;
  }

  export class KeyPointVector {
    size(): number;
    get(index: number): {
      pt: { x: number; y: number };
      size: number;
      angle: number;
      response: number;
      octave: number;
      class_id: number;
    };
    delete(): void;
  }

  export class DMatchVectorVector {
    size(): number;
    get(index: number): DMatchVector;
    delete(): void;
  }

  export class DMatchVector {
    size(): number;
    get(index: number): {
      queryIdx: number;
      trainIdx: number;
      distance: number;
    };
    delete(): void;
    /** Whether this Embind handle has been released. */
    isDeleted(): boolean;
  }

  /** Owns a contour collection; each get result must also be released. */
  export class MatVector {
    /** Number of contours available for indexed access. */
    size(): number;
    /** Return a caller-owned Mat handle for an existing contour index. */
    get(index: number): Mat;
    /** Release this collection's Embind handle. */
    delete(): void;
    /** Whether this Embind handle has been released. */
    isDeleted(): boolean;
  }

  export const NORM_HAMMING: number;
  /** Unsigned eight-bit grayscale image type. */
  export const CV_8UC1: number;

  export function matFromImageData(imageData: {
    data: Uint8Array;
    width: number;
    height: number;
  }): Mat;
}
