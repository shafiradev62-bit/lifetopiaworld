import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/game/**/*.ts", "src/game/**/*.tsx"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
  },
  define: {
    "import.meta.env": {
      VITE_ALCHEMY_API_KEY: "JiVbTwHnF3qEGfs5AtgKR",
      VITE_LIFETOPIA_ALPHA_MINT: "CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT",
      VITE_TOKEN_MINT_ADDRESS: "CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT",
      VITE_WALLET_DAPP_URL: "https://test-lifetopia.example.com",
    },
    global: "globalThis",
  },
});
