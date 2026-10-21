import type { AssetEntity } from "../domain/asset.entity";
import type { AssetResponseDto } from "./dto/asset.response.dto";

/** Domain entity -> response DTO. Drops the owner id (a scoping detail the web never needs). */
export function toAssetResponseDto(a: AssetEntity): AssetResponseDto {
  return {
    id: a.id,
    clientId: a.clientId,
    clientName: a.clientName,
    clientStatus: a.clientStatus,
    eventId: a.eventId,
    eventTitle: a.eventTitle,
    title: a.title,
    url: a.url,
    type: a.type,
    comment: a.comment,
    preview: a.preview,
    tags: a.tags,
    createdBy: a.createdBy,
    createdByName: a.createdByName,
    version: a.version,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
