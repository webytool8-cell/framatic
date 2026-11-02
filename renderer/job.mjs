// Framatic render job — runs as a Google Cloud Run Job execution.
//
// Input (env):
//   RENDER_PAYLOAD  base64 JSON { renderId, userId, fileName, props }
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   BUNDLE_DIR      prebuilt Remotion bundle (built into the image)
// Output: MP4 uploaded to Supabase Storage bucket "renders" at
//   <userId>/<renderId>.mp4 and the renders row updated with progress/status.
import { readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUNDLE_DIR = process.env.BUNDLE_DIR || path.resolve("bundle");
const BUCKET = "renders";

function log(level, msg, data = {}) {
  console.log(JSON.stringify({ severity: level, message: msg, ...data }));
}

async function patchRender(id, userId, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/renders?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) log("WARNING", "could not update render row", { status: res.status, body: (await res.text()).slice(0, 300) });
}

async function upload(objectPath, filePath, fileName) {
  const body = await readFile(filePath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "video/mp4",
      "x-upsert": "true",
      "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
    },
    body,
  });
  if (!res.ok) throw new Error(`upload failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return body.byteLength;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  const raw = process.env.RENDER_PAYLOAD;
  if (!raw) throw new Error("RENDER_PAYLOAD is missing");
  const { renderId, userId, fileName, props } = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  if (!renderId || !userId || !props?.plan) throw new Error("RENDER_PAYLOAD is incomplete");

  const started = Date.now();
  const out = `/tmp/${renderId}.mp4`;
  log("INFO", "render started", { renderId });
  try {
    const composition = await selectComposition({ serveUrl: BUNDLE_DIR, id: "AdVideo", inputProps: props, browserExecutable: process.env.BROWSER_EXECUTABLE || null });
    let last = 0;
    await renderMedia({
      composition,
      serveUrl: BUNDLE_DIR,
      codec: "h264",
      outputLocation: out,
      inputProps: props,
      imageFormat: "jpeg",
      jpegQuality: 90,
      browserExecutable: process.env.BROWSER_EXECUTABLE || null,
      chromiumOptions: { gl: "swangle" },
      onProgress: ({ progress }) => {
        // Throttle row updates to ~every 8%.
        if (progress - last >= 0.08) {
          last = progress;
          void patchRender(renderId, userId, { progress: Math.min(0.95, progress * 0.95) });
        }
      },
    });
    const size = await upload(`${userId}/${renderId}.mp4`, out, fileName || "framatic-ad.mp4");
    await patchRender(renderId, userId, { status: "done", progress: 1, out_key: `${userId}/${renderId}.mp4`, out_size_bytes: size, error: null });
    log("INFO", "render finished", { renderId, ms: Date.now() - started, bytes: size });
  } catch (e) {
    log("ERROR", "render failed", { renderId, error: String(e?.stack || e) });
    await patchRender(renderId, userId, { status: "failed", error: "The render failed. Please try again." });
    process.exitCode = 1;
  } finally {
    await unlink(out).catch(() => {});
    await stat(out).catch(() => null);
  }
}

main().catch((e) => {
  log("ERROR", "job crashed", { error: String(e?.stack || e) });
  process.exitCode = 1;
});
