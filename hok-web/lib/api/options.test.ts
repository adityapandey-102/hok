import { describe, expect, it } from "vitest";
import { mergeOptions } from "./options";

describe("mergeOptions", () => {
  it("sorts by label, drops duplicate ids and caps the result", () => {
    const merged = mergeOptions(
      [
        [
          { id: "2", label: "Zed" },
          { id: "1", label: "Amy" },
        ],
        [
          { id: "1", label: "Amy" },
          { id: "3", label: "Bob" },
        ],
      ],
      3,
    );
    expect(merged.map((o) => o.label)).toEqual(["Amy", "Bob", "Zed"]);
    expect(mergeOptions([[{ id: "a", label: "A" }, { id: "b", label: "B" }]], 1)).toHaveLength(1);
  });
});
