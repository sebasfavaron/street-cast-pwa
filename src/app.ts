import { VideoManager } from './video-manager';
import { ImpressionTracker } from './impression-tracker';
import { CacheManager } from './utils/storage';
import {
  AppConfig,
  AppState,
  ManifestResponse,
  Creative,
  AppError,
  ERROR_TYPES,
  DEFAULT_CONFIG,
} from './types';

export class StreetCastApp {
  private config: AppConfig;
  private state: AppState;
  private videoManager: VideoManager;
  private impressionTracker: ImpressionTracker;
  private cacheManager: CacheManager;
  private manifestPoller: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<AppConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
    this.cacheManager = new CacheManager(this.config.cacheSize, this.config.maxVideos);
    this.videoManager = new VideoManager(this.cacheManager);
    this.impressionTracker = new ImpressionTracker(this.config);

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
      errorCount: 0,
    };
  }

  private setupEventListeners(): void {
    // Network status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Video events
    this.videoManager.on('videoEvent', (event: any) => this.handleVideoEvent(event));
    this.videoManager.on('videoLoaded', (data: any) => this.handleVideoLoaded(data));
    this.videoManager.on('error', (error: any) => this.handleError(error));

    // Visibility change (for kiosk mode)
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Street Cast App...');

      // Setup video element in DOM
      this.setupVideoElement();

      // Start manifest polling
      this.startManifestPolling();

      // Load cached videos
      await this.loadCachedVideos();

      this.isInitialized = true;
      console.log('Street Cast App initialized successfully');
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
    if (container) {
      container.appendChild(this.videoManager.getVideoElement());
    } else {
      console.error('Video container not found in DOM');
    }
  }

  private startManifestPolling(): void {
    // Initial poll
    this.pollManifest();

    // Set up interval
    this.manifestPoller = setInterval(() => {
      this.pollManifest();
    }, this.config.pollInterval);
  }

  private async pollManifest(): Promise<void> {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/manifest/${this.config.deviceId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifest: ManifestResponse = await response.json();
      await this.updatePlaylist(manifest.creatives);

      this.state.lastManifestUpdate = Date.now();
      this.state.errorCount = 0;

      console.log(`Manifest updated with ${manifest.creatives.length} videos`);
    } catch (error) {
      console.error('Failed to fetch manifest:', error);
      this.state.errorCount++;

      this.handleError({
        type: ERROR_TYPES.MANIFEST,
        message: 'Failed to fetch manifest',
        timestamp: Date.now(),
        details: error,
      });
    }
  }

  private async updatePlaylist(creatives: Creative[]): Promise<void> {
    this.state.playlist = creatives;
    await this.videoManager.updatePlaylist(creatives);
  }

  private async loadCachedVideos(): Promise<void> {
    try {
      const cachedVideos = await this.cacheManager.getAllMetadata();
      if (cachedVideos.length > 0) {
        console.log(`Loaded ${cachedVideos.length} cached videos`);
        // Convert metadata to creatives for playback
        const creatives: Creative[] = cachedVideos.map((meta) => ({
          id: meta.id,
          url: meta.url,
          duration: meta.duration,
          campaignId: meta.campaignId,
          campaignName: meta.campaignName,
        }));
        await this.videoManager.updatePlaylist(creatives);
      }
    } catch (error) {
      console.error('Failed to load cached videos:', error);
    }
  }

  private handleVideoEvent(event: any): void {
    switch (event.type) {
      case 'play':
        this.state.isPlaying = true;
        this.state.currentVideo = event.video;
        // Report impression when video starts playing
        this.impressionTracker.reportImpression(event.video.id);
        break;
      case 'pause':
        this.state.isPlaying = false;
        break;
      case 'ended':
        this.state.isPlaying = false;
        // Video will automatically play next due to video manager logic
        break;
      case 'loadstart':
        console.log(`Loading video: ${event.video.id}`);
        break;
      case 'loadeddata':
        console.log(`Video loaded: ${event.video.id}`);
        break;
    }
  }

  private handleVideoLoaded(data: any): void {
    console.log(`Video loaded: ${data.video.id} (from cache: ${data.fromCache})`);
  }

  private handleError(error: AppError): void {
    console.error('App error:', error);
    this.state.errorCount++;

    // Handle different error types
    switch (error.type) {
      case ERROR_TYPES.VIDEO:
        // Video errors are handled by video manager
        break;
      case ERROR_TYPES.NETWORK:
        // Network errors are handled by impression tracker
        break;
      case ERROR_TYPES.MANIFEST:
        // Continue with cached videos if manifest fails
        break;
      case ERROR_TYPES.STORAGE:
        // Storage errors might require cache cleanup
        this.handleStorageError();
        break;
    }
  }

  private async handleStorageError(): Promise<void> {
    try {
      const stats = await this.cacheManager.getStorageStats();
      console.log('Storage stats:', stats);

      if (stats.availableSpace < 100 * 1024 * 1024) {
        // Less than 100MB
        console.log('Low storage space, cleaning up cache...');
        // The cache manager will handle cleanup automatically
      }
    } catch (error) {
      console.error('Failed to handle storage error:', error);
    }
  }

  private handleOnline(): void {
    this.state.isOnline = true;
    console.log('Network connection restored');
    // Resume normal operations
    this.pollManifest();
  }

  private handleOffline(): void {
    this.state.isOnline = false;
    console.log('Network connection lost, continuing with cached videos');
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('App hidden, pausing video');
      this.videoManager.pause();
    } else {
      console.log('App visible, resuming video');
      this.videoManager.play();
    }
  }

  // Public methods
  getState(): AppState {
    return { ...this.state };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  async getHealthStatus(): Promise<any> {
    const impressionHealth = await this.impressionTracker.healthCheck();
    const storageStats = await this.cacheManager.getStorageStats();

    return {
      app: {
        initialized: this.isInitialized,
        online: this.state.isOnline,
        playing: this.state.isPlaying,
        errorCount: this.state.errorCount,
        lastManifestUpdate: this.state.lastManifestUpdate,
      },
      video: {
        currentVideo: this.state.currentVideo,
        playlistLength: this.state.playlist.length,
        currentIndex: this.state.currentIndex,
      },
      storage: storageStats,
      impressions: impressionHealth,
    };
  }

  // Manual controls
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
    this.videoManager.playNext();
  }

  // Cleanup
  destroy(): void {
    if (this.manifestPoller) {
      clearInterval(this.manifestPoller);
      this.manifestPoller = null;
    }

    this.videoManager.destroy();
    this.impressionTracker.destroy();
    this.cacheManager.clearAll();

    this.isInitialized = false;
    console.log('Street Cast App destroyed');
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new StreetCastApp();
  await app.initialize();

  // Make app available globally for debugging
  (window as any).streetCastApp = app;
});
