# @abugida/storage

Shared object storage layer for the [Abugida Application](https://github.com/abugida/abugida-app) monorepo. Provides reliable, type-safe file operations across **Hono API**, **TanStack Start dashboard**, and internal tools using any S3-compatible storage provider.

## Features

- **Multi-provider support** — AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, Wasabi
- **Complete operation set** — put, get, head, exists, delete, deleteMany, copy, move, list, listAll
- **Presigned URLs** — Upload, download, and delete URLs with configurable expiration
- **Multipart uploads** — Create, upload parts, complete, abort, list parts
- **Metadata & tags** — Get/update metadata, set/get object tags
- **Storage key management** — Type-safe key generators for courses, users, organizations, exports, and temp files
- **File validation** — Size limits, MIME type checking, extension validation, SHA-256 checksums
- **Circuit breaker** — Protects against cascading failures with configurable thresholds
- **Retry strategies** — Exponential, fixed, and adaptive backoff with jitter
- **Hono integration** — Ready-to-mount routes + convenience client
- **TanStack Start integration** — Server function client + React hooks
- **Bun optimized** — `NodeHttpHandler` with connection pooling and keep-alive
- **TypeScript first** — Full type safety with JSDoc documentation

## Installation

```bash
pnpm add @abugida/storage
```

## Quick Start

```typescript
import { createStorage } from '@abugida/storage'

const storage = createStorage({
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'abugida',
})

// Upload
const result = await storage.put('test.txt', 'Hello, world!', {
  contentType: 'text/plain',
})

// Download
const { body, metadata } = await storage.get('test.txt')

// Check existence
const { exists } = await storage.exists('test.txt')

// Delete
await storage.delete('test.txt')
```

## Configuration

### Full Config

```typescript
import type { StorageConfig } from '@abugida/storage'

const config: StorageConfig = {
  provider: 'aws-s3',
  endpoint: 'https://s3.amazonaws.com',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: 'abugida-production',

  // Optional
  forcePathStyle: false,
  maxAttempts: 5,
  requestTimeout: 30_000,
  connectionTimeout: 5_000,

  retryStrategy: {
    maxAttempts: 5,
    backoff: 'adaptive',
    baseDelay: 200,
    maxDelay: 20_000,
  },

  encryption: {
    enabled: true,
    algorithm: 'AES256',
  },

  logging: {
    level: 'info',
    format: 'json',
    sensitiveDataMasking: true,
  },

  quotas: {
    maxFileSize: 5120, // 5 GB
  },
}
```

### Environment Variables

```typescript
import { configFromEnv } from '@abugida/storage'

const config = configFromEnv()
```

| Variable                    | Maps To           |
| --------------------------- | ----------------- |
| `STORAGE_PROVIDER`          | `provider`        |
| `STORAGE_ENDPOINT`          | `endpoint`        |
| `STORAGE_REGION`            | `region`          |
| `STORAGE_ACCESS_KEY_ID`     | `accessKeyId`     |
| `STORAGE_SECRET_ACCESS_KEY` | `secretAccessKey` |
| `STORAGE_BUCKET`            | `bucket`          |
| `STORAGE_FORCE_PATH_STYLE`  | `forcePathStyle`  |
| `STORAGE_MAX_ATTEMPTS`      | `maxAttempts`     |
| `STORAGE_REQUEST_TIMEOUT`   | `requestTimeout`  |

### Provider Defaults

```typescript
import { DEFAULT_MINIO_CONFIG, DEFAULT_AWS_CONFIG, DEFAULT_R2_CONFIG } from '@abugida/storage'
```

## Storage Keys

Type-safe key generators prevent key construction errors:

```typescript
// Course content
storage.keys.course('course-123') // "courses/course-123"
storage.keys.courseVideo('course-123', 'vid-1') // "courses/course-123/videos/vid-1.mp4"
storage.keys.courseThumbnail('course-123', 'img-1') // "courses/course-123/thumbnails/img-1.webp"
storage.keys.courseDocument('course-123', 'doc-1') // "courses/course-123/documents/doc-1.pdf"
storage.keys.courseAudio('course-123', 'aud-1') // "courses/course-123/audio/aud-1.mp3"
storage.keys.courseSubtitle('course-123', 'sub-1') // "courses/course-123/subtitles/sub-1.vtt"

// List prefixes
storage.keys.courseVideosPrefix('course-123') // "courses/course-123/videos/"

// Users
storage.keys.userAvatar('user-1') // "users/user-1/avatar.webp"
storage.keys.userAvatar('user-1', 'png') // "users/user-1/avatar.png"
storage.keys.userProfile('user-1', 'asset-1') // "users/user-1/profile/asset-1"

// Organizations
storage.keys.organizationLogo('org-1') // "organizations/org-1/logo.webp"
storage.keys.organizationBanner('org-1', 'banner-1') // "organizations/org-1/banners/banner-1"

// Exports
storage.keys.exportData('export-1', 'json') // "exports/export-1/data.json"

// Temporary
storage.keys.tempFile('session-1', 'upload.bin') // "temp/session-1/upload.bin"
```

## Operations

### Basic Operations

```typescript
// Upload
await storage.put('key', body, { contentType: 'image/png' })

// Batch upload
await storage.putMany(
  [
    { key: 'file1.jpg', body: file1 },
    { key: 'file2.jpg', body: file2 },
  ],
  { concurrency: 5 },
)

// Download as stream
const { body, metadata } = await storage.get('key')

// Download as buffer
const buffer = await storage.getAsBuffer('key')

// Download as string
const text = await storage.getAsString('key')

// Get metadata
const meta = await storage.head('key')

// Check existence
const { exists } = await storage.exists('key')

// Delete
await storage.delete('key')
await storage.deleteMany(['key1', 'key2', 'key3'])

// Copy
await storage.copy('source-key', 'dest-key')

// Move (copy + delete source)
await storage.move('old-key', 'new-key')

// List
const page1 = await storage.list('courses/', { maxKeys: 50 })
const page2 = await storage.list('courses/', { continuationToken: page1.continuationToken })

// List all (auto-paginating)
const allObjects = await storage.listAll('courses/')
```

### Presigned URLs

```typescript
// Upload URL (client-side upload)
const { url, expiresAt } = await storage.presignedUpload('key', {
  expiresIn: 3600,
  contentType: 'video/mp4',
})

// Download URL
const { url } = await storage.presignedDownload('key', {
  expiresIn: 3600,
  responseContentDisposition: 'attachment; filename="video.mp4"',
})

// Delete URL
const { url } = await storage.presignedDelete('key', { expiresIn: 600 })

// Aliases
await storage.presignedPut('key', opts) // = presignedUpload
await storage.presignedGet('key', opts) // = presignedDownload
```

### Multipart Uploads

```typescript
// Initiate
const { uploadId } = await storage.multipartCreate('large-video.mp4', {
  contentType: 'video/mp4',
})

// Upload parts (parallel)
const part1 = await storage.multipartUploadPart('key', uploadId, 1, chunk1)
const part2 = await storage.multipartUploadPart('key', uploadId, 2, chunk2)

// Complete
const result = await storage.multipartComplete('key', uploadId, [
  { partNumber: 1, etag: part1.etag },
  { partNumber: 2, etag: part2.etag },
])

// Or abort if something went wrong
await storage.multipartAbort('key', uploadId)

// List uploaded parts
const parts = await storage.multipartListParts('key', uploadId)
```

### Metadata & Tags

```typescript
// Get metadata (alias for head)
const metadata = await storage.getMetadata('key')

// Update metadata (copies object onto itself with new metadata)
await storage.updateMetadata('key', { processed: 'true' }, 'application/json')

// Tags
await storage.setTags('key', { environment: 'production', category: 'video' })
const tags = await storage.getTags('key')
```

## Validation

```typescript
import {
  validateSize,
  validateQuota,
  SIZE_LIMITS,
  validateMimeType,
  MIME_TYPES,
  validateExtension,
  EXTENSIONS,
  calculateChecksum,
  calculateChecksumHex,
} from "@abugida/storage";

// Size validation
validateSize(file.size, SIZE_LIMITS.VIDEO);  // throws StorageQuotaError

// MIME type validation
validateMimeType(file.type, MIME_TYPES.IMAGES);  // throws StorageValidationError

// Extension validation
validateExtension("mp4", EXTENSIONS.VIDEOS);  // throws StorageValidationError

// Checksums
const sha256Base64 = await calculateChecksum(new Uint8Array([...]));
const sha256Hex = await calculateChecksumHex(new Uint8Array([...]));
```

## Hono Integration

```typescript
import { Hono } from 'hono'
import { createStorage } from '@abugida/storage'
import { createStorageRoutes } from '@abugida/storage/hono'

const storage = createStorage(config)
const app = new Hono()

// Mount ready-to-use REST API
app.route('/storage', createStorageRoutes(storage))

// Or use the convenience client
import { createHonoClient } from '@abugida/storage/hono'
const client = createHonoClient(storage)

app.post('/upload', async (c) => {
  const file = (await c.req.formData()).get('file') as File
  const result = await client.uploadFromRequest('key', file)
  return c.json(result)
})
```

### Built-in Routes

| Method | Path                     | Description                       |
| ------ | ------------------------ | --------------------------------- |
| POST   | `/upload`                | Upload file (multipart/form-data) |
| POST   | `/presigned/upload`      | Get presigned upload URL          |
| POST   | `/presigned/download`    | Get presigned download URL        |
| GET    | `/head/:key`             | Get object metadata               |
| GET    | `/exists/:key`           | Check existence                   |
| DELETE | `/:key`                  | Delete object                     |
| GET    | `/list?prefix=&maxKeys=` | List objects                      |

## TanStack Start Integration

```typescript
// Server function
import { createStorage } from "@abugida/storage";
import { createTanStackClient } from "@abugida/storage/tanstack";

const storage = createStorage(config);
const client = createTanStackClient(storage);

export async function uploadDocument(courseId: string, file: File) {
  const key = storage.keys.courseDocument(courseId, crypto.randomUUID());
  return client.upload(key, file, { contentType: file.type });
}

// React hooks
import { useUpload, usePresignedDownload } from "@abugida/storage/tanstack";

function CourseVideo({ client }) {
  const { getDownloadUrl, loading, result } = usePresignedDownload(client);

  return (
    <button onClick={() => getDownloadUrl("courses/1/videos/1.mp4")}>
      {loading ? "Loading..." : "Download"}
    </button>
  );
}
```

## Error Handling

All errors extend `StorageError`:

```typescript
import {
  StorageError,
  StorageNotFoundError,
  StorageAccessDeniedError,
  StorageUploadError,
  StorageDownloadError,
  StorageValidationError,
  StorageTimeoutError,
  StorageConflictError,
  StorageQuotaError,
  StorageKeyError,
} from '@abugida/storage'

try {
  await storage.get('non-existent-key')
} catch (error) {
  if (error instanceof StorageNotFoundError) {
    // Handle 404
  } else if (error instanceof StorageQuotaError) {
    // Handle file too large
  }
}
```

### Auto-Classification

```typescript
import { classifyError } from '@abugida/storage'

// Maps AWS SDK errors to appropriate StorageError subclasses
const storageError = classifyError(awsError, 'object-key')
```

## Circuit Breaker

```typescript
const storage = createStorage(config, {
  circuitBreaker: {
    failureThreshold: 5, // Open after 5 failures
    resetTimeout: 30_000, // Try again after 30s
    successThreshold: 2, // Close after 2 successes
  },
})

// Check state
console.log(storage.circuitState) // "closed" | "open" | "half-open"
```

## Health Check

```typescript
const result = await storage.health()
// { healthy: true, bucket: "abugida", latencyMs: 12 }
```

## Bun Integration

```typescript
// Upload from Bun's File API
const file = Bun.file('path/to/video.mp4')
await storage.put('videos/large.mp4', file, { contentType: 'video/mp4' })

// Stream upload
const stream = Bun.file('large-file.mp4').stream()
await storage.put('videos/large.mp4', stream, { contentType: 'video/mp4' })
```

## Provider Setup

### MinIO (Local Development)

```bash
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

```typescript
const storage = createStorage({
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'abugida-dev',
  forcePathStyle: true,
})
```

### Cloudflare R2

```typescript
const storage = createStorage({
  provider: 'r2',
  endpoint: 'https://<account-id>.r2.cloudflarestorage.com',
  region: 'auto',
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucket: 'abugida-production',
})
```

### AWS S3

```typescript
const storage = createStorage({
  provider: 'aws-s3',
  endpoint: 'https://s3.amazonaws.com',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: 'abugida-production',
  encryption: { enabled: true, algorithm: 'AES256' },
})
```

## Testing

```bash
# Unit tests
pnpm run test

# With coverage
pnpm run test:coverage

# Integration tests (requires MinIO)
RUN_INTEGRATION=1 pnpm run test:integration
```

## License

MIT
