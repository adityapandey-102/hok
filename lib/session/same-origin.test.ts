import { describe, expect, it } from "vitest";
import { rejectCrossSite } from "./same-origin";

const post = (headers: Record<string, string>) => new Request("http://localhost:3400/api/session/establish", { method: "POST", headers });

describe("rejectCrossSite (session route CSRF guard)", () => {
  it("lets the app's own JSON requests through", () => {
    expect(rejectCrossSite(post({ "content-type": "application/json", "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(rejectCrossSite(post({ "content-type": "application/json; charset=utf-8" }))).toBeNull(); // older browser, no Sec-Fetch-Site
  });

  it("refuses what a form on another site can send", () => {
    expect(rejectCrossSite(post({ "content-type": "text/plain" }))?.status).toBe(403);
    expect(rejectCrossSite(post({ "content-type": "application/x-www-form-urlencoded" }))?.status).toBe(403);
    expect(rejectCrossSite(post({}))?.status).toBe(403);
  });

  it("refuses JSON that the browser says came from elsewhere", () => {
    expect(rejectCrossSite(post({ "content-type": "application/json", "sec-fetch-site": "cross-site" }))?.status).toBe(403);
    expect(rejectCrossSite(post({ "content-type": "application/json", "sec-fetch-site": "same-site" }))?.status).toBe(403);
  });
});
