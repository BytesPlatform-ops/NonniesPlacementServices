import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListNotificationsQueryDto extends PaginationQueryDto {
  /**
   * Server-side filter, not a client-side hide: "unread" must stay accurate
   * across pagination, so the database decides which rows exist at all.
   */
  @IsOptional()
  @IsIn(["all", "unread", "read"])
  filter?: "all" | "unread" | "read";
}

export class SetReadDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  read?: boolean;
}
