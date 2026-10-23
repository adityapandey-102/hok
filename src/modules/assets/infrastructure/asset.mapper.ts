import type { AssetEntity, AssetType } from "../domain/asset.entity";

/** Raw shape of the repository's ASSET_SELECT projection (pg returns timestamptz as Date). */
export interface AssetRow {
  id: string;
  clientId: string;
  clientName: string;
  /** The client's team: who may see this (internal, never sent to the browser). */
  teamIds: string[];
  clientStatus: "active" | "paused" | "archived";
  eventId: string | null;
  eventTitle: string | null;
  title: string;
  url: string;
  type: AssetType;
  comment: string | null;
  previewTitle: string | null;
  previewDescription: string | null;
  previewImageUrl: string | null;
  previewSiteName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetMapper = {
  /** Row + its tag names -> domain entity. Tags sorted ignoring case. */
  toEntity(row: AssetRow, tagNames: string[]): AssetEntity {
    const { previewTitle, previewDescription, previewImageUrl, previewSiteName, ...rest } = row;
    const hasPreview = Boolean(previewTitle || previewImageUrl || previewDescription);
    return {
      ...rest,
      preview: hasPreview ? { title: previewTitle, description: previewDescription, imageUrl: previewImageUrl, siteName: previewSiteName } : null,
      tags: [...tagNames].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },
};
