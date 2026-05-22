import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/electron",
      lib: { entry: resolve(__dirname, "src/main/main.ts") },
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
        "@agents": resolve(__dirname, "src/agents"),
        "@skills": resolve(__dirname, "src/skills"),
        "@workflow": resolve(__dirname, "src/workflow"),
        "@browser": resolve(__dirname, "src/browser"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      lib: { entry: resolve(__dirname, "src/main/preload.ts") },
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    build: {
      outDir: "dist/renderer",
      rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") },
    },
    resolve: {
      alias: { "@shared": resolve(__dirname, "src/shared") },
    },
  },
});
