import { describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { WebPushSender } from "./web-push.sender";

describe("WebPushSender", () => {
  it("never sends to a stored endpoint that is not a browser push service (security audit run 1)", async () => {
    const spy = vi.spyOn(webpush, "sendNotification");
    const sender = new WebPushSender({ publicKey: "pub", privateKey: "priv", subject: "mailto:test@example.com" });
    const message = { title: "t", body: "b", url: "/app", tag: "test" };
    for (const endpoint of ["https://evil.test\t.fcm.googleapis.com/fcm/send/x", "https://169.254.169.254/latest"]) {
      expect(await sender.send({ endpoint, p256dh: "p", auth: "a" }, message)).toBe("failed");
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
