import path from "node:path";
import { Config } from "@remotion/cli/config";

// Resolve the app's "@/..." imports when bundling the video for Lambda.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), "@": path.join(process.cwd(), "src") },
  },
}));
Config.setVideoImageFormat("jpeg");
