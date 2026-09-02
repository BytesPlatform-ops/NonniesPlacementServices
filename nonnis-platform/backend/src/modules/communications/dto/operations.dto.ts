import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const SOURCES = ["EMAIL_CAMPAIGN", "EMAIL_REPLY", "SMS_CAMPAIGN", "SMS_REPLY"] as const;
const CHANNELS = ["EMAIL", "SMS"] as const;

export class ListDeliveryFailuresDto extends PaginationQueryDto {
  @IsOptional() @IsIn(CHANNELS) channel?: (typeof CHANNELS)[number];
  @IsOptional() @IsIn(SOURCES) source?: (typeof SOURCES)[number];
  @IsOptional() @IsString() @MaxLength(40) status?: string;
}

export class RetryDeliveryDto {
  @IsIn(SOURCES) source!: (typeof SOURCES)[number];
  /** Explicit acknowledgement that an ambiguous send may already have been delivered. */
  @IsOptional() @Type(() => Boolean) @IsBoolean() acknowledgeDuplicateRisk?: boolean;
}
