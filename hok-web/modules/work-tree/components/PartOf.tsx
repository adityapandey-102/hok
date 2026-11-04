import Link from "next/link";
import { partHref, type WorkParent } from "../../../lib/domain";
import { Icon } from "../../../components/ui/Icon";

/** "Part of: <parent> › <stage>" at the top of a part's page. The API sends null for a parent the viewer can't see, so nothing shows then. */
export function PartOf({ parent }: { parent: WorkParent | null }) {
  if (!parent) return null;
  return (
    <p data-testid="part-of" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-text-secondary">
      <Icon name="layers" size={14} className="shrink-0 text-text-muted" />
      <span>Part of:</span>
      <Link href={partHref(parent)} className="min-w-0 max-w-full truncate font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
        {parent.title}
      </Link>
      <Icon name="chevron-right" size={12} className="shrink-0 text-text-muted" />
      <span className="min-w-0 truncate">{parent.stageName}</span>
    </p>
  );
}
