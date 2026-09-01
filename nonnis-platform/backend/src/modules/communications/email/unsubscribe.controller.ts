import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { Public } from "../../auth/decorators";
import { UnsubscribeService } from "./unsubscribe.service";

class UnsubscribeBody {
  @IsOptional() @IsString() @MaxLength(200) token?: string;
}

/** Public, login-free email unsubscribe. GET verifies (friendly page); POST performs
 *  (button + RFC-8058 one-click via the List-Unsubscribe header). */
@Controller("public/communications/unsubscribe")
export class UnsubscribeController {
  constructor(private readonly unsubscribe: UnsubscribeService) {}

  @Get()
  @Public()
  status(@Query("token") token: string) {
    return this.unsubscribe.status(token ?? "");
  }

  @Post()
  @Public()
  perform(@Query("token") token: string | undefined, @Body() body: UnsubscribeBody) {
    return this.unsubscribe.unsubscribe(token ?? body.token ?? "");
  }
}
