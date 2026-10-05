import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Compila as ilhas React para ../public/ilhas (arquivos fixos, sem hash: o HTML aponta direto para eles)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "../public/ilhas",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: "src/ilhas.tsx", formats: ["iife"], name: "Ilhas", fileName: () => "ilhas.js" },
    rollupOptions: { output: { assetFileNames: "ilhas[extname]" } },
  },
})
