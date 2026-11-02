// Remotion entry point. Deployed to AWS as the "framatic" site by
// .github/workflows/deploy-video-renderer.yml and rendered by Remotion Lambda.
import { registerRoot } from "remotion";
import "@fontsource-variable/space-grotesk";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
