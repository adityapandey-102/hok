import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * "Showing 21–40 of 132  [← Prev] [Next →]" for any server-paginated list.
 * `page` is 0-based. Renders nothing while the list is empty.
 */
export function Pager({
  page,
  pageSize,
  total,
  onPageChange,
  className = "",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total === 0) return null;
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-border-light px-4 py-3 text-xs text-text-muted ${className}`}
    >
      <span aria-live="polite">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="px-3 py-1.5 text-xs"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(page - 1, 0))}
        >
          <Icon name="chevron-right" size={14} className="rotate-180" />
          Prev
        </Button>
        <Button variant="outline" className="px-3 py-1.5 text-xs" disabled={end >= total} onClick={() => onPageChange(page + 1)}>
          Next
          <Icon name="chevron-right" size={14} />
        </Button>
      </div>
    </div>
  );
}
