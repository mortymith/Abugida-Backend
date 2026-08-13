/**
 * React hooks for TanStack Start integration.
 *
 * These hooks provide a React-friendly interface to storage operations
 * with built-in loading and error state management.
 *
 * Note: React must be installed as a peer dependency in the consuming app.
 */

import type { TanStackStorageClient } from './client.ts'
import type { PutResult, ObjectMetadata, ListResult } from '../../core/types.ts'
import type { PresignedUrlResult } from '../../presigned/types.ts'

// React imports — the consuming app must provide React
// We use a type-only import pattern to avoid bundling React
type Dispatch<A> = (value: A) => void
type SetStateAction<S> = S | ((prevState: S) => S)

/**
 * Minimal React hook shim for standalone usage.
 * In a real TanStack Start app, React is always available.
 */
declare function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>]
declare function useCallback<T extends Function>(callback: T, deps: unknown[]): T

/**
 * Hook for uploading a file to storage.
 */
export function useUpload(client: TanStackStorageClient) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<PutResult | null>(null)

  const upload = useCallback(
    async (
      key: string,
      body: unknown,
      options?: { contentType?: string; metadata?: Record<string, string> },
    ) => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.upload(key, body as any, options)
        setResult(res)
        return res
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  return { upload, loading, error, result }
}

/**
 * Hook for generating a presigned upload URL.
 */
export function usePresignedUpload(client: TanStackStorageClient) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<PresignedUrlResult | null>(null)

  const getUploadUrl = useCallback(
    async (key: string, options?: { expiresIn?: number; contentType?: string }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.getUploadUrl(key, options)
        setResult(res)
        return res
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  return { getUploadUrl, loading, error, result }
}

/**
 * Hook for generating a presigned download URL.
 */
export function usePresignedDownload(client: TanStackStorageClient) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<PresignedUrlResult | null>(null)

  const getDownloadUrl = useCallback(
    async (key: string, options?: { expiresIn?: number }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.getDownloadUrl(key, options)
        setResult(res)
        return res
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  return { getDownloadUrl, loading, error, result }
}

/**
 * Hook for getting object metadata.
 */
export function useObjectMetadata(client: TanStackStorageClient) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [metadata, setMetadata] = useState<ObjectMetadata | null>(null)

  const fetchMetadata = useCallback(
    async (key: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.getMetadata(key)
        setMetadata(res)
        return res
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  return { fetchMetadata, loading, error, metadata }
}

/**
 * Hook for listing objects.
 */
export function useListObjects(client: TanStackStorageClient) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<ListResult | null>(null)

  const listObjects = useCallback(
    async (prefix: string, options?: { maxKeys?: number }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.list(prefix, options)
        setResult(res)
        return res
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [client],
  )

  return { listObjects, loading, error, result }
}
