const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log(
        `[watch] build finished - Output: ${
          result.outputFiles?.length || 1
        } file(s)`
      );
    });
  },
};

/**
 * Plugin to analyze bundle size and warn about large dependencies
 */
const bundleAnalyzerPlugin = {
  name: "bundle-analyzer",
  setup(build) {
    build.onEnd((result) => {
      if (production && result.outputFiles) {
        const mainOutput = result.outputFiles.find((f) =>
          f.path.endsWith("extension.js")
        );
        if (mainOutput) {
          const sizeKB = Math.round(mainOutput.contents.length / 1024);
          console.log(`📦 Bundle size: ${sizeKB} KB`);
          if (sizeKB > 2000) {
            console.warn(
              `⚠️  Large bundle detected (${sizeKB} KB). Consider optimizing dependencies.`
            );
          }
        }
      }
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    target: "node16",
    outfile: "dist/extension.js",
    external: [
      "vscode",
      // Add any other external dependencies that should not be bundled
    ],
    logLevel: "silent",
    // More aggressive tree shaking
    treeShaking: true,
    // Optimize for size in production
    ...(production && {
      drop: ["console", "debugger"],
      legalComments: "none",
    }),
    // Define globals to help with bundling
    define: {
      "process.env.NODE_ENV": production ? '"production"' : '"development"',
    },
    plugins: [
      // Bundle analyzer should come first
      bundleAnalyzerPlugin,
      // Problem matcher should be last
      esbuildProblemMatcherPlugin,
    ],
    // Resolve configuration for better tree shaking
    mainFields: ["module", "main"],
    conditions: ["import", "module", "require", "default"],
  });

  if (watch) {
    await ctx.watch();
    console.log("👀 Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("✅ Build completed");
  }
}

main().catch((e) => {
  console.error("❌ Build failed:", e);
  process.exit(1);
});
