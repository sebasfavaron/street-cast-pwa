import { AppConfig, DEFAULT_CONFIG, RuntimeConfigSource } from './types';

export const DEFAULT_REMOTE_DEVICE_ID = 'dev-device-1';
export const DEFAULT_REMOTE_SERVER_URL = 'https://street-cast-server.vercel.app';
export const DEFAULT_DEBUG_VALUE = 'true';

export function normalizeServerUrl(value?: string): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export function getNumericOverride(value: string | null | undefined): number | undefined {
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

export function getQueryConfig(search: string): RuntimeConfigSource {
  const params = new URLSearchParams(search);
  return {
    deviceId: params.get('deviceId') ?? params.get('device') ?? undefined,
    serverUrl: params.get('serverUrl') ?? params.get('server') ?? undefined,
    pollInterval: getNumericOverride(params.get('pollInterval')),
    cacheSize: getNumericOverride(params.get('cacheSize')),
    maxVideos: getNumericOverride(params.get('maxVideos')),
  };
}

export function resolveConfigFromSources({
  overrides,
  storedConfig,
  envConfig,
  runtimeConfig,
  queryConfig,
  inferredLocalServerUrl,
}: {
  overrides: Partial<AppConfig>;
  storedConfig: RuntimeConfigSource;
  envConfig: RuntimeConfigSource;
  runtimeConfig: RuntimeConfigSource;
  queryConfig: RuntimeConfigSource;
  inferredLocalServerUrl?: string;
}): AppConfig {
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
          DEFAULT_REMOTE_DEVICE_ID,
          storedConfig.deviceId,
          DEFAULT_CONFIG.deviceId,
        ]
      ) || DEFAULT_CONFIG.deviceId,
    serverUrl: pickFirstNonEmptyString(
      [
        overrides.serverUrl,
        queryConfig.serverUrl,
        runtimeConfig.serverUrl,
        envConfig.serverUrl,
        DEFAULT_REMOTE_SERVER_URL,
        inferredLocalServerUrl,
        storedConfig.serverUrl,
        DEFAULT_CONFIG.serverUrl,
      ],
      normalizeServerUrl
    ),
    pollInterval: coercePositiveNumber(merged.pollInterval, DEFAULT_CONFIG.pollInterval),
    cacheSize: coercePositiveNumber(merged.cacheSize, DEFAULT_CONFIG.cacheSize),
    maxVideos: Math.max(1, Math.floor(coercePositiveNumber(merged.maxVideos, DEFAULT_CONFIG.maxVideos))),
  };
}

export function syncUrlWithDefaults(locationHref: string): string {
  const url = new URL(locationHref);
  if (!url.searchParams.has('deviceId')) {
    url.searchParams.set('deviceId', DEFAULT_REMOTE_DEVICE_ID);
  }
  if (!url.searchParams.has('serverUrl')) {
    url.searchParams.set('serverUrl', DEFAULT_REMOTE_SERVER_URL);
  }
  if (!url.searchParams.has('debug')) {
    url.searchParams.set('debug', DEFAULT_DEBUG_VALUE);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
