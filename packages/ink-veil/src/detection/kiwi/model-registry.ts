export interface ModelEntry {
  url: string;
  sha256: string;
  /** Approximate download size for user-facing messages. */
  sizeLabel: string;
  /** Number of path components to strip when extracting (tar --strip-components). */
  stripComponents: number;
}

/**
 * Kiwi model registry.
 *
 * To add or update a model:
 *   1. Compute SHA256: `curl -sL <url> | shasum -a 256`
 *   2. Add/update the entry below.
 */
export const MODEL_REGISTRY: Record<string, ModelEntry> = {
  "kiwi-base": {
    url: "https://github.com/bab2min/Kiwi/releases/download/v0.22.2/kiwi_model_v0.22.2_base.tgz",
    sha256: "aa11a6e5b06c7db43e9b07148620f5fb7838a30172dacb40f75202333110f2d1",
    sizeLabel: "~16MB",
    stripComponents: 2,
  },
};
