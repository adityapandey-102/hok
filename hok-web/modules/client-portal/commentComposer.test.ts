import { describe, expect, it, vi } from "vitest";
import { PortalApiError, type PortalComment } from "./api/publicPortalApi";
import { COMMENT_MAX, sendPortalComment } from "./commentComposer";

const comment: PortalComment = { id: "c1", eventId: "e1", eventTitle: "Shoot", body: "Hi", status: "received", reply: null, repliedAt: null, createdAt: "2026-11-18T10:00:00Z" };

describe("sendPortalComment", () => {
  it("posts the trimmed text with the event's id", async () => {
    const post = vi.fn().mockResolvedValue({ comment });
    const r = await sendPortalComment("tok", "  Hi  ", "e1", post);
    expect(post).toHaveBeenCalledWith("tok", "Hi", "e1");
    expect(r).toEqual({ ok: true, comment });
  });
  it("posts without an event for a general comment", async () => {
    const post = vi.fn().mockResolvedValue({ comment });
    await sendPortalComment("tok", "Hi", null, post);
    expect(post).toHaveBeenCalledWith("tok", "Hi", null);
  });
  it("refuses an empty comment without calling the API", async () => {
    const post = vi.fn();
    expect(await sendPortalComment("tok", "   ", "e1", post)).toEqual({ ok: false, error: "Write a comment first." });
    expect(post).not.toHaveBeenCalled();
  });
  it("caps the length", async () => {
    const post = vi.fn().mockResolvedValue({ comment });
    await sendPortalComment("tok", "x".repeat(COMMENT_MAX + 50), "e1", post);
    expect(post.mock.calls[0]![1]).toHaveLength(COMMENT_MAX);
  });
  it("turns failures into a sentence, keeping the rate-limit message", async () => {
    const limited = vi.fn().mockRejectedValue(new PortalApiError("Too many comments. Try again later.", 429, null));
    expect(await sendPortalComment("tok", "Hi", "e1", limited)).toEqual({ ok: false, error: "Too many comments. Try again later." });
    const broken = vi.fn().mockRejectedValue("boom");
    expect(await sendPortalComment("tok", "Hi", "e1", broken)).toEqual({ ok: false, error: "Could not send your comment." });
  });
});
