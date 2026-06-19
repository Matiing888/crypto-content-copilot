-- AlterTable
ALTER TABLE "ContentPack" ADD COLUMN     "saved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ContentPack_userId_saved_idx" ON "ContentPack"("userId", "saved");
