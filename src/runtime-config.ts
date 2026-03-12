import { AppConfig, DEFAULT_CONFIG, RuntimeConfigSource } from './types';

export const DEFAULT_REMOTE_SERVER_URL = 'https://street-cast-server.vercel.app';
export const CONFIG_URL_PARAM_MAP = {
  deviceId: 'deviceId',
  serverUrl: 'serverUrl',
  pollInterval: 'pollInterval',
  cacheSize: 'cacheSize',
  maxVideos: 'maxVideos',
} as const;

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
        inferredLocalServerUrl,
        DEFAULT_REMOTE_SERVER_URL,
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

export function syncUrlWithConfig(config: AppConfig, locationHref: string): string {
  const url = new URL(locationHref);
  let didChange = false;

  for (const [configKey, paramKey] of Object.entries(CONFIG_URL_PARAM_MAP) as Array<
    [keyof AppConfig, string]
  >) {
    if (url.searchParams.has(paramKey)) {
      continue;
    }

    url.searchParams.set(paramKey, String(config[configKey]));
    didChange = true;
  }

  return didChange ? `${url.pathname}${url.search}${url.hash}` : `${url.pathname}${url.search}${url.hash}`;
}
