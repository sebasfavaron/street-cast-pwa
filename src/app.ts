import { VideoManager } from './video-manager';
import { ImpressionTracker } from './impression-tracker';
import { CacheManager } from './utils/storage';
import {
  AppConfig,
  AppState,
  ManifestResponse,
  Creative,
  VideoEvent,
  VideoLoadedEvent,
  AppError,
  ERROR_TYPES,
  DEFAULT_CONFIG,
  RuntimeConfigSource,
} from './types';

declare global {
  interface Window {
    streetCastApp?: StreetCastApp;
    __STREET_CAST_CONFIG__?: RuntimeConfigSource;
  }
}

const CONFIG_STORAGE_KEY = 'street-cast-runtime-config';
const DEFAULT_LOCAL_SERVER_PORT = '3050';
const importMetaEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {})
    : {};

function normalizeServerUrl(value?: string): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

function getApiBaseUrl(serverUrl: string): string {
  return normalizeServerUrl(serverUrl);
}

function inferLocalServerUrl(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const { hostname, protocol } = window.location;
  if (!['127.0.0.1', 'localhost'].includes(hostname)) {
    return undefined;
  }

  const params = new URLSearchParams(window.location.search);
  const explicitPort = params.get('serverPort') ?? importMetaEnv.VITE_SERVER_PORT ?? DEFAULT_LOCAL_SERVER_PORT;

  return `${protocol}//${hostname}:${explicitPort}`;
}

function getNumericOverride(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coercePositiveNumber(value: number | undefined, fallback: number): number {
  if (value == null || value <= 0) {
    return fallback;
  }

  return value;
}

function pickFirstNonEmptyString(
  values: Array<string | undefined>,
  normalize: (value?: string) => string = (value) => (value ?? '').trim()
): string {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function loadStoredConfig(): RuntimeConfigSource {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RuntimeConfigSource) : {};
  } catch (error) {
    console.warn('Failed to load stored runtime config', error);
    return {};
  }
}

function getQueryConfig(): RuntimeConfigSource {
  const params = new URLSearchParams(window.location.search);
  return {
    deviceId: params.get('deviceId') ?? params.get('device') ?? undefined,
    serverUrl: params.get('serverUrl') ?? params.get('server') ?? undefined,
    pollInterval: getNumericOverride(params.get('pollInterval')),
    cacheSize: getNumericOverride(params.get('cacheSize')),
    maxVideos: getNumericOverride(params.get('maxVideos')),
  };
}

function saveRuntimeConfig(config: AppConfig): void {
  try {
    window.localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({
        deviceId: config.deviceId,
        serverUrl: config.serverUrl,
        pollInterval: config.pollInterval,
        cacheSize: config.cacheSize,
        maxVideos: config.maxVideos,
      })
    );
  } catch (error) {
    console.warn('Failed to persist runtime config', error);
  }
}

function resolveConfig(overrides: Partial<AppConfig>): AppConfig {
  const envConfig: RuntimeConfigSource = {
    deviceId: importMetaEnv.VITE_DEVICE_ID,
    serverUrl: importMetaEnv.VITE_SERVER_URL,
    pollInterval: getNumericOverride(importMetaEnv.VITE_POLL_INTERVAL ?? null),
    cacheSize: getNumericOverride(importMetaEnv.VITE_CACHE_SIZE ?? null),
    maxVideos: getNumericOverride(importMetaEnv.VITE_MAX_VIDEOS ?? null),
  };

  const storedConfig = loadStoredConfig();
  const inferredLocalServerUrl = inferLocalServerUrl();
  const queryConfig = getQueryConfig();
  const runtimeConfig = window.__STREET_CAST_CONFIG__ ?? {};
  const merged = {
    ...DEFAULT_CONFIG,
    ...storedConfig,
    ...envConfig,
    ...runtimeConfig,
    ...queryConfig,
    ...overrides,
  };

  return {
    deviceId:
      pickFirstNonEmptyString(
        [
        overrides.deviceId,
        queryConfig.deviceId,
        runtimeConfig.deviceId,
        envConfig.deviceId,
        storedConfig.deviceId,
        DEFAULT_CONFIG.deviceId
        ]
      ) || DEFAULT_CONFIG.deviceId,
    serverUrl: pickFirstNonEmptyString(
      [
      overrides.serverUrl,
      queryConfig.serverUrl,
      runtimeConfig.serverUrl,
      envConfig.serverUrl,
      inferredLocalServerUrl,
      storedConfig.serverUrl,
      DEFAULT_CONFIG.serverUrl
      ],
      normalizeServerUrl
    ),
    pollInterval: coercePositiveNumber(merged.pollInterval, DEFAULT_CONFIG.pollInterval),
    cacheSize: coercePositiveNumber(merged.cacheSize, DEFAULT_CONFIG.cacheSize),
    maxVideos: Math.max(1, Math.floor(coercePositiveNumber(merged.maxVideos, DEFAULT_CONFIG.maxVideos))),
  };
}

