import { DEFAULT_CONFIG } from '@/types';
import {
  getQueryConfig,
  resolveConfigFromSources,
  syncUrlWithConfig,
} from '@/runtime-config';

describe('app config', () => {
  test('uses query deviceId when present', () => {
    const config = resolveConfigFromSources({
      overrides: {},
      storedConfig: {},
      envConfig: {},
      runtimeConfig: {},
      queryConfig: getQueryConfig('?deviceId=tv-demo-01'),
    });

    expect(config.deviceId).toBe('tv-demo-01');
  });

  test('writes missing defaults into the URL', () => {
    const config = resolveConfigFromSources({
      overrides: {},
      storedConfig: {},
      envConfig: {},
      runtimeConfig: {},
      queryConfig: getQueryConfig(''),
    });
    const nextUrl = syncUrlWithConfig(config, 'https://example.com/player');
    const params = new URL(nextUrl, 'https://example.com').searchParams;

    expect(params.get('deviceId')).toBe(config.deviceId);
    expect(params.get('serverUrl')).toBe(config.serverUrl);
    expect(params.get('pollInterval')).toBe(String(config.pollInterval));
    expect(params.get('cacheSize')).toBe(String(config.cacheSize));
    expect(params.get('maxVideos')).toBe(String(config.maxVideos));
    expect(params.get('deviceId')).toBe(DEFAULT_CONFIG.deviceId);
  });
});
