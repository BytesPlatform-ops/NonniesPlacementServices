import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { MessageAccessService } from "./message-access";

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessageAccessService],
  exports: [MessageAccessService],
})
export class MessagesModule {}
