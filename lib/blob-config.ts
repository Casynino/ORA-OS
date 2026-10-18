/**
 * Cloud file storage (Vercel Blob). The project's public store is connected with the
 * prefix ORA_FILES (the default BLOB_* names are taken by an older private store that
 * this app does not use), so the token is ORA_FILES_READ_WRITE_TOKEN. The default name
 * still works if someone connects a store without a prefix.
 */
export const blobToken = (): string | undefined =>
  process.env.ORA_FILES_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || undefined;

export const blobConfigured = (): boolean => !!blobToken();
