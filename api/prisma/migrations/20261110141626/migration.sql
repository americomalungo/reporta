/*
  Warnings:

  - You are about to drop the `reputation_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "reputation_logs" DROP CONSTRAINT "reputation_logs_userId_fkey";

-- DropTable
DROP TABLE "reputation_logs";
