import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@trenches/cnft-shared": path.join(repoRoot, "src/cnft-visual-shared.ts"),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  optimizeDeps: {
    include: ["buffer", "@solana/web3.js", "bs58"],
  },
});
