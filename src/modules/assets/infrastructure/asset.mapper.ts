import type { AssetEntity, AssetType } from "../domain/asset.entity";

/** Raw shape of the repository's ASSET_SELECT projection (pg returns timestamptz as Date). */
export interface AssetRow {
  id: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  clientStatus: "active" | "paused" | "archived";
  eventId: string | null;
  eventTitle: string | null;
  title: string;
  url: string;
  type: AssetType;
  comment: string | null;
  createdBy: string | null;
  createdByName: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const AssetMapper = {
  /** Row + its tag names -> domain entity. Tags sorted ignoring case. */
  toEntity(row: AssetRow, tagNames: string[]): AssetEntity {
    return {
      ...row,
      tags: [...tagNames].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },
};
