import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { UserStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class InviteUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsUUID()
  organizationId!: string;

  /** Role code to assign (validated against the inviter's assignable roles). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;
}

export class UserStatusDto {
  /** Administrative status changes only — never INVITED (that is set by invite). */
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED])
  status!: typeof UserStatus.ACTIVE | typeof UserStatus.SUSPENDED | typeof UserStatus.DEACTIVATED;
}

export class ChangeMembershipRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  roleCode!: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
