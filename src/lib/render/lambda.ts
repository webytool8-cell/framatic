import "server-only";
import { getFunctions, getRenderProgress, getSites, presignUrl, renderMediaOnLambda, type AwsRegion } from "@remotion/lambda/client";
import type { AdVideoProps } from "@/video/AdVideo";
import { log } from "@/lib/log";

/**
 * MP4 export through Remotion Lambda. The Lambda function and the bundled
 * video site are deployed by .github/workflows/deploy-video-renderer.yml;
 * the app discovers them automatically unless overridden by env vars.
 */
export const SITE_NAME = "framatic";

export class RenderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderNotConfiguredError";
  }
}

export function renderRegion(): AwsRegion {
  return (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
}

export function isRenderConfigured(): boolean {
  return !!process.env.REMOTION_AWS_ACCESS_KEY_ID && !!process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
}

let cached: { functionName: string; serveUrl: string; at: number } | null = null;

/** Find the deployed Lambda function and video site (cached for 10 minutes). */
export async function resolveRenderTarget(): Promise<{ functionName: string; serveUrl: string }> {
  if (!isRenderConfigured()) {
    throw new RenderNotConfiguredError("Video export isn't set up yet: add the REMOTION_AWS_* keys in Vercel.");
  }
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached;
  const region = renderRegion();
  let functionName = process.env.FRAMATIC_REMOTION_FUNCTION_NAME;
  let serveUrl = process.env.FRAMATIC_REMOTION_SERVE_URL;
  if (!functionName) {
    const fns = await getFunctions({ region, compatibleOnly: true });
    functionName = fns[0]?.functionName;
  }
  if (!serveUrl) {
    const { sites } = await getSites({ region });
    serveUrl = sites.find((s) => s.id === SITE_NAME)?.serveUrl;
  }
  if (!functionName || !serveUrl) {
    throw new RenderNotConfiguredError(
      `The video renderer isn't deployed in ${region} yet. Run the "Deploy video renderer" action on GitHub, then try again.`,
    );
  }
  cached = { functionName, serveUrl, at: Date.now() };
  return cached;
}

export async function startLambdaRender(props: AdVideoProps, fileName: string) {
  const { functionName, serveUrl } = await resolveRenderTarget();
  const res = await renderMediaOnLambda({
    region: renderRegion(),
    functionName,
    serveUrl,
    composition: "AdVideo",
    inputProps: props,
    codec: "h264",
    imageFormat: "jpeg",
    jpegQuality: 90,
    privacy: "private",
    maxRetries: 2,
    downloadBehavior: { type: "download", fileName },
    // Short ads: fewer, larger chunks keep Lambda concurrency low.
    framesPerLambda: 120,
  });
  return { renderId: res.renderId, bucketName: res.bucketName };
}

export interface RenderStatus {
  done: boolean;
  failed: boolean;
  progress: number;
  outKey: string | null;
  sizeBytes: number | null;
  costUsd: number | null;
  error: string | null;
}

export async function lambdaRenderStatus(renderId: string, bucketName: string): Promise<RenderStatus> {
  const { functionName } = await resolveRenderTarget();
  const p = await getRenderProgress({ renderId, bucketName, functionName, region: renderRegion() });
  const fatal = p.fatalErrorEncountered;
  if (fatal) log.error("lambda render failed", { renderId, errors: p.errors.slice(0, 3).map((e) => e.message) });
  return {
    done: p.done,
    failed: fatal,
    progress: Math.max(0, Math.min(1, p.overallProgress ?? 0)),
    outKey: p.outKey ?? null,
    sizeBytes: p.outputSizeInBytes ?? null,
    costUsd: p.costs?.accruedSoFar ?? null,
    error: fatal ? "The render failed. Please try again." : null,
  };
}

export async function downloadUrl(bucketName: string, outKey: string): Promise<string> {
  return presignUrl({ region: renderRegion(), bucketName, objectKey: outKey, expiresInSeconds: 60 * 60, checkIfObjectExists: false });
}

/** Friendly text for AWS / Remotion failures. */
export function describeRenderError(e: unknown): string {
  const err = e as { name?: string; message?: string };
  if (err?.name === "RenderNotConfiguredError") return err.message ?? "Video export isn't set up yet.";
  const m = err?.message ?? "";
  if (/InvalidClientTokenId|SignatureDoesNotMatch|UnrecognizedClient|security token/i.test(m)) return "AWS rejected the access keys. Check REMOTION_AWS_ACCESS_KEY_ID and REMOTION_AWS_SECRET_ACCESS_KEY in Vercel.";
  if (/AccessDenied|not authorized/i.test(m)) return "The AWS user doesn't have the Remotion permissions yet. Attach the policy from docs/aws/remotion-user-policy.json.";
  if (/TooManyRequests|Rate Exceeded|concurrency/i.test(m)) return "AWS is busy with other renders. Try again in a minute.";
  return "We couldn't start the export. Please try again.";
}
