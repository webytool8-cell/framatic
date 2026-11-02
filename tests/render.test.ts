import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describeRenderError, isRenderConfigured, resolveRenderTarget } from "@/lib/render/lambda";

describe("MP4 export configuration", () => {
  it("reports clearly when AWS isn't set up", async () => {
    delete process.env.REMOTION_AWS_ACCESS_KEY_ID;
    expect(isRenderConfigured()).toBe(false);
    await expect(resolveRenderTarget()).rejects.toMatchObject({ name: "RenderNotConfiguredError" });
  });

  it("uses explicit function/site overrides without calling AWS", async () => {
    process.env.REMOTION_AWS_ACCESS_KEY_ID = "AKIA_TEST";
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY = "secret";
    process.env.FRAMATIC_REMOTION_FUNCTION_NAME = "remotion-render-test";
    process.env.FRAMATIC_REMOTION_SERVE_URL = "https://example.s3.amazonaws.com/sites/framatic/index.html";
    await expect(resolveRenderTarget()).resolves.toEqual(expect.objectContaining({ functionName: "remotion-render-test" }));
    delete process.env.REMOTION_AWS_ACCESS_KEY_ID;
  });

  it("explains AWS failures", () => {
    expect(describeRenderError(new Error("The security token included in the request is invalid. InvalidClientTokenId"))).toMatch(/rejected the access keys/);
    expect(describeRenderError(new Error("AccessDeniedException: not authorized to perform lambda:InvokeFunction"))).toMatch(/permissions/);
    expect(describeRenderError(new Error("Rate Exceeded"))).toMatch(/busy/);
  });
});
