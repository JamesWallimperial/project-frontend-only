import { defineConfig } from "vite";

export default defineConfig({
  base: "/project-frontend-only/",
  build: { outDir: "dist", emptyOutDir: true },
});
