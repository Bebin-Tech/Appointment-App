import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  ...(mode === "connected"
    ? { define: { "import.meta.env.VITE_CONNECTED_ONLY": '"true"' } }
    : {}),
  ...(mode === "demo"
    ? { define: { "import.meta.env.VITE_DEMO_ONLY": '"true"' } }
    : {}),
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  build: { target: "es2022" },
}));
