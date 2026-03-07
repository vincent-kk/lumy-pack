#!/usr/bin/env python3
"""
Mirror GLiNER ONNX models: download from onnx-community, verify, upload to vincent-kk HF repo.

Designed to run inside Docker (scripts/model/Dockerfile).
All logs go to stderr; only the final JSON result goes to stdout.

Environment variables:
  HF_TOKEN      — HuggingFace write token (required for upload)
  HF_ORG        — HuggingFace org/user for upload (default: vincent-kk)
  SKIP_UPLOAD   — Set to '1' to skip upload (verify only)
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

# ── Configuration ──────────────────────────────────────────────────────────

MODELS = [
    {
        "id": "gliner_multi-v2.1",
        "source_repo": "onnx-community/gliner_multi-v2.1",
        "target_repo_suffix": "gliner_multi-v2.1-onnx",
        "onnx_file": "onnx/model_int8.onnx",
        "license": "apache-2.0",
    },
]

HF_ORG = os.environ.get("HF_ORG", "vincent-kk")

# ── Helpers ────────────────────────────────────────────────────────────────

def log(msg: str):
    print(msg, file=sys.stderr, flush=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def human_size(nbytes: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if nbytes < 1024:
            return f"{nbytes:.1f}{unit}"
        nbytes /= 1024
    return f"{nbytes:.1f}TB"


# ── Steps ──────────────────────────────────────────────────────────────────

def step_download(source_repo: str, onnx_file: str, work_dir: Path) -> Path:
    """Download ONNX model and supporting files from source repo."""
    log(f"\n[1/5] Downloading from {source_repo}")

    from huggingface_hub import snapshot_download

    # Download only the onnx directory and config files
    snapshot_dir = snapshot_download(
        repo_id=source_repo,
        local_dir=str(work_dir / "snapshot"),
        allow_patterns=[
            "onnx/*",
            "*.json",
            "*.txt",
            "*.model",
            "tokenizer*",
        ],
    )

    model_path = Path(snapshot_dir) / onnx_file
    if not model_path.exists():
        log(f"  ERROR: Expected file not found: {onnx_file}")
        sys.exit(1)

    size = model_path.stat().st_size
    log(f"  Downloaded: {onnx_file} ({human_size(size)})")
    return model_path


def step_verify(model_path: Path) -> bool:
    """Verify ONNX model loads and produces valid output."""
    log(f"\n[2/5] Verifying {model_path.name}")

    import onnxruntime as ort

    try:
        session = ort.InferenceSession(str(model_path))
        inputs = session.get_inputs()
        outputs = session.get_outputs()

        log(f"  Inputs:  {[inp.name for inp in inputs]}")
        log(f"  Outputs: {[out.name for out in outputs]}")

        # GLiNER-specific dummy inputs for validation
        # num_spans must equal seq_len * max_width (default max_width=12)
        batch, seq_len, max_width = 1, 16, 12
        num_spans = seq_len * max_width

        # Build valid span indices: (start, end) pairs within seq_len
        span_idx = np.zeros((batch, num_spans, 2), dtype=np.int64)
        for i in range(seq_len):
            for w in range(max_width):
                idx = i * max_width + w
                span_idx[0, idx, 0] = i
                span_idx[0, idx, 1] = min(i + w, seq_len - 1)

        feed = {
            "input_ids": np.zeros((batch, seq_len), dtype=np.int64),
            "attention_mask": np.ones((batch, seq_len), dtype=np.int64),
            "words_mask": np.ones((batch, seq_len), dtype=np.int64),
            "text_lengths": np.array([[seq_len]], dtype=np.int64),
            "span_idx": span_idx,
            "span_mask": np.ones((batch, num_spans), dtype=np.bool_),
        }

        for name, arr in feed.items():
            log(f"    {name}: shape={arr.shape} dtype={arr.dtype}")

        result = session.run(None, feed)
        log(f"  Inference OK — output shape: {result[0].shape}")
        log("  PASS")
        return True
    except Exception as e:
        log(f"  FAIL: {e}")
        return False


def step_upload(work_dir: Path, model_path: Path, model_cfg: dict, digest: str) -> str:
    """Upload to HuggingFace with model card."""
    repo_id = f"{HF_ORG}/{model_cfg['target_repo_suffix']}"
    log(f"\n[3/5] Uploading to {repo_id}")

    token = os.environ.get("HF_TOKEN")
    if not token:
        log("  ERROR: HF_TOKEN environment variable not set")
        sys.exit(1)

    from huggingface_hub import HfApi

    api = HfApi(token=token)
    api.create_repo(repo_id, exist_ok=True)

    # Prepare upload directory
    upload_dir = work_dir / "upload"
    if upload_dir.exists():
        shutil.rmtree(upload_dir)
    upload_dir.mkdir()

    snapshot_dir = work_dir / "snapshot"

    # Copy ONNX file(s)
    onnx_src = snapshot_dir / "onnx"
    if onnx_src.exists():
        shutil.copytree(onnx_src, upload_dir / "onnx")
    else:
        dest = upload_dir / "onnx" / model_path.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(model_path, dest)

    # Copy config/tokenizer files
    for pattern in ("*.json", "*.txt", "*.model"):
        for f in snapshot_dir.glob(pattern):
            if f.name not in ("README.md",):
                shutil.copy2(f, upload_dir / f.name)

    # Write model card
    size = model_path.stat().st_size
    readme = upload_dir / "README.md"
    readme.write_text(f"""---
