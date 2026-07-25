import { defineConfig } from "rolldown";

import { nodeBundle } from "../../scripts/rolldown-preset.js";

/** Loaded by `rolldown -c rolldown.config.ts` from the `build` script. */
export default defineConfig([
  nodeBundle({
    input: { index: "src/index.ts" },
    formats: ["esm", "cjs"],
    clean: true,
  }),
  // Subpath export `@lumy-pack/ink-veil/transform`; the `/` in the entry name
  // places the chunk at dist/transform/index.*.
  nodeBundle({
    input: { "transform/index": "src/transform/index.ts" },
    formats: ["esm", "cjs"],
  }),
  // src/cli.ts already carries a shebang, so none is injected here.
  nodeBundle({
    input: { cli: "src/cli.ts" },
    shebang: "preserve",
  }),
]);
