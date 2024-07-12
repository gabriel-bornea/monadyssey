import { getLogger, Logger } from "./logger.ts";

export type OnEvent<DetailType = unknown> = (detail: DetailType) => Promise<void>;

export interface EventSchema {
  [address: string]: unknown;
}

export class QueuedEvent<Ev> {
  private readonly _id: string;
  public readonly address: keyof Ev;
  public readonly detail: Ev[keyof Ev];
  public retries: number;

  constructor(address: keyof Ev, detail: Ev[keyof Ev], retries: number = 0) {
    this._id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.address = address;
    this.detail = detail;
    this.retries = retries;
  }

  get id(): string {
    return this._id;
  }
}

export interface PersistentStorage<Ev> {
  store(event: QueuedEvent<Ev>): Promise<void>;
  retrieve(): Promise<QueuedEvent<Ev>[]>;
  remove(event: QueuedEvent<Ev>): Promise<void>;
}

class InMemoryStorage<Ev extends EventSchema> implements PersistentStorage<Ev> {
  private storage: QueuedEvent<Ev>[] = [];

  async store(event: QueuedEvent<Ev>): Promise<void> {
    this.storage.push(event);
  }

  async retrieve(): Promise<QueuedEvent<Ev>[]> {
    return this.storage;
  }

  async remove(event: QueuedEvent<Ev>): Promise<void> {
    this.storage = this.storage.filter((e) => e.id !== event.id);
  }
}

export class EventBus<Ev extends EventSchema> {
  private readonly listeners: Map<keyof Ev, OnEvent<any>[]> = new Map();
  private readonly eventQueue: QueuedEvent<Ev>[] = [];
  private readonly maxEvents: number;
  private eventCount: number = 0;
  private readonly maxQueueSize: number = 1000;
  private readonly maxRetries: number;
  private readonly storage: PersistentStorage<Ev>;

  private readonly logger: Logger = getLogger();

  constructor(maxEvents: number = 100, maxRetries: number = 3, storage?: PersistentStorage<Ev>) {
    this.maxEvents = maxEvents;
    this.maxRetries = maxRetries;
    this.storage = storage || new InMemoryStorage<Ev>();
    this.initialize().catch((error) => this.logger.error("Failed to initialize EventBus:", error));
  }

  private initialize = async (): Promise<void> => {
    try {
      const events = await this.storage.retrieve();
      this.eventQueue.push(...events);
    } catch (error) {
      this.logger.error("Failed to load persistent events:", error);
    }
  };

  subscribe = <Address extends keyof Ev>(address: Address, onEvent: OnEvent<Ev[Address]>): void => {
    if (!this.listeners.has(address)) {
      this.listeners.set(address, []);
    }
    this.listeners.get(address)?.push(onEvent as OnEvent<any>);
  };

  unsubscribe = <Address extends keyof Ev>(address: Address, onEvent: OnEvent<Ev[Address]>): void => {
    const callbacks = this.listeners.get(address);
    if (callbacks) {
      const idx = callbacks.indexOf(onEvent as OnEvent<any>);
      if (idx > -1) {
        callbacks.splice(idx, 1);
      }
    }
  };

  emit = async <Address extends keyof Ev>(address: Address, detail: Ev[Address]): Promise<void> => {
    if (this.eventCount >= this.maxEvents) {
      await this.queueEvent(new QueuedEvent<Ev>(address, detail));
      return;
    }

    const callbacks = this.listeners.get(address);
    if (callbacks) {
      this.eventCount++;
      const event = new QueuedEvent(address, detail);
      try {
        for (const callback of callbacks) {
          try {
            await callback(detail);
            this.logger.info(`Event ${event.id} processed successfully for address ${address.toString()}`);
          } catch (error) {
            this.logger.error(`Error in event handler for ${address.toString()}:`, error);
            await this.handleFailedEvent(event);
          }
        }
      } finally {
        this.eventCount--;
      }
    } else {
      const event = new QueuedEvent(address, detail);
      await this.handleFailedEvent(event);
    }
  };

  private queueEvent = async (event: QueuedEvent<Ev>): Promise<void> => {
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.logger.warn(`Event queue size exceeded maximum of ${this.maxQueueSize}. Dropping event ${event.id}.`);
      return;
    }
    this.eventQueue.push(event);
    try {
      await this.storage.store(event);
    } catch (error) {
      this.logger.error(`Failed to store event ${event.id}:`, error);
    }
  };

  private handleFailedEvent = async (event: QueuedEvent<Ev>): Promise<void> => {
    event.retries += 1;
    if (event.retries > this.maxRetries) {
      this.logger.error(`Event ${event.id} delivery failed after ${this.maxRetries} retries:`, event);
      try {
        await this.storage.remove(event);
      } catch (error) {
        this.logger.error(`Failed to remove event ${event.id}:`, error);
      }
    } else {
      await this.queueEvent(event);
    }
  };

  flush = async (): Promise<void> => {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      if (event.retries <= this.maxRetries) {
        await this.emit(event.address, event.detail);
        try {
          await this.storage.remove(event);
        } catch (error) {
          this.logger.error(`Failed to remove event ${event.id}:`, error);
        }
      } else {
        this.logger.error(`Event ${event.id} discarded after exceeding max retries:`, event);
      }
    }
  };
}
