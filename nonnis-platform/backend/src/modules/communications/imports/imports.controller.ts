import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../../common/rbac";
import { CurrentUser, RequirePermissions } from "../../auth/decorators";
import type { RequestUser } from "../../auth/request-user";
import { ImportsService } from "./imports.service";
import { CsvInspectDto, ImportCommitDto, ImportPreviewDto } from "../dto/imports.dto";

@Controller("communications/imports")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post("csv-inspect")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_IMPORT)
  inspectCsv(@Body() dto: CsvInspectDto) {
    return this.imports.inspectCsv(dto);
  }

  @Post("preview")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_IMPORT)
  preview(@Body() dto: ImportPreviewDto) {
    return this.imports.preview(dto);
  }

  @Post("commit")
  @RequirePermissions(PERMISSIONS.COMMUNICATIONS_IMPORT)
  commit(@CurrentUser() user: RequestUser, @Body() dto: ImportCommitDto) {
    return this.imports.commit(user, dto);
  }
}
