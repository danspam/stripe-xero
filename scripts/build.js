/**
 * Bundles the tool and its runtime dependencies into a single file,
 * dist/stripe-xero.mjs, which can be copied to the server and run with
 * `node stripe-xero.mjs --dir <path>`. No npm install is needed there.
 *
 * Run with `npm run build`, which lints and tests first.
 */
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outfile = join(root, "dist", "stripe-xero.mjs");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

await rm(join(root, "dist"), { recursive: true, force: true });

const result = await build({
    entryPoints: [join(root, "index.js")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    // The oldest Node version the server runs.
    target: "node22.0",
    metafile: true,
    logLevel: "warning",
    banner: {
        js: [
            `// ${pkg.name} ${pkg.version}, built ${new Date().toISOString()}`,
            // Bundled CommonJS dependencies call require() for Node built-ins,
            // which an ES module doesn't have, so provide one.
            `import { createRequire as __createRequire } from "node:module";`,
            `const require = __createRequire(import.meta.url);`
        ].join("\n")
    }
});

const { bytes } = result.metafile.outputs[Object.keys(result.metafile.outputs)[0]];
process.stdout.write(`Built ${outfile} (${(bytes / 1024).toFixed(0)} KB)\n`);
