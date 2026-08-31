import "reflect-metadata";
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from "../auth/decorators";
import { PERMISSIONS, ROLE_DEFINITIONS } from "../../common/rbac";
import { BlogController } from "./blog.controller";
import { ShortVideoController } from "./short-video.controller";
import { TestimonialController } from "./testimonial.controller";
import { PublicContentController } from "./public-content.controller";

describe("PublicContentController", () => {
  it("marks every route @Public (no auth required)", () => {
    const proto = PublicContentController.prototype;
    for (const method of ["listBlog", "getBlog", "listVideos", "listTestimonials"] as const) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto[method])).toBe(true);
    }
  });
});

describe("Admin content controllers require content permissions", () => {
  const write = ["create", "update", "remove"] as const;

  it("blog write routes require content.manage; reads allow read or manage", () => {
    const proto = BlogController.prototype;
    for (const m of [...write, "publish", "unpublish", "archive"] as const) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, proto[m])).toContain(PERMISSIONS.CONTENT_MANAGE);
    }
    for (const m of ["list", "findOne"] as const) {
      expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, proto[m])).toEqual([PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MANAGE]);
    }
  });

  it("video + testimonial write routes require content.manage", () => {
    for (const proto of [ShortVideoController.prototype, TestimonialController.prototype]) {
      for (const m of [...write, "setActive"] as const) {
        expect(Reflect.getMetadata(PERMISSIONS_KEY, proto[m])).toContain(PERMISSIONS.CONTENT_MANAGE);
      }
    }
  });
});

describe("Content RBAC", () => {
  it("only Nonnis roles hold content.manage; providers and discharge pros do not", () => {
    const has = (role: keyof typeof ROLE_DEFINITIONS, perm: string) => ROLE_DEFINITIONS[role].permissions.includes(perm as never);
    expect(has("NONNIS_ADMIN", PERMISSIONS.CONTENT_MANAGE)).toBe(true);
    expect(has("NONNIS_OPERATIONS", PERMISSIONS.CONTENT_MANAGE)).toBe(true);
    expect(has("DISCHARGE_PROFESSIONAL", PERMISSIONS.CONTENT_MANAGE)).toBe(false);
    expect(has("DISCHARGE_PROFESSIONAL", PERMISSIONS.CONTENT_READ)).toBe(false);
    expect(has("PROVIDER_ADMIN", PERMISSIONS.CONTENT_MANAGE)).toBe(false);
    expect(has("PROVIDER_STAFF", PERMISSIONS.CONTENT_READ)).toBe(false);
  });
});