base_model: {model_cfg['source_repo']}
library_name: onnxruntime
license: {model_cfg['license']}
tags:
  - gliner
  - onnx
  - int8
  - mirrored
---

# {model_cfg['source_repo']} — ONNX (Mirrored)

Supply-chain-safe mirror of [{model_cfg['source_repo']}](https://huggingface.co/{model_cfg['source_repo']}).

| Property | Value |
|----------|-------|
| Source | [{model_cfg['source_repo']}](https://huggingface.co/{model_cfg['source_repo']}) |
| Format | ONNX INT8 |
| File | `{model_cfg['onnx_file']}` |
| Size | {human_size(size)} ({size} bytes) |
| SHA-256 | `{digest}` |

## Verification

Model was loaded with ONNX Runtime, input/output schema validated,
and dummy inference executed before upload.

```bash
# Re-verify
cd packages/ink-veil
yarn model:convert --skip-upload
```
""")

    api.upload_folder(
        folder_path=str(upload_dir),
        repo_id=repo_id,
        commit_message=f"Mirror from {model_cfg['source_repo']} (SHA-256: {digest[:16]}...)",
    )

    url = f"https://huggingface.co/{repo_id}/resolve/main/{model_cfg['onnx_file']}"
    log(f"  Uploaded: {url}")
    return url


def step_post_upload_verify(url: str, expected_sha: str) -> bool:
    """Re-download from HF URL and verify SHA-256 matches."""
    log(f"\n[4/5] Post-upload verification")
    log(f"  Re-downloading from: {url}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".onnx") as tmp:
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ["curl", "-L", "-f", "-o", tmp_path, url],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            log(f"  Download failed: {result.stderr}")
            return False

        actual_sha = sha256_file(Path(tmp_path))
        if actual_sha != expected_sha:
            log(f"  SHA MISMATCH!")
            log(f"  Expected: {expected_sha}")
            log(f"  Actual:   {actual_sha}")
            return False

        log(f"  SHA-256 verified: {actual_sha}")
        log("  PASS")
        return True
    finally:
        Path(tmp_path).unlink(missing_ok=True)


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-upload", action="store_true")
    args = parser.parse_args()

    skip_upload = args.skip_upload or os.environ.get("SKIP_UPLOAD") == "1"

    results = []

    for cfg in MODELS:
        work_dir = Path("/workspace/output") / cfg["id"]
        work_dir.mkdir(parents=True, exist_ok=True)

        log(f"\n{'='*60}")
        log(f"  {cfg['id']} (mirror from {cfg['source_repo']})")
        log(f"{'='*60}")

        # [1] Download
        model_path = step_download(cfg["source_repo"], cfg["onnx_file"], work_dir)

        # [2] Verify
        if not step_verify(model_path):
            log("\nABORTED: Verification failed")
            sys.exit(1)

        # [3] SHA-256
        digest = sha256_file(model_path)
        size = model_path.stat().st_size
        log(f"\n  SHA-256: {digest}")
        log(f"  Size:   {human_size(size)} ({size} bytes)")

        # Determine URL
        repo_id = f"{HF_ORG}/{cfg['target_repo_suffix']}"
        url = f"https://huggingface.co/{repo_id}/resolve/main/{cfg['onnx_file']}"

        # [3/4] Upload + post-verify
        if not skip_upload:
            url = step_upload(work_dir, model_path, cfg, digest)

            if not step_post_upload_verify(url, digest):
                log("\nABORTED: Post-upload verification failed")
                sys.exit(1)
        else:
            log("\n[3/5] Upload skipped (--skip-upload)")
            log("[4/5] Post-upload verification skipped")

        # [5] Result
        log(f"\n[5/5] Result")
        entry = {
            "model_id": cfg["id"],
            "url": url,
            "sha256": digest,
            "sizeBytes": size,
            "verified": True,
        }
        results.append(entry)
        log(f"  {json.dumps(entry, indent=2)}")

    # Final JSON to stdout (only valid JSON goes to stdout)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
