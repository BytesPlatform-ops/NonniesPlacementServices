
-- AlterEnum
ALTER TYPE "CommunicationContactSource" ADD VALUE 'SEEKER_ONBOARDING';

-- AlterTable
ALTER TABLE "communication_contacts" ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "communication_contacts_userId_key" ON "communication_contacts"("userId");

-- AddForeignKey
ALTER TABLE "communication_contacts" ADD CONSTRAINT "communication_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
