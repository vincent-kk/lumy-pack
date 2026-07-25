import { chmod } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * Shared rolldown options factory for the Node CLI packages in this monorepo.
 *
 * Consumed by `packages/<pkg>/rolldown.config.ts`; those configs only declare
 * entries and call this. Dependency data is read from `<cwd>/package.json`,
 * because `rolldown -c` runs with the package directory as cwd — the same base
 * the relative `input` paths resolve against.
 *
 * Declaration files are NOT produced here; each package emits them with
 * `tsc -p tsconfig.declarations.json`.
 */

const SHEBANG = "#!/usr/bin/env node";

/** Mode 755 — npm marks `bin` targets executable, and the tsup build did too. */
const EXECUTABLE = 0o755;

const require = createRequire(import.meta.url);

/** @returns {string[]} runtime dependency names of the package being built */
const readDependencyNames = (cwd) => {
  const { dependencies = {}, peerDependencies = {} } = require(
    join(cwd, "package.json"),
  );
  return [...Object.keys(dependencies), ...Object.keys(peerDependencies)];
};

/** Matches a bare specifier and its subpaths: `ink` and `ink/foo`, not `inkwell`. */
const matches = (names, id) =>
  names.some((name) => id === name || id.startsWith(`${name}/`));

/**
 * Marks the emitted entry chunks executable. rolldown has no chmod option, so
 * this runs after the files land on disk.
 *
 * @param {string} outDir
 * @returns {import('rolldown').Plugin}
 */
const executableEntries = (outDir) => ({
  name: "lumy-pack:executable-entries",
  async writeBundle(options, bundle) {
    const dir = options.dir ?? outDir;
    await Promise.all(
      Object.values(bundle)
        .filter((chunk) => chunk.type === "chunk" && chunk.isEntry)
        .map((chunk) => chmod(join(dir, chunk.fileName), EXECUTABLE)),
    );
  },
});

/**
 * @typedef {object} NodeBundleOptions
 * @property {Record<string, string>} input Entry name to source path, relative to the package root.
 * @property {('esm' | 'cjs')[]} [formats] Output formats; defaults to `['esm']`.
 * @property {boolean} [clean] Wipe `dist` before emitting. Only the first entry of a config should set this.
 * @property {'banner' | 'preserve'} [shebang] `banner` injects the shebang; `preserve` keeps the one already in the source. Both mark the output executable.
 * @property {string[]} [inline] Workspace packages to bundle in rather than leave external.
 * @property {string} [outDir] Output directory; defaults to `dist`.
 */

/**
 * Builds one rolldown config: a single Node-targeted bundle per requested format.
 *
 * @param {NodeBundleOptions} options
 * @returns {import('rolldown').RolldownOptions}
 */
export const nodeBundle = ({
  input,
  formats = ["esm"],
  clean = false,
  shebang,
  inline = [],
  outDir = "dist",
}) => {
  const cwd = process.cwd();
  const external = readDependencyNames(cwd).filter(
    (name) => !inline.includes(name),
  );

  const output = formats.map((format, index) => ({
    dir: outDir,
    format,
    entryFileNames: format === "esm" ? "[name].mjs" : "[name].cjs",
    sourcemap: false,
    minify: false,
    codeSplitting: false,
    // cleanDir on the first output only; a later one would erase its siblings.
    cleanDir: clean && index === 0,
    ...(shebang === "banner" ? { banner: SHEBANG } : {}),
  }));

  return {
    input,
    platform: "node",
    transform: { target: "node20" },
    external: (id) => !matches(inline, id) && matches(external, id),
    plugins: shebang ? [executableEntries(outDir)] : [],
    output: output.length === 1 ? output[0] : output,
  };
};
