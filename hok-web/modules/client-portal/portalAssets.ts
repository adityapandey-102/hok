import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from "../../lib/domain";
import { ASSET_TYPE_ICONS } from "../assets/components/assetUi";
import type { IconName } from "../../components/ui/Icon";

const isAssetType = (t: string): t is AssetType => (ASSET_TYPES as readonly string[]).includes(t);

/** The icon for a shared link's type; an unknown type (the API may grow) gets the plain link icon. */
export function portalAssetIcon(type: string): IconName {
  return isAssetType(type) ? ASSET_TYPE_ICONS[type] : "external-link";
}

/** What the client reads next to a shared link: "Video", "Design"; "Link" when the type is unknown. */
export function portalAssetLabel(type: string): string {
  return isAssetType(type) ? ASSET_TYPE_LABELS[type] : "Link";
}
