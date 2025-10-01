import { VideoManager } from '@/video-manager';
import { CacheManager } from '@/utils/storage';

// Mock CacheManager
jest.mock('@/utils/storage', () => ({
  CacheManager: jest.fn().mockImplementation(() => ({
    getVideoUrl: jest.fn(),
    cacheVideo: jest.fn(),
    isVideoCached: jest.fn(),
  })),
}));

describe('VideoManager', () => {
  let videoManager: VideoManager;
  let mockCacheManager: jest.Mocked<CacheManager>;

  beforeEach(() => {
    mockCacheManager = new CacheManager() as jest.Mocked<CacheManager>;
    videoManager = new VideoManager(mockCacheManager);
  });

  afterEach(() => {
    videoManager.destroy();
  });

  test('should create video element with correct properties', () => {
    const videoElement = videoManager.getVideoElement();
    expect(videoElement.tagName).toBe('VIDEO');
    expect(videoElement.autoplay).toBe(true);
    expect(videoElement.muted).toBe(true);
    expect(videoElement.loop).toBe(false);
  });

  test('should update playlist correctly', async () => {
    const creatives = [
      {
        id: '1',
        url: 'http://example.com/video1.mp4',
        duration: 30,
        campaignId: 'c1',
        campaignName: 'Campaign 1',
      },
      {
        id: '2',
        url: 'http://example.com/video2.mp4',
        duration: 60,
        campaignId: 'c2',
        campaignName: 'Campaign 2',
      },
    ];

    await videoManager.updatePlaylist(creatives);

    expect(videoManager.getPlaylist()).toEqual(creatives);
    expect(videoManager.getCurrentIndex()).toBe(0);
  });

  test('should handle video events', () => {
    const mockCallback = jest.fn();
    videoManager.on('videoEvent', mockCallback);

    // Simulate video play event
    const videoElement = videoManager.getVideoElement();
    videoElement.dispatchEvent(new Event('play'));

    expect(mockCallback).toHaveBeenCalled();
  });
});
