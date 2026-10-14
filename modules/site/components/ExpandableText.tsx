"use client";

import { useState } from "react";

/**
 * "Read More / Read Less" text from the home page's timeline. Replaces the
 * template's inline `toggleText(this)` script; keeps its markup and classes
 * (`expandable-text`, `expanded`, `preview-text`, …) so main.css styles it.
 */
export function ExpandableText({ preview, full }: { preview: string; full: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={expanded ? "expandable-text expanded" : "expandable-text"}>
      <span className="spantext-clr preview-text" style={expanded ? { display: "none" } : undefined}>
        {preview}
      </span>{" "}
      <span className="spantext-clr full-text" style={{ display: expanded ? "block" : "none" }}>
        {full}
      </span>{" "}
      <button
        type="button"
        className={expanded ? "expand-btn theme-clr expanded" : "expand-btn theme-clr"}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="expand-text" style={expanded ? { display: "none" } : undefined}>
          Read More
        </span>{" "}
        <span className="collapse-text" style={{ display: expanded ? "inline" : "none" }}>
          Read Less
        </span>
      </button>
    </div>
  );
}
