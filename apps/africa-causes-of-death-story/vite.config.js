import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// `base` is the public URL prefix. The site deploys to
// bk-advisors.github.io/africa-causes-of-death/, so all built asset URLs
// need to be prefixed accordingly. In dev (`vite`) the base is "/".
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/africa-causes-of-death/" : "/",
  plugins: [svelte()],
  server: { port: 5173, strictPort: false },
}));
