import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequireAnyPermission, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { UsersService, type InviteResult, type UserListItem } from "./users.service";
import type { UserDetailView } from "./users.serializer";
import {
  ChangeMembershipRoleDto,
  InviteUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
  UserStatusDto,
} from "./dto/user.dto";

const USER_MANAGEMENT = [PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_MANAGE_OWN_ORGANIZATION] as const;

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list(@CurrentUser() user: RequestUser, @Query() query: ListUsersQueryDto): Promise<PaginatedResult<UserListItem>> {
    return this.users.list(user, query);
  }

  @Get("assignable-roles")
  @RequireAnyPermission(...USER_MANAGEMENT)
  assignableRoles(@CurrentUser() user: RequestUser): Promise<Array<{ code: string; name: string }>> {
    return this.users.assignableRoles(user);
  }

  @Post("invite")
  @RequireAnyPermission(...USER_MANAGEMENT)
  @HttpCode(HttpStatus.CREATED)
  invite(@CurrentUser() user: RequestUser, @Body() dto: InviteUserDto): Promise<InviteResult> {
    return this.users.invite(user, dto);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findOne(@CurrentUser() user: RequestUser, @Param("id", new ParseUUIDPipe()) id: string): Promise<UserDetailView> {
    return this.users.findOne(user, id);
  }

  @Patch(":id")
  @RequireAnyPermission(...USER_MANAGEMENT)
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDetailView> {
    return this.users.updateProfile(user, id, dto);
  }

  @Patch(":id/status")
  @RequireAnyPermission(...USER_MANAGEMENT)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UserStatusDto,
  ): Promise<UserDetailView> {
    return this.users.setStatus(user, id, dto.status);
  }

  @Patch(":id/memberships/:membershipId")
  @RequireAnyPermission(...USER_MANAGEMENT)
  changeMembershipRole(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("membershipId", new ParseUUIDPipe()) membershipId: string,
    @Body() dto: ChangeMembershipRoleDto,
  ): Promise<UserDetailView> {
    return this.users.changeMembershipRole(user, id, membershipId, dto);
  }
}
