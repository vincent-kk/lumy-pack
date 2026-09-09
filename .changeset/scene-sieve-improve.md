---
'@lumy-pack/scene-sieve': minor
---

Enforce maxFrames as a strict candidate limit for file and buffer input, with grid-aligned segments and timestamps. Remove the 0.5 FPS floor so long videos stay within the budget; frames input remains uncapped.

Report source duration, effective FPS and actual output JPEG dimensions consistently in API and file metadata. Scale animation bounding boxes to output image coordinates using independent horizontal and vertical factors.

Validate numeric option ranges and equal dimensions for frames input, reporting INVALID_INPUT for invalid values. Accept fractional --fps values and reject partially numeric CLI arguments.

Cache AKAZE features and preprocessing per frame, reuse the detector, and compute only newly appeared features. Preserve adjacent edges across segment boundaries and release native OpenCV handles, including on allocation failures. Keep score normalization equivalent while improving rank lookup performance.

Reject Workers that exit without settling a result and return exit code 1 for failures in both interactive and JSON CLI modes. Reset debug state on each pipeline call and surface analysis failures instead of silently accepting an entirely failed multi-pair analysis.
