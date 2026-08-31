import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

/**
 * Idempotent demo-media migration for the public website CMS.
 *
 * Uploads the REAL existing local demo assets (from the public website's
 * `public/assets/...`) into the shared Supabase Storage content bucket, then
 * rewrites the seeded demo Blog/ShortVideo records to point at the resulting
 * public Supabase URLs (plus their managed storage paths for safe cleanup).
 *
 * Stable object paths + `upsert` make re-runs safe (no duplicate objects, no
 * duplicate records). Missing source files are reported and skipped — never
 * invented.
 *
 * Run:  npm run content:seed-media
 */

const BUCKET = "nonnis-content";
// repo root: src/scripts -> src -> backend -> nonnis-platform -> <root>
const REPO_ROOT = resolve(__dirname, "../../../..");
const ASSETS = resolve(REPO_ROOT, "public/assets");

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for media seeding.`);
  return v;
}

const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const IMAGE_CT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const VIDEO_CT: Record<string, string> = { mp4: "video/mp4", webm: "video/webm" };

interface BlogAsset { slug: string; image: string }
interface VideoAsset { id: string; video: string; poster: string }

const BLOG: BlogAsset[] = [
  { slug: "planning-a-safe-hospital-discharge", image: "images/nurse-tablet-care-plan.jpg" },
  { slug: "questions-families-should-ask-before-placement", image: "images/family-portrait.jpg" },
  { slug: "understanding-levels-of-care", image: "images/caregiver-resident-room.jpg" },
  { slug: "what-makes-a-great-care-provider", image: "images/provider-facility-care.jpg" },
  { slug: "transitioning-to-senior-living-with-confidence", image: "images/assisted-living-community.jpg" },
];

const VIDEOS: VideoAsset[] = [
  { id: "51de0000-0000-4000-8000-000000000001", video: "videos/hero-care-loop.mp4", poster: "images/senior-wellness.jpg" },
  { id: "51de0000-0000-4000-8000-000000000002", video: "videos/provider-care-loop.mp4", poster: "images/provider-staff.jpg" },
  { id: "51de0000-0000-4000-8000-000000000003", video: "videos/home-care-checkup.mp4", poster: "images/nurse-tablet-care-plan.jpg" },
  { id: "51de0000-0000-4000-8000-000000000004", video: "videos/care-loop-2.mp4", poster: "images/caregiver-resident-room.jpg" },
  { id: "51de0000-0000-4000-8000-000000000005", video: "videos/care-loop-3.mp4", poster: "images/family-laptop.jpg" },
];

const missing: string[] = [];

function ext(rel: string): string {
  return rel.split(".").pop()!.toLowerCase();
}

/** Upload a local file to a stable object path (idempotent). Returns its public URL, or null if the source is missing. */
async function upload(localRel: string, objectPath: string): Promise<string | null> {
  const abs = resolve(ASSETS, localRel);
  if (!existsSync(abs) || statSync(abs).size === 0) {
    missing.push(localRel);
    console.warn(`  ! MISSING source asset: ${abs}`);
    return null;
  }
  const e = ext(localRel);
  const contentType = IMAGE_CT[e] ?? VIDEO_CT[e];
  if (!contentType) {
    console.warn(`  ! Unsupported type for ${localRel}`);
    return null;
  }
  const body = readFileSync(abs);
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, body, { contentType, upsert: true });
  if (error) {
    console.warn(`  ! Upload failed for ${objectPath}: ${error.message}`);
    return null;
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  console.log(`  ✓ ${objectPath}  (${(body.length / 1024).toFixed(0)} KB)`);
  return publicUrl;
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) {
    console.log(`Bucket "${BUCKET}" already exists.`);
    return;
  }
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !/exists|already/i.test(error.message)) throw error;
  console.log(`Created public bucket "${BUCKET}".`);
}

async function main(): Promise<void> {
  console.log(`Seeding CMS media into Supabase Storage from ${ASSETS}`);
  await ensureBucket();

  console.log("Blog featured images:");
  for (const b of BLOG) {
    const path = `blog/featured/demo-${b.slug}.${ext(b.image)}`;
    const url = await upload(b.image, path);
    if (url) {
      await prisma.blogPost.updateMany({ where: { slug: b.slug }, data: { featuredImageUrl: url, featuredImageStoragePath: path } });
    }
  }

  console.log("Short videos + posters:");
  for (const v of VIDEOS) {
    const videoPath = `videos/demo-${v.id}.${ext(v.video)}`;
    const posterPath = `videos/posters/demo-${v.id}.${ext(v.poster)}`;
    const videoUrl = await upload(v.video, videoPath);
    const posterUrl = await upload(v.poster, posterPath);
    const data: Record<string, unknown> = {};
    if (videoUrl) { data.videoUrl = videoUrl; data.videoStoragePath = videoPath; }
    if (posterUrl) { data.posterImageUrl = posterUrl; data.posterImageStoragePath = posterPath; }
    if (Object.keys(data).length > 0) await prisma.shortVideo.updateMany({ where: { id: v.id }, data });
  }

  if (missing.length > 0) {
    console.warn(`\nMissing source assets (${missing.length}): ${missing.join(", ")}`);
  }
  console.log("\nContent media seed complete.");
}

main()
  .catch((err) => {
    console.error("Media seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
