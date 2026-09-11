import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export const LISTING_TYPES = ["BED", "PRIVATE_ROOM", "SHARED_ROOM", "UNIT", "OTHER"] as const;
export const TRANSACTION_TYPES = ["RENT", "SALE"] as const;
export const BILLING_PERIODS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export const LISTING_STATUSES = ["DRAFT", "PUBLISHED", "UNAVAILABLE", "ARCHIVED"] as const;

/**
 * Money arrives as a string and is parsed server-side. A JSON number cannot
 * represent 1234.56 exactly in every case, and the column is a Decimal.
 */
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

export class ListingPriceDto {
  @IsString()
  @MaxLength(16)
  price!: string;
}

export class CreateListingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsEnum(LISTING_TYPES as unknown as object)
  listingType!: (typeof LISTING_TYPES)[number];

  @IsEnum(TRANSACTION_TYPES as unknown as object)
  transactionType!: (typeof TRANSACTION_TYPES)[number];

  @IsString()
  @MaxLength(16)
  price!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsEnum(BILLING_PERIODS as unknown as object)
  billingPeriod?: (typeof BILLING_PERIODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  depositAmount?: string;

  @IsInt()
  @Min(0)
  @Max(10000)
  availableQuantity!: number;

  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;

  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional() @IsUUID() serviceCategoryId?: string;
  @IsOptional() @IsString() @MaxLength(500) restrictions?: string;
}

export class UpdateListingDto extends CreateListingDto {
  @IsOptional() declare title: string;
  @IsOptional() declare listingType: (typeof LISTING_TYPES)[number];
  @IsOptional() declare transactionType: (typeof TRANSACTION_TYPES)[number];
  @IsOptional() declare price: string;
  @IsOptional() declare availableQuantity: number;
}

export class ListingStatusDto {
  @IsEnum(LISTING_STATUSES as unknown as object)
  status!: (typeof LISTING_STATUSES)[number];
}

export class AddListingImageDto {
  @IsString() @MaxLength(2000) imageUrl!: string;
  @IsOptional() @IsString() @MaxLength(500) storagePath?: string;
  @IsOptional() @IsString() @MaxLength(200) altText?: string;
}

export class ListingImageUploadUrlDto {
  @IsString() @MaxLength(120) contentType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  sizeBytes?: number;
}

export class ListingsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(TRANSACTION_TYPES as unknown as object) transactionType?: (typeof TRANSACTION_TYPES)[number];
  @IsOptional() @IsEnum(LISTING_TYPES as unknown as object) listingType?: (typeof LISTING_TYPES)[number];
  @IsOptional() @IsEnum(LISTING_STATUSES as unknown as object) status?: (typeof LISTING_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(16) minPrice?: string;
  @IsOptional() @IsString() @MaxLength(16) maxPrice?: string;
  @IsOptional() @IsUUID() providerId?: string;
}

export class CreateOrderDto {
  @IsUUID() listingId!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  quantity!: number;

  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsDateString() requestedStartDate?: string;
  @IsOptional() @IsDateString() requestedEndDate?: string;
  /** Re-validated against the caller's own grants; never trusted as sent. */
  @IsOptional() @IsUUID() caseId?: string;
}

export class DeclineOrderDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class OrdersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) unpaidOnly?: boolean;
}

export { MONEY };
