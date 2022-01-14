import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import inject from "@rollup/plugin-inject";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), inject({ Buffer: ["buffer", "Buffer"] })],
  define: {
    global: {},
    "process.env.NODE_DEBUG": JSON.stringify(""),
  },
  optimizeDeps: {
    include: ["buffer"],
  },
});
