import { Controller, Get, Param, Query } from "@nestjs/common";
import type { PaginatedResult } from "../../common/types/api-response";
import { Public } from "../auth/decorators";
import { PublicProvidersService, type PublicDirectoryOptions } from "./public-providers.service";
import { PublicProviderListDto } from "./dto/public-provider.dto";
import type { ProviderPublicCardView, ProviderPublicDetailView } from "./public-provider.serializer";

/**
 * Unauthenticated public residential-provider directory API. Read-only; every
 * response comes from the published-only service + explicit public serializer.
 */
@Controller("public/residential-providers")
export class PublicProvidersController {
  constructor(private readonly directory: PublicProvidersService) {}

  @Get()
  @Public()
  list(@Query() query: PublicProviderListDto): Promise<PaginatedResult<ProviderPublicCardView>> {
    return this.directory.list(query);
  }

  // Declared before ":slug" so it is never captured as a slug.
  @Get("options")
  @Public()
  options(): Promise<PublicDirectoryOptions> {
    return this.directory.options();
  }

  @Get(":slug")
  @Public()
  detail(@Param("slug") slug: string): Promise<ProviderPublicDetailView> {
    return this.directory.findBySlug(slug);
  }
}
