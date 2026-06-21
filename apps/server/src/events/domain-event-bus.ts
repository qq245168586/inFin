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

  /**
   * 返回领域事件流，供需要响应业务事件的模块订阅。
   */
  events() {
    return this.stream.asObservable();
  }

  /**
   * 发布领域事件，并补齐统一的发生时间。
   */
  emit(type: string, payload: DomainEventPayload = {}) {
    const event: DomainEvent = {
      type,
      payload,
      occurredAt: new Date().toISOString()
    };
    this.stream.next(event);
    return event;
  }

  /**
   * 订阅指定领域事件，返回取消订阅函数。
   */
  on(type: string, handler: DomainEventHandler) {
    const subscription = this.stream
      .pipe(filter((event) => type === "*" || event.type === type))
      .subscribe((event) => {
        void handler(event);
      });
    return () => subscription.unsubscribe();
  }
}
