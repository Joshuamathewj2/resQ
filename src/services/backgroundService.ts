import { registerPlugin } from '@capacitor/core';

export interface BackgroundServicePlugin {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
}

export const BackgroundService = registerPlugin<BackgroundServicePlugin>(
  'BackgroundService',
  {
    web: {
      startMonitoring: async () => {
        // eslint-disable-next-line no-console
        console.log('[Web] Background monitoring started');
      },
      stopMonitoring: async () => {
        // eslint-disable-next-line no-console
        console.log('[Web] Background monitoring stopped');
      },
    },
  }
);
