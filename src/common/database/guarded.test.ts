import { describe, expect, it } from "vitest";
import { ConflictError, InternalError, NotFoundError } from "../errors/app-error";
import { guarded } from "./guarded";

describe("guarded", () => {
  it("passes results and deliberate AppErrors through", async () => {
    expect(await guarded("load x", () => Promise.resolve(1))).toBe(1);
    const notFound = new NotFoundError("gone", "X_NOT_FOUND");
    await expect(guarded("load x", () => Promise.reject(notFound))).rejects.toBe(notFound);
  });

  it("wraps anything else as a 500 that keeps the cause", async () => {
    const cause = new Error("connection reset");
    const err = await guarded("load x", () => Promise.reject(cause)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalError);
    expect((err as InternalError).message).toBe("Failed to load x");
  });

  it("lets a repository map a known database error first", async () => {
    const taken = new ConflictError("taken", "NAME_TAKEN");
    const map = (e: unknown) => ((e as { code?: string }).code === "23505" ? taken : undefined);
    await expect(guarded("save", () => Promise.reject(Object.assign(new Error("dup"), { code: "23505" })), map)).rejects.toBe(taken);
    await expect(guarded("save", () => Promise.reject(new Error("other")), map)).rejects.toBeInstanceOf(InternalError);
  });
});
