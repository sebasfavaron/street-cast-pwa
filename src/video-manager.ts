import { Creative, VideoEvent, AppError, ERROR_TYPES } from '@/types';
import { CacheManager } from '@/utils/storage';

export class VideoManager {
  private videoElement: HTMLVideoElement;
  private playlist: Creative[] = [];
  private currentIndex = 0;
  private currentVideo: Creative | null = null;
  private cacheManager: CacheManager;
  private isPreloading = false;
  private eventListeners: Map<string, Function[]> = new Map();

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
    video.controls = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    return video;
  }

  private setupEventListeners(): void {
    this.videoElement.addEventListener('play', () => this.handleVideoEvent('play'));
    this.videoElement.addEventListener('pause', () => this.handleVideoEvent('pause'));
    this.videoElement.addEventListener('ended', () => this.handleVideoEvent('ended'));
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
    this.playlist = creatives;
    this.currentIndex = 0;

    // Start downloading videos in background
    this.preloadVideos();

    // Start playing if we have videos
    if (this.playlist.length > 0) {
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
    // Check if video is cached
    const cachedUrl = await this.cacheManager.getVideoUrl(video.id);

    if (cachedUrl) {
      this.videoElement.src = cachedUrl;
      this.emit('videoLoaded', { video, fromCache: true });
    } else {
      // Download and cache video
      await this.downloadAndCacheVideo(video);
      const newCachedUrl = await this.cacheManager.getVideoUrl(video.id);
      if (newCachedUrl) {
        this.videoElement.src = newCachedUrl;
        this.emit('videoLoaded', { video, fromCache: false });
      } else {
        throw new Error('Failed to get cached video URL');
      }
    }
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
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
      this.playNext();
    }
  }

  // Public methods
  play(): void {
    this.videoElement.play();
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
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  // Cleanup
  destroy(): void {
    this.videoElement.remove();
    this.eventListeners.clear();
  }
}
