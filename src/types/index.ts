// API Response Types
export interface ManifestResponse {
  version: string
  deviceId: string
  creatives: Creative[]
  generatedAt: string
}

export interface Creative {
  id: string
  url: string
  duration: number
  campaignId: string
  campaignName: string
}

export interface ImpressionRequest {
  deviceId: string
  creativeId: string
  timestamp?: number
}

// Caching Types
export interface CachedVideo {
  id: string
  url: string
  blob: Blob
  downloadedAt: number
  expiresAt: number
  size: number
}

export interface VideoMetadata {
  id: string
  url: string
  duration: number
  campaignId: string
  campaignName: string
  downloadedAt: number
  expiresAt: number
  size: number
}

// Application State Types
export interface AppConfig {
  deviceId: string
  serverUrl: string
  pollInterval: number
  cacheSize: number
  maxVideos: number
}

export interface AppState {
  isOnline: boolean
  currentVideo: Creative | null
  playlist: Creative[]
  currentIndex: number
  isPlaying: boolean
  lastManifestUpdate: number
  lastManifestVersion: string | null
  errorCount: number
}

export interface RuntimeConfigSource {
  deviceId?: string
  serverUrl?: string
  pollInterval?: number
  cacheSize?: number
  maxVideos?: number
}

// Error Types
export interface AppError {
  type: 'network' | 'video' | 'storage' | 'manifest' | 'impression'
  message: string
  timestamp: number
  details?: any
}

// Event Types
export interface VideoEvent {
  type: 'play' | 'pause' | 'ended' | 'error' | 'loadstart' | 'loadeddata'
  video: Creative
  timestamp: number
}

export interface ManifestEvent {
  type: 'updated' | 'error' | 'polling'
  manifest?: ManifestResponse
  error?: AppError
  timestamp: number
}

// Storage Types
export interface StorageStats {
  totalSize: number
  videoCount: number
  availableSpace: number
  oldestVideo: number
  newestVideo: number
}

// Configuration Constants
export const DEFAULT_CONFIG: AppConfig = {
  deviceId: 'demo-device',
  serverUrl: '',
  pollInterval: 2 * 60 * 1000, // 2 minutes
  cacheSize: 2 * 1024 * 1024 * 1024, // 2GB
  maxVideos: 10
}

export const VIDEO_FORMATS = ['mp4'] as const
export type VideoFormat = typeof VIDEO_FORMATS[number]

export const ERROR_TYPES = {
  NETWORK: 'network' as const,
  VIDEO: 'video' as const,
  STORAGE: 'storage' as const,
  MANIFEST: 'manifest' as const,
  IMPRESSION: 'impression' as const
} as const
