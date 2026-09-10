import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { MessageAccessService } from "./message-access";

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessageAccessService],
  // MessagesService is exported so the family portal can reach the CARE_SEEKER
  // thread through the same service, rather than writing messages of its own.
  exports: [MessageAccessService, MessagesService],
})
export class MessagesModule {}