export class StreetCastApp {
  private config: AppConfig;
  private state: AppState;
  private videoManager: VideoManager;
  private impressionTracker: ImpressionTracker;
  private cacheManager: CacheManager;
  private manifestPoller: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor(config: Partial<AppConfig> = {}) {
    this.config = resolveConfig(config);
    this.state = this.createInitialState();
    this.cacheManager = new CacheManager(this.config.cacheSize, this.config.maxVideos);
    this.videoManager = new VideoManager(this.cacheManager);
    this.impressionTracker = new ImpressionTracker(this.config);

    saveRuntimeConfig(this.config);
    this.setupEventListeners();
  }

  private createInitialState(): AppState {
    return {
      isOnline: navigator.onLine,
      currentVideo: null,
      playlist: [],
      currentIndex: 0,
      isPlaying: false,
      lastManifestUpdate: 0,
      lastManifestVersion: null,
      errorCount: 0,
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    this.videoManager.on('videoEvent', (event) => this.handleVideoEvent(event));
    this.videoManager.on('videoLoaded', (data) => this.handleVideoLoaded(data));
    this.videoManager.on('error', (error) => this.handleError(error));

    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.setLoadingStatus('Preparing cached content...');
      this.setupVideoElement();
      await this.loadCachedVideos();
      await this.refreshManifest();
      this.startManifestPolling();
      this.hideLoadingScreen();
      this.isInitialized = true;
      console.log('Street Cast App initialized successfully', this.config);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.handleError({
        type: ERROR_TYPES.MANIFEST,
        message: 'App initialization failed',
        timestamp: Date.now(),
        details: error,
      });
    }
  }

  private setupVideoElement(): void {
    const container = document.getElementById('video-container');
    if (!container) {
      throw new Error('Video container not found in DOM');
    }

    if (!container.contains(this.videoManager.getVideoElement())) {
      container.appendChild(this.videoManager.getVideoElement());
    }
  }

  private startManifestPolling(): void {
    if (!this.config.serverUrl || this.manifestPoller) {
      if (!this.config.serverUrl) {
        this.setLoadingStatus('Waiting for VITE_SERVER_URL or ?serverUrl=...');
      }
      return;
    }

    this.manifestPoller = setInterval(() => {
      void this.refreshManifest();
    }, this.config.pollInterval);
  }

