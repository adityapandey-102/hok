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
