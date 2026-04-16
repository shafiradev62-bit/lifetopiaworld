import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || "3001");
// Capacitor requires "./" as base so asset paths are relative inside the APK WebView
const isCapacitor = process.env.CAPACITOR_BUILD === "1";
const basePath = isCapacitor ? "./" : (process.env.BASE_PATH || "/");

export default defineConfig(async () => {
  const plugins = [
    react(),
    tailwindcss(),
  ];

  // Only load Replit dev plugins in Replit dev environment
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      const { default: runtimeErrorOverlay } = await import("@replit/vite-plugin-runtime-error-modal");
      plugins.push(runtimeErrorOverlay());
      const { cartographer } = await import("@replit/vite-plugin-cartographer");
      plugins.push(cartographer({ root: path.resolve(import.meta.dirname, "..") }));
      const { devBanner } = await import("@replit/vite-plugin-dev-banner");
      plugins.push(devBanner());
    } catch { /* not in Replit, skip */ }
  }

  return {
    base: basePath,
    define: {
      "global": "globalThis",
    },
    optimizeDeps: {
      include: ["buffer"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      // Ensure assets are bundled correctly for Capacitor
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // Avoid hashed filenames causing issues with Capacitor asset resolution
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
