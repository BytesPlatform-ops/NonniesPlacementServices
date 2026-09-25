import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const BILLING_TYPES = ["ONE_TIME", "RECURRING"] as const;
// The two ways Nonni's is paid: card, which settles itself, and Zelle, which a
// person confirms. CASH and BANK_TRANSFER remain in the database enum so any
// older row stays readable, but neither is offered or accepted any more.
const METHODS = ["STRIPE", "ZELLE"] as const;
const OFFLINE_METHODS = ["ZELLE"] as const;

/**
 * One line of an invoice.
 *
 * Amounts arrive as STRINGS and are parsed into Decimal server-side. A JSON
 * number would already have passed through a double before we ever saw it.
 */
export class InvoiceItemDto {
  /** What KIND of charge this is. The product carries no price. */
  @IsOptional() @IsUUID() productId?: string;
  @IsString() @Length(1, 200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsNumberString() quantity!: string;
  @IsNumberString() unitPrice!: string;
}

export class CreateInvoiceDto {
  @IsUUID() providerId!: string;
  @IsOptional() @IsUUID() caseId?: string;
  @IsOptional() @IsUUID() orderId?: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  /** Fraction, e.g. "0.0825" for 8.25%. Never a percentage figure. */
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
  @IsOptional() @IsIn(BILLING_TYPES) billingType?: (typeof BILLING_TYPES)[number];
  @IsOptional() @IsIn(["MONTHLY"]) recurringInterval?: "MONTHLY";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) recurringPeriods?: number;
  @IsOptional() @IsISO8601() recurringStartAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsIn(METHODS) paymentMethod?: (typeof METHODS)[number];
  @IsOptional() @IsIn(BILLING_TYPES) billingType?: (typeof BILLING_TYPES)[number];
  @IsOptional() @IsIn(["MONTHLY"]) recurringInterval?: "MONTHLY";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) recurringPeriods?: number;
  @IsOptional() @IsISO8601() recurringStartAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class InvoiceQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(Object.values(InvoiceStatus)) status?: InvoiceStatus;
  @IsOptional() @IsUUID() providerId?: string;
}

/** A provider saying they have sent an offline payment. A claim, not a settlement. */
export class ReportInvoicePaymentDto {
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

/** An authorized person confirming offline money actually arrived. */
export class VerifyInvoicePaymentDto {
  @IsOptional() @IsNumberString() amount?: string;
  @IsOptional() @IsIn(OFFLINE_METHODS) method?: (typeof OFFLINE_METHODS)[number];
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

/**
 * Configure a product's SUGGESTED starting price.
 *
 * Never the charged amount: it only changes what an admin is offered when
 * writing a new invoice, and that figure still has to be approved.
 */
export class UpdateProductPricingDto {
  @IsOptional() @IsNumberString() suggestedUnitPrice?: string | null;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PaymentHistoryQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(Object.values(InvoicePaymentStatus)) status?: InvoicePaymentStatus;
  @IsOptional() @IsUUID() providerId?: string;
}

/** Put a provider on a monthly plan at the amount agreed with THEM. */
export class CreateSubscriptionDto {
  @IsUUID() providerId!: string;
  @IsUUID() productId!: string;
  @IsNumberString() unitPrice!: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) totalPeriods?: number;
}
