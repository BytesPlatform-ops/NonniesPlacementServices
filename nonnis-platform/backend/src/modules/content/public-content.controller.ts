import { Controller, Get, Param, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { Public } from "../auth/decorators";
import { BlogService } from "./blog.service";
import { ShortVideoService } from "./short-video.service";
import { TestimonialService } from "./testimonial.service";
import type { BlogPublicCard, BlogPublicDetail, TestimonialPublicView, VideoPublicView } from "./content.serializer";
import { PublicBlogQueryDto } from "./dto/blog.dto";

/**
 * Public, read-only content API for the marketing website. Every route is
 * `@Public()` (no Supabase login) and returns ONLY published/active, public-safe
 * fields — never drafts, archived rows, internal notes, or user/admin metadata.
 */
@Controller("public")
export class PublicContentController {
  constructor(
    private readonly blog: BlogService,
    private readonly videos: ShortVideoService,
    private readonly testimonials: TestimonialService,
  ) {}

  @Get("blog")
  @Public()
  listBlog(@Query() query: PublicBlogQueryDto): Promise<PaginatedResult<BlogPublicCard>> {
    return this.blog.publicList(query);
  }

  @Get("blog/:slug")
  @Public()
  getBlog(@Param("slug") slug: string): Promise<BlogPublicDetail> {
    return this.blog.publicFindBySlug(slug);
  }

  @Get("blog-videos")
  @Public()
  listVideos(): Promise<VideoPublicView[]> {
    return this.videos.publicList();
  }

  @Get("testimonials")
  @Public()
  listTestimonials(): Promise<TestimonialPublicView[]> {
    return this.testimonials.publicList();
  }
}
