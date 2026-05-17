import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, type UserConfig } from "vite";

type VitestConfig = UserConfig & {
  test: {
    environment: "jsdom";
    globals: true;
  };
};

const config = {
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        options: resolve(__dirname, "options.html"),
        serviceWorker: resolve(__dirname, "src/background/serviceWorker.ts"),
        contentScript: resolve(__dirname, "src/content/contentScript.ts")
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "serviceWorker") return "serviceWorker.js";
          if (chunk.name === "contentScript") return "contentScript.js";
          return "assets/[name]-[hash].js";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
} satisfies VitestConfig;

export default defineConfig(config);
