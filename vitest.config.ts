import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    // No network in unit tests: skip downloading product photos and generating AI images.
    env: { FRAMATIC_PHOTO_IMPORT: "off", FRAMATIC_AI_PHOTOS: "off" },
  },
});