  async refreshManifest(): Promise<void> {
    if (!this.config.serverUrl) {
      this.showError('Missing API base URL. Configure VITE_SERVER_URL or pass ?serverUrl=...');
      return;
    }

    this.setLoadingStatus(`Syncing device ${this.config.deviceId}...`);

    try {
      const response = await fetch(`${getApiBaseUrl(this.config.serverUrl)}/api/manifest/${this.config.deviceId}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifest: ManifestResponse = await response.json();
      await this.applyManifest(manifest);

      this.state.lastManifestUpdate = Date.now();
      this.state.lastManifestVersion = manifest.version;
      this.state.errorCount = 0;
      this.hideError();
      this.hideLoadingScreen();

      console.log(`Manifest updated with ${manifest.creatives.length} videos`);
    } catch (error) {
      console.error('Failed to fetch manifest:', error);
      this.handleError({
        type: ERROR_TYPES.MANIFEST,
        message: 'Failed to fetch manifest',
        timestamp: Date.now(),
        details: error,
      });
    }
  }

  private async applyManifest(manifest: ManifestResponse): Promise<void> {
    const nextSignature = manifest.creatives.map((creative) => creative.id).join('|');
    const currentSignature = this.state.playlist.map((creative) => creative.id).join('|');

    if (
      manifest.version === this.state.lastManifestVersion &&
      nextSignature === currentSignature &&
      this.state.playlist.length > 0
    ) {
      return;
    }

    this.state.playlist = manifest.creatives;
    await this.videoManager.updatePlaylist(manifest.creatives);
    this.state.currentIndex = this.videoManager.getCurrentIndex();
  }

  private async loadCachedVideos(): Promise<void> {
    try {
      const cachedVideos = await this.cacheManager.getAllMetadata();
      if (cachedVideos.length === 0) {
        this.setLoadingStatus('No cached videos yet. Waiting for first manifest sync...');
        return;
      }

      const creatives: Creative[] = cachedVideos.map((meta) => ({
        id: meta.id,
        url: meta.url,
        duration: meta.duration,
        campaignId: meta.campaignId,
        campaignName: meta.campaignName,
      }));

      this.state.playlist = creatives;
      await this.videoManager.updatePlaylist(creatives);
      this.state.currentIndex = this.videoManager.getCurrentIndex();
      this.setLoadingStatus(`Loaded ${cachedVideos.length} cached videos`);
      this.hideError();
    } catch (error) {
      console.error('Failed to load cached videos:', error);
    }
  }

  private handleVideoEvent(event: VideoEvent): void {
    this.state.currentIndex = this.videoManager.getCurrentIndex();

    switch (event.type) {
      case 'play':
        this.state.isPlaying = true;
        this.state.currentVideo = event.video;
        void this.impressionTracker.reportImpression(event.video.id);
        break;
      case 'pause':
        this.state.isPlaying = false;
        break;
      case 'ended':
        this.state.isPlaying = false;
        break;
      case 'loadstart':
        this.setLoadingStatus(`Loading ${event.video.campaignName}...`);
        break;
      case 'loadeddata':
        this.hideLoadingScreen();
        break;
    }
  }

  private handleVideoLoaded(data: VideoLoadedEvent): void {
    this.state.currentVideo = data.video;
    this.state.currentIndex = this.videoManager.getCurrentIndex();
    this.setLoadingStatus(
      data.fromCache
        ? `Playing cached video ${data.video.id}`
        : data.fallback === 'remote'
          ? `Streaming ${data.video.id} while cache warms`
          : `Cached video ${data.video.id}`
    );
  }

  private handleError(error: AppError): void {
    console.error('App error:', error);
    this.state.errorCount++;

    switch (error.type) {
      case ERROR_TYPES.VIDEO:
        this.showError('Video playback failed. Trying the next creative.');
        break;
      case ERROR_TYPES.MANIFEST:
        this.showError('Manifest unavailable. Continuing with cached content if present.');
        break;
      case ERROR_TYPES.STORAGE:
        void this.handleStorageError();
        break;
      default:
        this.showError(error.message);
        break;
    }
  }

  private async handleStorageError(): Promise<void> {
    try {
      const stats = await this.cacheManager.getStorageStats();
      console.log('Storage stats:', stats);

      if (stats.availableSpace < 100 * 1024 * 1024) {
        this.showError('Low browser storage. Old cached videos may be removed automatically.');
      }
    } catch (error) {
      console.error('Failed to handle storage error:', error);
    }
  }

  private handleOnline(): void {
    this.state.isOnline = true;
    void this.refreshManifest();
  }

  private handleOffline(): void {
    this.state.isOnline = false;
    if (this.state.playlist.length > 0) {
      this.showError('Offline. Continuing with cached content.');
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.videoManager.pause();
    } else {
      this.videoManager.play();
    }
  }

  private setLoadingStatus(message: string): void {
    const status = document.getElementById('loading-status');
    if (status) {
      status.textContent = message;
    }
  }

  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }

  private showError(message: string): void {
    const overlay = document.getElementById('error-overlay');
    const messageElement = document.getElementById('error-message');

    if (messageElement) {
      messageElement.textContent = message;
    }

    if (overlay) {
      overlay.classList.remove('hidden');
    }
  }

  private hideError(): void {
    const overlay = document.getElementById('error-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  getState(): AppState {
    return { ...this.state };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  async getHealthStatus(): Promise<unknown> {
    const impressionHealth = await this.impressionTracker.healthCheck();
    const storageStats = await this.cacheManager.getStorageStats();

    return {
      app: {
        initialized: this.isInitialized,
        online: this.state.isOnline,
        playing: this.state.isPlaying,
        errorCount: this.state.errorCount,
        lastManifestUpdate: this.state.lastManifestUpdate,
        lastManifestVersion: this.state.lastManifestVersion,
      },
      config: this.config,
      video: {
        currentVideo: this.state.currentVideo,
        playlistLength: this.state.playlist.length,
        currentIndex: this.state.currentIndex,
      },
      storage: storageStats,
      impressions: impressionHealth,
    };
  }

  play(): void {
    this.videoManager.play();
  }

  pause(): void {
    this.videoManager.pause();
  }

  stop(): void {
    this.videoManager.stop();
  }

  nextVideo(): void {
    void this.videoManager.playNext();
  }

  destroy(): void {
    if (this.manifestPoller) {
      clearInterval(this.manifestPoller);
      this.manifestPoller = null;
    }

    this.videoManager.destroy();
    this.impressionTracker.destroy();
    this.isInitialized = false;
    console.log('Street Cast App destroyed');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = new StreetCastApp();
  window.streetCastApp = app;
  await app.initialize();
});
