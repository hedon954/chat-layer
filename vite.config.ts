import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(rootDirectory, "src/background/index.ts"),
        content: resolve(rootDirectory, "src/content/index.ts"),
        sandbox: resolve(rootDirectory, "src/sandbox/mermaid.ts"),
        options: resolve(rootDirectory, "src/options/index.ts"),
        viewer: resolve(rootDirectory, "src/viewer/index.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
