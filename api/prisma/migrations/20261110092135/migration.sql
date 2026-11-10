/*
  Warnings:

  - You are about to drop the column `isRisk` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `pendingReportsCount` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the `incident_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `saved_incidents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "incident_history" DROP CONSTRAINT "incident_history_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "saved_incidents" DROP CONSTRAINT "saved_incidents_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "saved_incidents" DROP CONSTRAINT "saved_incidents_userId_fkey";

-- DropIndex
DROP INDEX "incidents_isRisk_status_idx";

-- DropIndex
DROP INDEX "incidents_pendingReportsCount_idx";

-- AlterTable
ALTER TABLE "incidents" DROP COLUMN "isRisk",
DROP COLUMN "pendingReportsCount";

-- DropTable
DROP TABLE "incident_history";

-- DropTable
DROP TABLE "reports";

-- DropTable
DROP TABLE "saved_incidents";

-- DropTable
DROP TABLE "system_settings";

-- DropEnum
DROP TYPE "ReportStatus";

-- CreateIndex
CREATE INDEX "moderation_logs_incidentId_createdAt_idx" ON "moderation_logs"("incidentId", "createdAt");
