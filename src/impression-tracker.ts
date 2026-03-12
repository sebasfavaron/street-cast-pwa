import { ImpressionRequest, AppConfig } from '@/types';

const RETRY_QUEUE_KEY = 'impression-retry-queue';
const RETRY_QUEUE_CONFIG_KEY = 'impression-retry-queue-config';

function getApiBaseUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

export class ImpressionTracker {
  private config: AppConfig;
  private retryQueue: ImpressionRequest[] = [];
  private isProcessing = false;
  private retryAttempts = new Map<string, number>();
  private readonly MAX_RETRIES = 3;

  constructor(config: AppConfig) {
    this.config = config;
    this.loadRetryQueue();
    this.startRetryProcessor();
  }

  async reportImpression(creativeId: string): Promise<void> {
    const impression: ImpressionRequest = {
      deviceId: this.config.deviceId,
      creativeId,
      timestamp: Date.now(),
    };

    try {
      await this.sendImpression(impression);
      console.log(`Impression reported for creative ${creativeId}`);
    } catch (error) {
      console.warn(`Failed to report impression for creative ${creativeId}:`, error);
      this.addToRetryQueue(impression);
    }
  }

  private async sendImpression(impression: ImpressionRequest): Promise<void> {
    const url = `${getApiBaseUrl(this.config.serverUrl)}/api/impression`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(impression),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private addToRetryQueue(impression: ImpressionRequest): void {
    // Don't add duplicates
    if (
      this.retryQueue.some(
        (item) =>
          item.deviceId === impression.deviceId &&
          item.creativeId === impression.creativeId &&
          item.timestamp === impression.timestamp
      )
    ) {
      return;
    }

    this.retryQueue.push(impression);
    this.saveRetryQueue();
  }

  private async startRetryProcessor(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.isProcessing) {
      if (this.retryQueue.length > 0) {
        await this.processRetryQueue();
      }

      // Wait before next retry cycle
      await this.delay(5000); // 5 seconds
    }
  }

  private async processRetryQueue(): Promise<void> {
    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const impression of queue) {
      const key = `${impression.deviceId}-${impression.creativeId}-${impression.timestamp ?? 0}`;
      const attempts = this.retryAttempts.get(key) || 0;

      if (attempts >= this.MAX_RETRIES) {
        console.error(`Max retries exceeded for impression ${key}`);
        this.retryAttempts.delete(key);
        continue;
      }

      try {
        await this.sendImpression(impression);
        this.retryAttempts.delete(key);
        console.log(`Successfully sent retry impression for ${key}`);
      } catch (error) {
        console.warn(`Retry failed for impression ${key} (attempt ${attempts + 1}):`, error);

        // Add back to queue with exponential backoff
        this.retryAttempts.set(key, attempts + 1);
        this.retryQueue.push(impression);
      }
    }

    this.saveRetryQueue();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private loadRetryQueue(): void {
    try {
      const currentApiBaseUrl = getApiBaseUrl(this.config.serverUrl);
      const storedApiBaseUrl = localStorage.getItem(RETRY_QUEUE_CONFIG_KEY);

      if (storedApiBaseUrl && storedApiBaseUrl !== currentApiBaseUrl) {
        localStorage.removeItem(RETRY_QUEUE_KEY);
      }

      localStorage.setItem(RETRY_QUEUE_CONFIG_KEY, currentApiBaseUrl);

      const stored = localStorage.getItem(RETRY_QUEUE_KEY);
      if (stored) {
        this.retryQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load retry queue:', error);
      this.retryQueue = [];
    }
  }

  private saveRetryQueue(): void {
    try {
      localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(this.retryQueue));
      localStorage.setItem(RETRY_QUEUE_CONFIG_KEY, getApiBaseUrl(this.config.serverUrl));
    } catch (error) {
      console.error('Failed to save retry queue:', error);
    }
  }

  // Public methods
  getRetryQueueLength(): number {
    return this.retryQueue.length;
  }

  clearRetryQueue(): void {
    this.retryQueue = [];
    this.retryAttempts.clear();
    this.saveRetryQueue();
  }

  getRetryStats(): { queueLength: number; attempts: Record<string, number> } {
    return {
      queueLength: this.retryQueue.length,
      attempts: Object.fromEntries(this.retryAttempts),
    };
  }

  // Batch impression reporting for efficiency
  async reportBatchImpressions(impressions: ImpressionRequest[]): Promise<void> {
    const url = `${getApiBaseUrl(this.config.serverUrl)}/api/impressions/batch`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ impressions }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`Batch reported ${impressions.length} impressions`);
    } catch (error) {
      console.warn('Failed to report batch impressions:', error);
      // Add individual impressions to retry queue
      impressions.forEach((impression) => this.addToRetryQueue(impression));
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const url = `${getApiBaseUrl(this.config.serverUrl)}/api/health`;
      const response = await fetch(url, { method: 'GET' });

      if (response.ok) {
        return {
          status: 'healthy',
          details: { retryQueueLength: this.retryQueue.length },
        };
      } else {
        return {
          status: 'degraded',
          details: {
            httpStatus: response.status,
            retryQueueLength: this.retryQueue.length,
          },
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          retryQueueLength: this.retryQueue.length,
        },
      };
    }
  }

  // Cleanup
  destroy(): void {
    this.isProcessing = false;
    this.saveRetryQueue();
  }
}
