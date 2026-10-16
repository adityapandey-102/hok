import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { NotificationDispatcher } from "./notification-dispatcher";
import { NotificationsService, liveNotificationTypes } from "./notifications.service";
import { FakeNotificationsRepository, FakePushSender, device } from "./notifications.test-fakes";
import { clientReassignedPayload } from "../domain/notification.messages";

/** The caller's own bell, preferences and devices: always scoped to the caller. */
async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("NotificationsService", () => {
  let repo: FakeNotificationsRepository;
  let sender: FakePushSender;
  let service: NotificationsService;

  beforeEach(async () => {
    repo = new FakeNotificationsRepository();
    sender = new FakePushSender();
    const dispatcher = new NotificationDispatcher(repo, sender);
    service = new NotificationsService(repo, dispatcher, sender);
    for (const [user, id] of [["sara", "c1"], ["sara", "c2"], ["rohan", "c3"]] as const) {
      await dispatcher.notify({ type: "client_reassigned", recipientIds: [user], actorId: "admin", payload: clientReassignedPayload({ clientId: id, clientName: id }) });
    }
    await dispatcher.flush();
  });

  it("lists only the caller's notifications, with totals and the unread filter", async () => {
    const all = await service.list("sara", { unread: false, limit: 20, offset: 0 });
    expect(all.total).toBe(2);
    expect(all.notifications.every((n) => n.url?.startsWith("/app/clients/"))).toBe(true);
    await service.markRead("sara", all.notifications[0]!.id);
    expect((await service.list("sara", { unread: true, limit: 20, offset: 0 })).total).toBe(1);
    expect(await service.unreadCount("sara")).toEqual({ count: 1 });
  });

  it("someone else's notification is a 404", async () => {
    const rohans = (await service.list("rohan", { unread: false, limit: 20, offset: 0 })).notifications[0]!;
    expect(await codeOf(service.markRead("sara", rohans.id))).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("marks all read and reports how many changed", async () => {
    expect(await service.markAllRead("sara")).toEqual({ updated: 2 });
    expect(await service.markAllRead("sara")).toEqual({ updated: 0 });
    expect(await service.unreadCount("rohan")).toEqual({ count: 1 });
  });

  describe("preferences", () => {
    it("lists only live triggers, all on by default", async () => {
      const { preferences } = await service.getPreferences("sara");
      expect(preferences.map((p) => p.type)).toEqual(liveNotificationTypes());
      expect(preferences.every((p) => p.push && p.inApp)).toBe(true);
    });

    it("stores mutes for the triggers sent and reports a muted bell as no push either", async () => {
      const { preferences } = await service.updatePreferences("sara", { preferences: [{ type: "client_reassigned", push: true, inApp: false }] });
      expect(preferences.find((p) => p.type === "client_reassigned")).toMatchObject({ push: false, inApp: false });
      expect(repo.prefs.get("sara")).toEqual({ mutedPush: [], mutedInApp: ["client_reassigned"] });
    });

    it("ignores triggers that aren't live yet", async () => {
      await service.updatePreferences("sara", { preferences: [{ type: "client_comment", push: false, inApp: false }] });
      expect(repo.prefs.get("sara")).toEqual({ mutedPush: [], mutedInApp: [] });
    });
  });

  describe("push devices", () => {
    it("reports the server's push config", () => {
      expect(service.pushConfig()).toEqual({ enabled: true, publicKey: "BPublicKey" });
    });

    it("subscribes, lists without endpoints or keys, and unsubscribes by endpoint", async () => {
      await service.subscribe("sara", { endpoint: "https://push.test/a", keys: { p256dh: "p", auth: "a" }, userAgent: "Chrome on Android" });
      const { devices } = await service.listDevices("sara");
      expect(devices.map(({ userAgent, createdAt, lastUsedAt }) => ({ userAgent, createdAt, lastUsedAt }))).toEqual([{ userAgent: "Chrome on Android", createdAt: "t", lastUsedAt: "t" }]);
      expect(Object.keys(devices[0]!)).not.toContain("endpoint");
      await service.unsubscribe("sara", "https://push.test/a");
      expect((await service.listDevices("sara")).devices).toEqual([]);
    });

    it("removing someone else's device is a 404", async () => {
      await repo.saveSubscription(device("rohan", "https://push.test/r"));
      const id = repo.devices[0]!.id;
      expect(await codeOf(service.removeDevice("sara", id))).toBe("PUSH_SUBSCRIPTION_NOT_FOUND");
      await service.removeDevice("rohan", id);
      expect(repo.devices).toEqual([]);
    });

    it("sends a test push to the caller's devices, or 503 without VAPID keys", async () => {
      await repo.saveSubscription(device("sara", "https://push.test/s"));
      expect(await service.sendTest("sara")).toEqual({ sent: 1, failed: 0, removed: 0 });
      const off = new FakePushSender(false);
      const disabled = new NotificationsService(repo, new NotificationDispatcher(repo, off), off);
      expect(await codeOf(disabled.sendTest("sara"))).toBe("PUSH_NOT_CONFIGURED");
    });
  });
});
