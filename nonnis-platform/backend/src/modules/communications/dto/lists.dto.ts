import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ArrayMaxSize, IsArray } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class CreateListDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateListDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Copy a list's CURRENT members into a new editable list. */
export class DuplicateListDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
}

export class ListMembersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class AddMembersDto {
  @IsArray() @ArrayMaxSize(1000) @IsUUID("4", { each: true }) contactIds!: string[];
}
