import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

const base = process.env.VERCEL ? "/" : (process.env.VITE_BASE_PATH || "/signspeak/");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base,
  build: {
    chunkSizeWarningLimit: 1500, // TensorFlow is naturally large
  },
});
