declare module '@techstark/opencv-js' {
  export let onRuntimeInitialized: (() => void) | undefined;

  export class Mat {
    constructor();
    rows: number;
    cols: number;
    data: Uint8Array;
    delete(): void;
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
      k: number,
    ): DMatchVectorVector;
    delete(): void;
  }

  export class KeyPointVector {
    size(): number;
    get(index: number): { pt: { x: number; y: number }; size: number; angle: number; response: number; octave: number; class_id: number };
    delete(): void;
  }

  export class DMatchVectorVector {
    size(): number;
    get(index: number): DMatchVector;
    delete(): void;
  }

  export class DMatchVector {
    size(): number;
    get(index: number): { queryIdx: number; trainIdx: number; distance: number };
    delete(): void;
  }

  export const NORM_HAMMING: number;

  export function matFromImageData(imageData: { data: Uint8Array; width: number; height: number }): Mat;
}
