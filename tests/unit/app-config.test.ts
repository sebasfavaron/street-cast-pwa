import {
  getQueryConfig,
  resolveConfigFromSources,
  syncUrlWithDefaults,
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

  test('writes only required defaults into the URL', () => {
    const config = resolveConfigFromSources({
      overrides: {},
      storedConfig: {},
      envConfig: {},
      runtimeConfig: {},
      queryConfig: getQueryConfig(''),
    });
    const nextUrl = syncUrlWithDefaults('https://example.com/player');
    const params = new URL(nextUrl, 'https://example.com').searchParams;

    expect(config.deviceId).toBe('dev-device-1');
    expect(config.serverUrl).toBe('https://street-cast-server.vercel.app');
    expect(params.get('deviceId')).toBe('dev-device-1');
    expect(params.get('serverUrl')).toBe('https://street-cast-server.vercel.app');
    expect(params.get('debug')).toBe('true');
    expect(params.has('pollInterval')).toBe(false);
    expect(params.has('cacheSize')).toBe(false);
    expect(params.has('maxVideos')).toBe(false);
  });
});
