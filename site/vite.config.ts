import { defineConfig } from "vite";

// The page imports the app's real renderer from ../app/src, so the bots here are the bots in the app.
export default defineConfig({
  base: "./",
  server: { fs: { allow: [".."] } },
});
