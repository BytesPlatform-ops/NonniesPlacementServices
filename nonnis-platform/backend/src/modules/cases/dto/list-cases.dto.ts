import { IsEnum, IsOptional } from "class-validator";
import { CaseStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

/** Query parameters for the case list. */
export class ListCasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}
