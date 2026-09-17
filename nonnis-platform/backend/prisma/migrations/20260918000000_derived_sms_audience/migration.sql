-- AlterTable
ALTER TABLE "communication_lists" ADD COLUMN     "systemKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "communication_lists_systemKey_key" ON "communication_lists"("systemKey");
