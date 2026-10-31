import { beforeEach, describe, expect, it } from "vitest";
import { NotificationDispatcher } from "./notification-dispatcher";
import { FakeNotificationsRepository, FakePushSender, device } from "./notifications.test-fakes";
import { clientReassignedPayload } from "../domain/notification.messages";
import type { NotificationRequest } from "../domain/notification.entity";

/**
 * The hook other modules call: bell rows + push, preferences, never the
 * actor, dead devices removed, and never throwing into the caller.
 */
const request = (over: Partial<NotificationRequest> = {}): NotificationRequest => ({
  type: "client_reassigned",
  recipientIds: ["sara"],
  actorId: "admin",
  payload: clientReassignedPayload({ clientId: "c1", clientName: "Chai Point" }),
  ...over,
});

describe("NotificationDispatcher", () => {
  let repo: FakeNotificationsRepository;
  let sender: FakePushSender;
  let dispatcher: NotificationDispatcher;

  beforeEach(async () => {
    repo = new FakeNotificationsRepository();
    sender = new FakePushSender();
    dispatcher = new NotificationDispatcher(repo, sender);
    await repo.saveSubscription(device("sara", "https://push.test/sara-phone"));
    await repo.saveSubscription(device("sara", "https://push.test/sara-laptop"));
  });

  describe("notify", () => {
    it("writes a bell row and pushes to every device of the recipient", async () => {
      await dispatcher.notify(request());
      await dispatcher.flush();
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({ userId: "sara", type: "client_reassigned", title: "Chai Point is now your client", url: "/app/clients/c1" });
      expect(sender.sent.map((s) => s.endpoint)).toEqual(["https://push.test/sara-phone", "https://push.test/sara-laptop"]);
      expect(sender.sent[0]!.message).toMatchObject({ title: "Chai Point is now your client", url: "/app/clients/c1" });
      expect(repo.touched).toHaveLength(2);
    });

    it("never notifies the actor about their own action", async () => {
      await dispatcher.notify(request({ recipientIds: ["admin"] }));
      await dispatcher.flush();
      expect(repo.rows).toEqual([]);
      expect(sender.sent).toEqual([]);
    });

    it("respects push and bell mutes", async () => {
      repo.prefs.set("sara", { mutedPush: ["client_reassigned"], mutedInApp: [] });
      await dispatcher.notify(request());
      await dispatcher.flush();
      expect(repo.rows).toHaveLength(1);
      expect(sender.sent).toEqual([]);

      repo.prefs.set("sara", { mutedPush: [], mutedInApp: ["client_reassigned"] });
      await dispatcher.notify(request());
      await dispatcher.flush();
      expect(repo.rows).toHaveLength(1); // unchanged: muting the bell mutes everything
    });

    it("gives a deactivated recipient no bell row and no push, but still serves active ones", async () => {
      repo.inactive.add("sara");
      await repo.saveSubscription(device("kim", "https://push.test/kim-phone"));
      await dispatcher.notify(request({ recipientIds: ["sara", "kim"] }));
      await dispatcher.flush();
      expect(repo.rows.map((r) => r.userId)).toEqual(["kim"]);
      expect(sender.sent.map((s) => s.endpoint)).toEqual(["https://push.test/kim-phone"]);
    });

    it("deletes a device the push service says is gone, and keeps one that merely failed", async () => {
      await repo.saveSubscription(device("sara", "https://push.test/old-gone"));
      await repo.saveSubscription(device("sara", "https://push.test/flaky-fail"));
      await dispatcher.notify(request());
      await dispatcher.flush();
      expect(repo.devices.map((d) => d.endpoint)).toEqual([
        "https://push.test/sara-phone",
        "https://push.test/sara-laptop",
        "https://push.test/flaky-fail",
      ]);
    });

    it("never throws into the caller, even when the database fails", async () => {
      repo.failNextInsert = true;
      await expect(dispatcher.notify(request())).resolves.toBeUndefined();
      expect(sender.sent).toEqual([]);
    });

    it("still writes the bell when push is not configured", async () => {
      dispatcher = new NotificationDispatcher(repo, new FakePushSender(false));
      await dispatcher.notify(request());
      await dispatcher.flush();
      expect(repo.rows).toHaveLength(1);
    });
  });

  describe("push", () => {
    it("sends the push only (the caller wrote the bell row in its transaction)", async () => {
      await dispatcher.push(request());
      await dispatcher.flush();
      expect(repo.rows).toEqual([]);
      expect(sender.sent).toHaveLength(2);
    });

    it("sends no push to a deactivated recipient", async () => {
      repo.inactive.add("sara");
      await dispatcher.push(request());
      await dispatcher.flush();
      expect(sender.sent).toEqual([]);
    });

    it("does nothing without VAPID keys", async () => {
      const off = new FakePushSender(false);
      dispatcher = new NotificationDispatcher(repo, off);
      await dispatcher.push(request());
      await dispatcher.flush();
      expect(off.sent).toEqual([]);
    });
  });

  it("sendToUser reports sent, failed and removed devices", async () => {
    await repo.saveSubscription(device("sara", "https://push.test/x-gone"));
    await repo.saveSubscription(device("sara", "https://push.test/y-fail"));
    const report = await dispatcher.sendToUser("sara", { title: "t", body: "", url: "/app", tag: "t" });
    expect(report).toEqual({ sent: 2, failed: 1, removed: 1 });
  });
});
