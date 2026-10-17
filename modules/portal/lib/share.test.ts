import { describe, expect, it } from "vitest";
import { linkState, whatsappShareUrl } from "./share";

describe("portal share helpers", () => {
  it("encodes the url for WhatsApp", () => {
    expect(whatsappShareUrl("https://x.test/p/a b?c=1&d=2")).toBe(
      "https://wa.me/?text=https%3A%2F%2Fx.test%2Fp%2Fa%20b%3Fc%3D1%26d%3D2",
    );
  });
  it("derives link state", () => {
    expect(linkState(null)).toBe("none");
    expect(linkState({ active: true })).toBe("active");
    expect(linkState({ active: false })).toBe("disabled");
  });
});
