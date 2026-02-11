import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    outExtension({ format }) {
      return { js: format === "esm" ? ".mjs" : ".cjs" };
    },
    splitting: false,
    sourcemap: false,
    target: "node20",
    platform: "node",
    clean: true,
    dts: false,
    loader: { ".tsx": "tsx" },
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    outExtension() {
      return { js: ".mjs" };
    },
    splitting: false,
    sourcemap: false,
    target: "node20",
    platform: "node",
    clean: false,
    dts: false,
    banner: { js: "#!/usr/bin/env node" },
    loader: { ".tsx": "tsx" },
  },
]);
