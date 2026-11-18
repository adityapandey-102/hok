import { Icon } from "../../../components/ui/Icon";

/**
 * "1 file shared" / "N files shared" (round 5): a green tag on an event's card or row (and its sheet
 * header). It is a button that opens the event at its files. `ripple` adds the very slow green ring
 * (globals.css, off under reduced motion) to say "something new is here".
 */
export function PortalFilesTag({ count, ripple, onClick, size = "sm" }: { count: number; ripple: boolean; onClick: () => void; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="files-tag"
      className={`relative z-10 inline-flex items-center gap-1.5 rounded-full bg-success-bg font-semibold text-success ring-1 ring-success/30 transition-opacity before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] hover:opacity-80 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none ${
        ripple ? "file-tag-ripple" : ""
      } ${size === "md" ? "min-h-11 px-4 text-[13.5px]" : "px-2.5 py-0.5 text-[11.5px]"}`}
    >
      <Icon name="file" size={size === "md" ? 15 : 12} />
      {count} {count === 1 ? "file" : "files"} shared
    </button>
  );
}
