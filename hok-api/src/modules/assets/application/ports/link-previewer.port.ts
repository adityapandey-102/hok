/** Fetches a link's preview in the background after an asset is saved (FR-AST-08). Never throws; never awaited by the request. */
export interface LinkPreviewerPort {
  refresh(assetId: string, url: string): void;
}
