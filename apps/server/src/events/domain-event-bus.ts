import { Injectable } from "@nestjs/common";
import { filter, Subject } from "rxjs";

export type DomainEventPayload = Record<string, unknown>;

export type DomainEvent = {
  type: string;
  payload: DomainEventPayload;
  occurredAt: string;
};

type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

@Injectable()
export class DomainEventBus {
  private readonly stream = new Subject<DomainEvent>();

  events() {
    return this.stream.asObservable();
  }

  emit(type: string, payload: DomainEventPayload = {}) {
    const event: DomainEvent = {
      type,
      payload,
      occurredAt: new Date().toISOString()
    };
    this.stream.next(event);
    return event;
  }

  on(type: string, handler: DomainEventHandler) {
    const subscription = this.stream
      .pipe(filter((event) => type === "*" || event.type === type))
      .subscribe((event) => {
        void handler(event);
      });
    return () => subscription.unsubscribe();
  }
}
