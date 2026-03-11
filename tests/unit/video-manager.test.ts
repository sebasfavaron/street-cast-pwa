import { VideoManager } from '@/video-manager';
import { CacheManager } from '@/utils/storage';

// Mock CacheManager
jest.mock('@/utils/storage', () => ({
  CacheManager: jest.fn().mockImplementation(() => ({
    getVideoUrl: jest.fn(),
    cacheVideo: jest.fn(),
    isVideoCached: jest.fn(),
    revokeVideoUrl: jest.fn(),
  })),
}));

describe('VideoManager', () => {
  let videoManager: VideoManager;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let getVideoUrl: jest.Mock;

  beforeEach(() => {
    mockCacheManager = new CacheManager() as jest.Mocked<CacheManager>;
    getVideoUrl = mockCacheManager.getVideoUrl as jest.Mock;
    getVideoUrl.mockResolvedValue('mock-object-url');
    (mockCacheManager.isVideoCached as jest.Mock).mockResolvedValue(true);
    (mockCacheManager.revokeVideoUrl as jest.Mock).mockImplementation(() => undefined);
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
    expect(videoManager.getCurrentIndex()).toBe(1);
  });

  test('should handle video events for the current video', async () => {
    const mockCallback = jest.fn();
    videoManager.on('videoEvent', mockCallback);
    await videoManager.updatePlaylist([
      {
        id: '1',
        url: 'http://example.com/video1.mp4',
        duration: 30,
        campaignId: 'c1',
        campaignName: 'Campaign 1',
      },
    ]);

    // Simulate video play event
    const videoElement = videoManager.getVideoElement();
    videoElement.dispatchEvent(new Event('play'));

    expect(mockCallback).toHaveBeenCalled();
  });

  test('should advance to the next video when playback ends', async () => {
    await videoManager.updatePlaylist([
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
    ]);

    const videoElement = videoManager.getVideoElement();
    videoElement.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(videoManager.getCurrentVideo()?.id).toBe('2');
  });
});
