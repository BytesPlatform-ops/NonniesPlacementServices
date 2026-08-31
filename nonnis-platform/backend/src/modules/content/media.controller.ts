import { Body, Controller, Delete, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { MediaService, type UploadTicket } from "./media.service";
import { CreateUploadUrlDto, DeleteMediaDto } from "./dto/media.dto";

/**
 * CMS media endpoints. All require content.manage. The browser uses the returned
 * signed URL to upload DIRECTLY to Supabase Storage; the service-role key is
 * never exposed. Deletes only ever touch objects inside the managed bucket.
 */
@Controller("content/media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload-url")
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  createUploadUrl(@CurrentUser() _user: RequestUser, @Body() dto: CreateUploadUrlDto): Promise<UploadTicket> {
    return this.media.createUploadTicket(dto.kind, dto.contentType, dto.sizeBytes);
  }

  @Delete()
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  async remove(@CurrentUser() _user: RequestUser, @Body() dto: DeleteMediaDto): Promise<{ deleted: boolean }> {
    await this.media.deleteObject(dto.storagePath);
    return { deleted: true };
  }
}
