import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "monadyssey",
      fileName: (format) => `monadyssey.${format}.js`,
      formats: ["es", "cjs", "umd"],
    },
    outDir: "dist",
    sourcemap: true, // Optional: Useful for debugging
  },
  plugins: [
    dts({
      staticImport: true,
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],
});
