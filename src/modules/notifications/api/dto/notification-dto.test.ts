import { describe, expect, it } from "vitest";
import { notificationQueryDtoSchema, pushSubscriptionDtoSchema, updatePreferencesDtoSchema } from "./notification.dto";
import { createPushSender } from "../../infrastructure/web-push.sender";

const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNcR_x-1", auth: "tBHI-tw" } };

describe("notification DTOs", () => {
  it("clamps the page size and reads unread=true", () => {
    expect(notificationQueryDtoSchema.parse({ limit: "1000", unread: "true" })).toEqual({ limit: 50, offset: 0, unread: true });
    expect(notificationQueryDtoSchema.parse({})).toEqual({ limit: 20, offset: 0, unread: false });
  });

  it("accepts a browser's PushSubscription JSON and drops expirationTime", () => {
    expect(pushSubscriptionDtoSchema.parse({ ...SUB, expirationTime: null, userAgent: "  " })).toEqual({ ...SUB, userAgent: null });
  });

  it("refuses a non-https endpoint or malformed keys", () => {
    expect(pushSubscriptionDtoSchema.safeParse({ ...SUB, endpoint: "http://push.test/x" }).success).toBe(false);
    // Only the browsers' push services: anything else would make the API call an address of the user's choosing.
    for (const bad of ["https://169.254.169.254/latest", "https://localhost/x", "https://fcm.googleapis.com.evil.test/x", "https://evilfcm.googleapis.com/x"]) {
      expect(pushSubscriptionDtoSchema.safeParse({ ...SUB, endpoint: bad }).success, bad).toBe(false);
    }
    for (const ok of ["https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/x", "https://wns2-par02p.notify.windows.com/w/?token=x"]) {
      expect(pushSubscriptionDtoSchema.safeParse({ ...SUB, endpoint: ok }).success, ok).toBe(true);
    }
    // Parser-differential tricks (security audit run 1): the allow-list's WHATWG parse drops these
    // characters, but web-push's legacy url.parse ends the host at them and would connect to "evil.test".
    for (const ch of ["\t", "\n", "\r", " ", "\\", "\u0000", "\u007f"]) {
      const bad = `https://evil.test${ch}.fcm.googleapis.com/fcm/send/x`;
      expect(pushSubscriptionDtoSchema.safeParse({ ...SUB, endpoint: bad }).success, JSON.stringify(bad)).toBe(false);
    }
    // What is stored is the canonical form that was checked.
    const parsed = pushSubscriptionDtoSchema.safeParse({ ...SUB, endpoint: "https://FCM.googleapis.com/fcm/send/abc" });
    expect(parsed.success && parsed.data.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(pushSubscriptionDtoSchema.safeParse({ ...SUB, keys: { p256dh: "not base64!", auth: "a" } }).success).toBe(false);
  });

  it("only accepts known trigger types in preferences", () => {
    expect(updatePreferencesDtoSchema.safeParse({ preferences: [{ type: "client_reassigned", push: false, inApp: true }] }).success).toBe(true);
    expect(updatePreferencesDtoSchema.safeParse({ preferences: [{ type: "email_digest", push: false, inApp: true }] }).success).toBe(false);
  });
});

describe("createPushSender", () => {
  it("is disabled unless all three VAPID values are set", () => {
    expect(createPushSender({}).enabled).toBe(false);
    expect(createPushSender({ publicKey: "k", privateKey: "p" }).enabled).toBe(false);
    const on = createPushSender({ publicKey: "k", privateKey: "p", subject: "mailto:a@b.test" });
    expect(on.enabled).toBe(true);
    expect(on.publicKey).toBe("k");
  });
});
