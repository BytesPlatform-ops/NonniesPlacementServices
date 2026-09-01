import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBooleanString, IsOptional } from "class-validator";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { ListsService } from "./lists.service";
import { AddMembersDto, CreateListDto, ListMembersQueryDto, UpdateListDto } from "../dto/lists.dto";
import { ListContactsDto } from "../dto/contacts.dto";

class ListListsQueryDto extends ListMembersQueryDto {
  @IsOptional() @IsBooleanString() @Transform(({ value }) => value) activeOnly?: string;
}

@Controller("communications/lists")
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list(@Query() query: ListListsQueryDto) {
    return this.lists.list({ page: query.page, pageSize: query.pageSize, search: query.search, activeOnly: query.activeOnly === "true" });
  }

  @Get("options")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  options() {
    return this.lists.options();
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.lists.findOne(id);
  }

  @Get(":id/members")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  members(@Param("id", new ParseUUIDPipe()) id: string, @Query() query: ListContactsDto) {
    return this.lists.members(id, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateListDto) {
    return this.lists.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  update(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateListDto) {
    return this.lists.update(user, id, dto);
  }

  @Post(":id/members")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  addMembers(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: AddMembersDto) {
    return this.lists.addMembers(user, id, dto);
  }

  @Delete(":id/members/:contactId")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  removeMember(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string, @Param("contactId", new ParseUUIDPipe()) contactId: string) {
    return this.lists.removeMember(user, id, contactId);
  }
}
