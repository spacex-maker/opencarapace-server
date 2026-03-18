import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  base: "./", // 使用相对路径，适配 Electron file:// 协议
  server: {
    port: 5199,
  },
  build: {
    outDir: "dist",
  },
});

