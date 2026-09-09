---
'@lumy-pack/scene-sieve': patch
---

Enforce maxFrames as a strict candidate limit for file and buffer input, with grid-aligned segments and timestamps. Remove the 0.5 FPS floor so long videos stay within the budget; frames input remains uncapped.
