import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildRunRequest, describeRenderError, isRenderConfigured, parseServiceAccountKey } from "@/lib/render/cloudrun";

const key = { client_email: "renderer@proj.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" };

describe("MP4 export on Cloud Run", () => {
  it("is off until the Google Cloud settings exist", () => {
    delete process.env.GCP_PROJECT_ID;
    expect(isRenderConfigured()).toBe(false);
    process.env.GCP_PROJECT_ID = "proj";
    process.env.GCP_SERVICE_ACCOUNT_KEY = JSON.stringify(key);
    expect(isRenderConfigured()).toBe(true);
    delete process.env.GCP_PROJECT_ID;
  });

  it("accepts the key as raw JSON or base64", () => {
    expect(parseServiceAccountKey(JSON.stringify(key)).client_email).toBe(key.client_email);
    expect(parseServiceAccountKey(Buffer.from(JSON.stringify(key)).toString("base64")).private_key).toContain("PRIVATE KEY");
    expect(() => parseServiceAccountKey("nope")).toThrow(/valid JSON/);
  });

  it("passes the render payload to the job as a base64 env var", () => {
    const body = buildRunRequest({ renderId: "r1", userId: "u1", fileName: "ad.mp4", props: { plan: { scenes: [] } as never } });
    const env = body.overrides.containerOverrides[0].env[0];
    expect(env.name).toBe("RENDER_PAYLOAD");
    expect(JSON.parse(Buffer.from(env.value, "base64").toString())).toMatchObject({ renderId: "r1", userId: "u1" });
  });

  it("explains Google Cloud failures", () => {
    expect(describeRenderError({ response: { status: 404 }, message: "Resource not found" })).toMatch(/Deploy video renderer/);
    expect(describeRenderError({ response: { status: 403 }, message: "Permission denied" })).toMatch(/Cloud Run Developer/);
    expect(describeRenderError({ message: "invalid_grant: Invalid JWT Signature." })).toMatch(/rejected the service-account key/);
  });
});
