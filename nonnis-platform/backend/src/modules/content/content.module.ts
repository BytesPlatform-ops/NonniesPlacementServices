import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BlogController } from "./blog.controller";
import { BlogService } from "./blog.service";
import { ShortVideoController } from "./short-video.controller";
import { ShortVideoService } from "./short-video.service";
import { TestimonialController } from "./testimonial.controller";
import { TestimonialService } from "./testimonial.service";
import { PublicContentController } from "./public-content.controller";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [AuditModule],
  controllers: [BlogController, ShortVideoController, TestimonialController, PublicContentController, MediaController],
  providers: [BlogService, ShortVideoService, TestimonialService, MediaService],
  exports: [MediaService],
})
export class ContentModule {}
