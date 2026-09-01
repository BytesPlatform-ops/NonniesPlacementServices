import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CommunicationChannel, CommunicationSuppressionReason } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class CreateSuppressionDto {
  @IsEnum(CommunicationChannel) channel!: CommunicationChannel;
  @IsString() @MaxLength(320) address!: string;
  @IsEnum(CommunicationSuppressionReason) reason!: CommunicationSuppressionReason;
  @IsOptional() @IsString() @MaxLength(200) source?: string;
}

export class ListSuppressionsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(CommunicationChannel) channel?: CommunicationChannel;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
