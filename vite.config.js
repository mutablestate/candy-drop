import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import nodePolyfills from "rollup-plugin-polyfill-node";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), nodePolyfills()],
  define: {
    "process.env.NODE_DEBUG": JSON.stringify(""),
  },
  optimizeDeps: {
    exclude: [],
  },
  build: {
    rollupOptions: {
      external: [
        "@solana/web3.js",
        "@solana/wallet-adapter-base",
        "@project-serum/anchor",
      ],
    },
  },
});
