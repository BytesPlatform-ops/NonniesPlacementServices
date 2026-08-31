-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "featuredImageStoragePath" TEXT;

-- AlterTable
ALTER TABLE "short_videos" ADD COLUMN     "posterImageStoragePath" TEXT,
ADD COLUMN     "videoStoragePath" TEXT;

