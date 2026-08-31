import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BlogController } from "./blog.controller";
import { BlogService } from "./blog.service";
import { ShortVideoController } from "./short-video.controller";
import { ShortVideoService } from "./short-video.service";
import { TestimonialController } from "./testimonial.controller";
import { TestimonialService } from "./testimonial.service";
import { PublicContentController } from "./public-content.controller";

@Module({
  imports: [AuditModule],
  controllers: [BlogController, ShortVideoController, TestimonialController, PublicContentController],
  providers: [BlogService, ShortVideoService, TestimonialService],
})
export class ContentModule {}
