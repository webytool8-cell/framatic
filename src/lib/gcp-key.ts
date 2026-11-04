/** Google Cloud service-account key handling, shared by rendering and AI photos. */
export class GcpKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderNotConfiguredError";
  }
}

/** Accepts the service-account key as raw JSON or base64-encoded JSON. */
export function parseServiceAccountKey(raw: string): { client_email: string; private_key: string } {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  let json: { client_email?: string; private_key?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new GcpKeyError("GCP_SERVICE_ACCOUNT_KEY isn't valid JSON. Paste the whole key file (or its base64).");
  }
  if (!json.client_email || !json.private_key) throw new GcpKeyError("GCP_SERVICE_ACCOUNT_KEY is missing client_email or private_key.");
  return { client_email: json.client_email, private_key: json.private_key };
}

