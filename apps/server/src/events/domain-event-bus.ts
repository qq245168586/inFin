import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";

export type DomainEventPayload = Record<string, unknown>;

export type DomainEvent = {
  type: string;
  payload: DomainEventPayload;
  occurredAt: string;
};

type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

@Injectable()
export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  emit(type: string, payload: DomainEventPayload = {}) {
    const event: DomainEvent = {
      type,
      payload,
      occurredAt: new Date().toISOString()
    };
    this.emitter.emit(type, event);
    this.emitter.emit("*", event);
    return event;
  }

  on(type: string, handler: DomainEventHandler) {
    const wrapped = (event: DomainEvent) => {
      void handler(event);
    };
    this.emitter.on(type, wrapped);
    return () => this.emitter.off(type, wrapped);
  }
}
