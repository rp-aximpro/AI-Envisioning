import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { ensureStorageBucket } from './object-storage.js';

@Injectable()
export class StorageBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageBootstrapService.name);

  async onApplicationBootstrap(): Promise<void> {
    await ensureStorageBucket({
      info: (messageOrObject: unknown, message?: string) => {
        this.logger.log(message ?? JSON.stringify(messageOrObject));
      },
      warn: (messageOrObject: unknown, message?: string) => {
        this.logger.warn(message ?? JSON.stringify(messageOrObject));
      },
    });
  }
}
