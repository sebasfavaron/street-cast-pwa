import { Creative, VideoEvent, AppError, ERROR_TYPES } from '@/types';
import { CacheManager } from '@/utils/storage';

type EventCallback = (data?: unknown) => void;

export class VideoManager {
  private videoElement: HTMLVideoElement;
  private playlist: Creative[] = [];
  private currentIndex = 0;
  private currentVideo: Creative | null = null;
  private cacheManager: CacheManager;
  private isPreloading = false;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private activeObjectUrl: string | null = null;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
    this.videoElement = this.createVideoElement();
    this.setupEventListeners();
  }

  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.loop = false;
    video.playsInline = true;
    video.preload = 'auto';
    video.controls = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    return video;
  }

  private setupEventListeners(): void {
    this.videoElement.addEventListener('play', () => this.handleVideoEvent('play'));
    this.videoElement.addEventListener('pause', () => this.handleVideoEvent('pause'));
    this.videoElement.addEventListener('ended', () => {
      this.handleVideoEvent('ended');
      this.skipToNext();
    });
    this.videoElement.addEventListener('error', (e) => this.handleVideoError(e));
    this.videoElement.addEventListener('loadstart', () => this.handleVideoEvent('loadstart'));
    this.videoElement.addEventListener('loadeddata', () => this.handleVideoEvent('loadeddata'));
  }

  private handleVideoEvent(type: VideoEvent['type']): void {
    if (this.currentVideo) {
      const event: VideoEvent = {
        type,
        video: this.currentVideo,
        timestamp: Date.now(),
      };
      this.emit('videoEvent', event);
    }
  }

  private handleVideoError(event: Event): void {
    const error = event as ErrorEvent;
    const appError: AppError = {
      type: ERROR_TYPES.VIDEO,
      message: `Video playback error: ${error.message}`,
      timestamp: Date.now(),
      details: {
        video: this.currentVideo,
        error: error.error,
      },
    };
    this.emit('error', appError);
    this.skipToNext();
  }

  async updatePlaylist(creatives: Creative[]): Promise<void> {
    const nextSignature = creatives.map((creative) => creative.id).join('|');
    const currentSignature = this.playlist.map((creative) => creative.id).join('|');

    this.playlist = creatives;
    if (nextSignature !== currentSignature) {
      this.currentIndex = 0;
    }

    // Start downloading videos in background
    void this.preloadVideos();

    // Start playing if we have videos
    if (this.playlist.length > 0 && !this.currentVideo) {
      await this.playNext();
    }
  }

  async playNext(): Promise<void> {
    if (this.playlist.length === 0) return;

    const video = this.playlist[this.currentIndex];
    this.currentVideo = video;

    try {
      await this.loadVideo(video);
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    } catch (error) {
      console.error('Failed to load video:', error);
      this.skipToNext();
    }
  }

  private async loadVideo(video: Creative): Promise<void> {
    this.releaseActiveObjectUrl();

    // Check if video is cached
    const cachedUrl = await this.cacheManager.getVideoUrl(video.id);

    if (cachedUrl) {
      this.activeObjectUrl = cachedUrl;
      this.videoElement.src = cachedUrl;
      this.emit('videoLoaded', { video, fromCache: true });
    } else {
      try {
        await this.downloadAndCacheVideo(video);
        const newCachedUrl = await this.cacheManager.getVideoUrl(video.id);
        if (newCachedUrl) {
          this.activeObjectUrl = newCachedUrl;
          this.videoElement.src = newCachedUrl;
          this.emit('videoLoaded', { video, fromCache: false });
        } else {
          throw new Error('Failed to get cached video URL');
        }
      } catch (error) {
        console.warn('Falling back to remote playback for video', video.id, error);
        this.videoElement.src = video.url;
        this.emit('videoLoaded', { video, fromCache: false, fallback: 'remote' });
      }
    }

    this.videoElement.load();
    await this.videoElement.play();
  }

  private async downloadAndCacheVideo(video: Creative): Promise<void> {
    try {
      const response = await fetch(video.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Validate video format
      if (!this.isValidVideoFormat(blob.type)) {
        throw new Error(`Unsupported video format: ${blob.type}`);
      }

      await this.cacheManager.cacheVideo(video, blob);
    } catch (error) {
      const appError: AppError = {
        type: ERROR_TYPES.VIDEO,
        message: `Failed to download video: ${error}`,
        timestamp: Date.now(),
        details: { video, error },
      };
      this.emit('error', appError);
      throw error;
    }
  }

  private isValidVideoFormat(mimeType: string): boolean {
    const validTypes = ['video/mp4', 'video/mpeg4', 'video/x-m4v'];
    return validTypes.includes(mimeType);
  }

  private async preloadVideos(): Promise<void> {
    if (this.isPreloading || this.playlist.length === 0) return;

    this.isPreloading = true;

    try {
      // Preload next few videos
      const videosToPreload = this.playlist.slice(0, Math.min(3, this.playlist.length));

      for (const video of videosToPreload) {
        const isCached = await this.cacheManager.isVideoCached(video.id);
        if (!isCached) {
          try {
            await this.downloadAndCacheVideo(video);
          } catch (error) {
            console.warn(`Failed to preload video ${video.id}:`, error);
          }
        }
      }
    } finally {
      this.isPreloading = false;
    }
  }

  private skipToNext(): void {
    if (this.playlist.length > 0) {
      this.releaseActiveObjectUrl();
      void this.playNext();
    }
  }

  // Public methods
  play(): void {
    void this.videoElement.play();
  }

  pause(): void {
    this.videoElement.pause();
  }

  stop(): void {
    this.videoElement.pause();
    this.videoElement.currentTime = 0;
  }

  getCurrentVideo(): Creative | null {
    return this.currentVideo;
  }

  getPlaylist(): Creative[] {
    return [...this.playlist];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  isPlaying(): boolean {
    return !this.videoElement.paused && !this.videoElement.ended;
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  // Event system
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  private releaseActiveObjectUrl(): void {
    if (this.activeObjectUrl) {
      this.cacheManager.revokeVideoUrl(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }

  // Cleanup
  destroy(): void {
    this.releaseActiveObjectUrl();
    this.videoElement.remove();
    this.eventListeners.clear();
  }
}
