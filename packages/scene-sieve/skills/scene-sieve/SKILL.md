---
name: scene-sieve
description: Extract representative frames from local video and animated GIF files for visual inspection, screenshot capture, and screen-recording review. Use when motion media must be understood as still images; do not use for audio transcription or general video editing.
---

# Scene Sieve

Turn a local video or animated GIF into a small, timestamped set of frames, then use those frames to answer the user's visual question.

## Workflow

1. Resolve the input path and the user's goal. Ask only when the path or requested result cannot be inferred safely.
2. Run the bundled probe from this skill's directory:

   ```bash
   node "<skill-dir>/scripts/probe.mjs" "<input-file>" [intent]
   ```

   Use an optional intent only when it matches the request:
   `quick-glance`, `detailed`, `hq-capture`, `inspection`, or `screen-recording`.

3. Read the probe JSON. Continue only when `ok` is true. Treat `preset` and `command` as the source of truth; do not reproduce preset thresholds in the prompt.
4. Choose the output directory:
   - Use the user's requested location when provided.
   - Otherwise create a task-scoped temporary directory outside the source-media directory.
5. Run the returned `command` with `-o "<output-dir>"`. Keep `--json` enabled and parse the structured result before inspecting files.
6. On success, inspect the image paths in `data.outputFiles` in timestamp order. Read `.metadata.json` when timestamps or UI-state transitions matter. Gaps in frame numbering are expected after pruning.
7. Answer the user's question from the visual evidence. Mention timestamps when useful; do not narrate every frame unless requested.

## Failure and stopping rules

- Inspect the structured error before retrying. If the installed CLI rejects a flag, run `npx -y @lumy-pack/scene-sieve --describe` and adapt to the reported interface.
- For timeout or memory pressure, retry at most once with a smaller count, lower FPS and scale, `--max-frames 100`, and `--concurrency 1`.
- If the file has no usable video stream, report that fact and use a different skill only when the user's request also covers audio or file repair.
- Stop when the selected frames provide enough evidence for the requested answer. Do not extract more frames merely for completeness.

## Boundaries

- Never modify the source media.
- The probe-generated command uses `npx -y`; follow the host's approval policy if this would download the package. Do not install it globally unless the user explicitly asks.
- Delete only task-owned temporary output after it is no longer needed. Preserve user-requested screenshots or frame directories.
- Do not infer dialogue, sound, or narration from frames alone.
