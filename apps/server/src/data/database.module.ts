import { Module } from "@nestjs/common";
import { LegacyStoreGateway, getDefaultLegacyStoreGateway } from "./legacy-store-gateway.js";

@Module({
  providers: [
    {
      provide: LegacyStoreGateway,
      useFactory: getDefaultLegacyStoreGateway
    }
  ],
  exports: [LegacyStoreGateway]
})
export class DatabaseModule {}
