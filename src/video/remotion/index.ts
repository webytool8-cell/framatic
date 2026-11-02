// Remotion entry point. Bundled into the renderer image (renderer/Dockerfile),
// deployed as a Google Cloud Run Job by .github/workflows/deploy-video-renderer.yml.
import { registerRoot } from "remotion";
import "@fontsource-variable/space-grotesk";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
