import { Module } from "@nestjs/common";
import { DatabaseModule } from "./data/database.module.js";
import { DomainEventsModule } from "./events/domain-events.module.js";

@Module({
  imports: [DatabaseModule, DomainEventsModule]
})
export class AppModule {}
