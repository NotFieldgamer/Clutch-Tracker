-- AlterTable
ALTER TABLE "SubStep" ADD COLUMN     "effortMin" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
