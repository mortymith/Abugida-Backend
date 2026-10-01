/**
 * Client-safe barrel of the media feature's server functions. Wrappers
 * only — implementation modules (*.impl.server.ts) are dynamically
 * imported inside each handler and never enter the client bundle.
 */
export { getAssetUploadUrl, getAssetReadUrl } from './media.presign'
export {
  getLibraryAssets,
  getLibraryStats,
  getAssetDetail,
  completeAssetUpload,
  updateAssetMetadata,
  deleteAsset,
  duplicateAsset,
} from './media.assets'
export {
  listFolders,
  getFolderTrail,
  createFolder,
  renameFolder,
  deleteFolder,
  moveAssets,
} from './media.folders'
export { getAssetVersions, uploadAssetVersion, completeAssetVersion } from './media.versions'
export { getAssetUsage } from './media.usage'
export {
  getTranscript,
  saveTranscript,
  importTranscriptFile,
  generateTranscription,
  regenerateTranscriptRange,
  translateTranscript,
  deleteTranscript,
} from './media.transcripts'
