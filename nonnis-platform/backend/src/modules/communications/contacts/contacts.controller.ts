import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import type { PaginatedResult } from "../../../common/types/api-response";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { ContactsService, type ContactCounts } from "./contacts.service";
import type { ContactView } from "../communications.serializer";
import { CreateContactDto, ListContactsDto, SetConsentDto, UpdateContactDto } from "../dto/contacts.dto";

@Controller("communications/contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListContactsDto): Promise<PaginatedResult<ContactView>> {
    return this.contacts.list(query);
  }

  @Get("counts")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  counts(): Promise<ContactCounts> {
    return this.contacts.counts();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<ContactView> {
    return this.contacts.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateContactDto): Promise<ContactView> {
    return this.contacts.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateContactDto): Promise<ContactView> {
    return this.contacts.update(user, id, dto);
  }

  @Post(":id/consent")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  setConsent(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: SetConsentDto): Promise<ContactView> {
    return this.contacts.setConsent(user, id, dto);
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  archive(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<ContactView> {
    return this.contacts.archive(user, id);
  }
}
