import type { AssetType } from "../../domain/asset.entity";

/** GET /assets/:id and every write's `{ asset }`; also one row of GET /assets. */
export interface AssetResponseDto {
  id: string;
  clientId: string;
  clientName: string;
  clientStatus: "active" | "paused" | "archived";
  eventId: string | null;
  eventTitle: string | null;
  title: string;
  url: string;
  type: AssetType;
  comment: string | null;
  tags: string[];
  createdBy: string | null;
  createdByName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetListResponseDto {
  assets: AssetResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface TagListResponseDto {
  tags: { name: string; uses: number }[];
}
