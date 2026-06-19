-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyGenerations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ContentPack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentPack_userId_createdAt_idx" ON "ContentPack"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentPack" ADD CONSTRAINT "ContentPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
