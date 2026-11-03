import type { AssetType } from "../../../lib/domain";
import type { PillTone } from "../../../components/ui/StatusPill";
import type { IconName } from "../../../components/ui/Icon";

export const ASSET_TYPE_TONES: Record<AssetType, PillTone> = { photo: "blue", video: "green", document: "gray", design: "amber", audio: "pink", other: "gray" };
export const ASSET_TYPE_ICONS: Record<AssetType, IconName> = { photo: "image", video: "eye", document: "file", design: "palette", audio: "bell", other: "external-link" };

/** The address's host ("drive.google.com"), or the raw text when it isn't a URL. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
