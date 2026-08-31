import { BadRequestException } from "@nestjs/common";

const remove = jest.fn(async () => ({ error: null }));
const createSignedUploadUrl = jest.fn(async (path: string) => ({ data: { token: "tok", signedUrl: `https://x.supabase.co/upload/${path}` }, error: null }));
const getPublicUrl = jest.fn((path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/nonnis-content/${path}` } }));
const getBucket = jest.fn(async () => ({ data: { name: "nonnis-content" }, error: null }));
const createBucket = jest.fn(async () => ({ data: null, error: null }));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      getBucket,
      createBucket,
      from: () => ({ createSignedUploadUrl, getPublicUrl, remove }),
    },
  }),
}));

import { MediaService } from "./media.service";
import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";

function makeService(): MediaService {
  const config = {
    get: (key: string) => (key === "supabaseUrl" ? "https://x.supabase.co" : key === "supabaseServiceRoleKey" ? "service-role" : undefined),
  } as unknown as ConfigService<AppConfig, true>;
  return new MediaService(config);
}

beforeEach(() => jest.clearAllMocks());

describe("MediaService.createUploadTicket — validation", () => {
  it("accepts a valid image and generates a server-side path under blog/featured", async () => {
    const t = await makeService().createUploadTicket("blog-featured", "image/webp", 1024);
    expect(t.path).toMatch(/^blog\/featured\/[0-9a-f-]{36}\.webp$/);
    expect(t.bucket).toBe("nonnis-content");
    expect(t.publicUrl).toContain("/nonnis-content/blog/featured/");
    expect(t.token).toBe("tok");
  });

  it("accepts a valid mp4 under videos/", async () => {
    const t = await makeService().createUploadTicket("video", "video/mp4", 1024);
    expect(t.path).toMatch(/^videos\/[0-9a-f-]{36}\.mp4$/);
  });

  it("accepts a poster under videos/posters/", async () => {
    const t = await makeService().createUploadTicket("poster", "image/jpeg");
    expect(t.path).toMatch(/^videos\/posters\/[0-9a-f-]{36}\.jpg$/);
  });

  it("rejects an invalid image MIME", async () => {
    await expect(makeService().createUploadTicket("blog-featured", "image/gif")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an executable/arbitrary MIME for video", async () => {
    await expect(makeService().createUploadTicket("video", "application/x-msdownload")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an oversize image (>10MB)", async () => {
    await expect(makeService().createUploadTicket("blog-featured", "image/png", 11 * 1024 * 1024)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an oversize video (>250MB)", async () => {
    await expect(makeService().createUploadTicket("video", "video/mp4", 300 * 1024 * 1024)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("never returns the service-role key in the ticket", async () => {
    const t = await makeService().createUploadTicket("blog-featured", "image/png", 1024);
    expect(Object.keys(t).sort()).toEqual(["bucket", "path", "publicUrl", "signedUrl", "token"]);
    expect(JSON.stringify(t)).not.toContain("service-role");
  });
});

describe("MediaService — managed path safety", () => {
  it("recognizes only managed folders", () => {
    const svc = makeService();
    expect(svc.isManagedPath("videos/abc.mp4")).toBe(true);
    expect(svc.isManagedPath("blog/featured/abc.webp")).toBe(true);
    expect(svc.isManagedPath("videos/posters/abc.jpg")).toBe(true);
    expect(svc.isManagedPath("https://example.com/x.jpg")).toBe(false);
    expect(svc.isManagedPath("/assets/images/x.jpg")).toBe(false);
    expect(svc.isManagedPath(null)).toBe(false);
  });

  it("deletes only managed objects, never external URLs", async () => {
    const svc = makeService();
    await svc.deleteObject("videos/abc.mp4");
    expect(remove).toHaveBeenCalledWith(["videos/abc.mp4"]);
    remove.mockClear();
    await svc.deleteObject("https://example.com/x.jpg");
    await svc.deleteObject("/assets/images/x.jpg");
    await svc.deleteObject(null);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("MediaService.ensureBucket — idempotent", () => {
  it("does not recreate an existing bucket", async () => {
    await makeService().ensureBucket();
    expect(getBucket).toHaveBeenCalled();
    expect(createBucket).not.toHaveBeenCalled();
  });

  it("creates the bucket only when missing", async () => {
    getBucket.mockResolvedValueOnce({ data: null, error: null } as never);
    await makeService().ensureBucket();
    expect(createBucket).toHaveBeenCalledWith("nonnis-content", expect.objectContaining({ public: true }));
  });
});
