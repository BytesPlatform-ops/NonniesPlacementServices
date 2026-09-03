import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { IsString, IsUUID, MaxLength } from "class-validator";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { TagsService } from "./tags.service";
import { CreateTagDto } from "../dto/tags.dto";

class AssignTagBody {
  @IsUUID() contactId!: string;
  @IsString() @MaxLength(80) name!: string;
}
class UnassignTagBody {
  @IsUUID() contactId!: string;
  @IsUUID() tagId!: string;
}

@Controller("communications/tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_READ)
  list() {
    return this.tags.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  create(@Body() dto: CreateTagDto) {
    return this.tags.create(dto.name);
  }

  @Post("assign")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  assign(@CurrentUser() user: RequestUser, @Body() body: AssignTagBody) {
    return this.tags.assign(user, body.contactId, body.name);
  }

  @Post("unassign")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  unassign(@CurrentUser() user: RequestUser, @Body() body: UnassignTagBody) {
    return this.tags.unassign(user, body.contactId, body.tagId);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_MANAGE)
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.tags.remove(id);
  }
}
