import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContactsController } from "./contacts/contacts.controller";
import { ContactsService } from "./contacts/contacts.service";
import { ListsController } from "./lists/lists.controller";
import { ListsService } from "./lists/lists.service";
import { TagsController } from "./tags/tags.controller";
import { TagsService } from "./tags/tags.service";
import { SuppressionsController } from "./suppressions/suppressions.controller";
import { SuppressionsService } from "./suppressions/suppressions.service";
import { ImportsController } from "./imports/imports.controller";
import { ImportsService } from "./imports/imports.service";
import { transportProviders } from "./providers/transport.providers";

/**
 * Communications Phase 15A — a dedicated marketing/outreach contact database
 * (contacts, lists, tags, consent, suppression, imports) plus provider-independent
 * transport ports with mock implementations. No live Brevo/Twilio, no sending.
 */
@Module({
  imports: [AuditModule],
  controllers: [ContactsController, ListsController, TagsController, SuppressionsController, ImportsController],
  providers: [
    ContactsService,
    ListsService,
    TagsService,
    SuppressionsService,
    ImportsService,
    ...transportProviders,
  ],
})
export class CommunicationsModule {}
