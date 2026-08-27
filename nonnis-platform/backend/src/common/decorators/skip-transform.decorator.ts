import { SetMetadata } from "@nestjs/common";

/** Metadata key marking a handler whose response must not be wrapped in `{ data }`. */
export const SKIP_TRANSFORM_KEY = "skipTransform";

/** Apply to a controller/handler to return its raw payload (e.g. health checks). */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
