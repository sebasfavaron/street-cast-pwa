import Dexie, { Table } from 'dexie';
import { CachedVideo, VideoMetadata, StorageStats } from '@/types';

// IndexedDB Database Schema
class VideoCache extends Dexie {
  videos!: Table<CachedVideo>;
  metadata!: Table<VideoMetadata>;

  constructor() {
    super('VideoCache');
    this.version(1).stores({
      videos: 'id, url, downloadedAt, expiresAt, size',
      metadata: 'id, campaignId, downloadedAt, expiresAt',
    });
  }
}

export class CacheManager {
  private db = new VideoCache();
  private readonly MAX_CACHE_SIZE: number;
  private readonly MAX_VIDEOS: number;

  constructor(maxCacheSize: number = 2 * 1024 * 1024 * 1024, maxVideos: number = 10) {
    this.MAX_CACHE_SIZE = maxCacheSize;
    this.MAX_VIDEOS = maxVideos;
  }

  async cacheVideo(creative: any, videoBlob: Blob): Promise<void> {
    const cachedVideo: CachedVideo = {
      id: creative.id,
      url: creative.url,
      blob: videoBlob,
      downloadedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      size: videoBlob.size,
    };

    const metadata: VideoMetadata = {
      id: creative.id,
      url: creative.url,
      duration: creative.duration,
      campaignId: creative.campaignId,
      campaignName: creative.campaignName,
      downloadedAt: cachedVideo.downloadedAt,
      expiresAt: cachedVideo.expiresAt,
      size: cachedVideo.size,
    };

    await this.db.transaction('rw', [this.db.videos, this.db.metadata], async () => {
      await this.db.videos.put(cachedVideo);
      await this.db.metadata.put(metadata);
    });

    await this.cleanupCache();
  }

  async getVideo(id: string): Promise<CachedVideo | undefined> {
    const video = await this.db.videos.get(id);
    if (video && video.expiresAt > Date.now()) {
      return video;
    }
    return undefined;
  }

  async getVideoMetadata(id: string): Promise<VideoMetadata | undefined> {
    return await this.db.metadata.get(id);
  }

  async getAllVideos(): Promise<CachedVideo[]> {
    const now = Date.now();
    return await this.db.videos.where('expiresAt').above(now).toArray();
  }

  async getAllMetadata(): Promise<VideoMetadata[]> {
    const now = Date.now();
    return await this.db.metadata.where('expiresAt').above(now).toArray();
  }

  async removeVideo(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.videos, this.db.metadata], async () => {
      await this.db.videos.delete(id);
      await this.db.metadata.delete(id);
    });
  }

  async getStorageStats(): Promise<StorageStats> {
    const videos = await this.getAllVideos();
    const totalSize = videos.reduce((sum, video) => sum + video.size, 0);
    const availableSpace = this.MAX_CACHE_SIZE - totalSize;

    return {
      totalSize,
      videoCount: videos.length,
      availableSpace,
      oldestVideo: videos.length > 0 ? Math.min(...videos.map((v) => v.downloadedAt)) : 0,
      newestVideo: videos.length > 0 ? Math.max(...videos.map((v) => v.downloadedAt)) : 0,
    };
  }

  private async cleanupCache(): Promise<void> {
    const videos = await this.db.videos.toArray();

    // Remove expired videos first
    const now = Date.now();
    const expiredVideos = videos.filter((video) => video.expiresAt <= now);
    if (expiredVideos.length > 0) {
      await this.db.videos.bulkDelete(expiredVideos.map((v) => v.id));
      await this.db.metadata.bulkDelete(expiredVideos.map((v) => v.id));
    }

    // Check if we still need to clean up
    const remainingVideos = (await this.db.videos.toArray()).sort(
      (a, b) => a.downloadedAt - b.downloadedAt
    );
    let projectedSize = remainingVideos.reduce((sum, video) => sum + video.size, 0);

    if (projectedSize > this.MAX_CACHE_SIZE || remainingVideos.length > this.MAX_VIDEOS) {
      const videosToDelete = [];
      while (
        remainingVideos.length - videosToDelete.length > this.MAX_VIDEOS ||
        projectedSize > this.MAX_CACHE_SIZE
      ) {
        const candidate: CachedVideo | undefined = remainingVideos[videosToDelete.length];
        if (!candidate) break;
        videosToDelete.push(candidate);
        projectedSize -= candidate.size;
      }

      await this.db.videos.bulkDelete(videosToDelete.map((v) => v.id));
      await this.db.metadata.bulkDelete(videosToDelete.map((v) => v.id));
    }
  }

  async clearAll(): Promise<void> {
    await this.db.transaction('rw', [this.db.videos, this.db.metadata], async () => {
      await this.db.videos.clear();
      await this.db.metadata.clear();
    });
  }

  async isVideoCached(id: string): Promise<boolean> {
    const video = await this.getVideo(id);
    return video !== undefined;
  }

  async getVideoUrl(id: string): Promise<string | null> {
    const video = await this.getVideo(id);
    if (video) {
      return URL.createObjectURL(video.blob);
    }
    return null;
  }

  // Clean up object URLs to prevent memory leaks
  revokeVideoUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
