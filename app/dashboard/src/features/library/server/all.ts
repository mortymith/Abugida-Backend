/**
 * Client-safe barrel of the library feature's server functions. Wrappers
 * only — implementation modules (*.impl.server.ts) are dynamically
 * imported inside each handler and never enter the client bundle.
 */
export { getAssetUploadUrl, getAssetReadUrl } from './library.presign'
export {
  getLibraryAssets,
  getLibraryStats,
  getAssetDetail,
  completeAssetUpload,
  updateAssetMetadata,
  deleteAsset,
  duplicateAsset,
} from './library.assets'
export {
  listFolders,
  getFolderTrail,
  createFolder,
  renameFolder,
  deleteFolder,
  moveAssets,
} from './library.folders'
export { getAssetVersions, uploadAssetVersion, completeAssetVersion } from './library.versions'
export { getAssetUsage } from './library.usage'
export {
  getTranscript,
  saveTranscript,
  importTranscriptFile,
  generateTranscription,
  regenerateTranscriptRange,
  translateTranscript,
  deleteTranscript,
} from './library.transcripts'
