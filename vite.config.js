import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/signspeak/",
  build: {
    chunkSizeWarningLimit: 1500, // TensorFlow is naturally large
  },
});