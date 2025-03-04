import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  outDir: "dist",
  format: ["cjs", "esm"],
  external: ["react", "next"],
});
