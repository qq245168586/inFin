import { Module } from "@nestjs/common";
import { StoreGateway, getDefaultStoreGateway } from "./store-gateway.js";

@Module({
  providers: [
    {
      provide: StoreGateway,
      useFactory: getDefaultStoreGateway
    }
  ],
  exports: [StoreGateway]
})
export class DatabaseModule {}
