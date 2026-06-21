import { Module } from "@nestjs/common";
import { DomainEventBus } from "./domain-event-bus.js";

@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus]
})
export class DomainEventsModule {}
