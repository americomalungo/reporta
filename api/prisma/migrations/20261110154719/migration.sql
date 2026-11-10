/*
  Warnings:

  - You are about to drop the column `latitude` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `lastLatitude` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLongitude` on the `users` table. All the data in the column will be lost.
  - Made the column `location` on table `incidents` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "incidents_latitude_longitude_idx";

-- DropIndex
DROP INDEX "users_lastLatitude_lastLongitude_idx";

-- AlterTable
ALTER TABLE "incidents" DROP COLUMN "latitude",
DROP COLUMN "longitude",
ALTER COLUMN "location" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "lastLatitude",
DROP COLUMN "lastLongitude",
ADD COLUMN     "lastLocation" geography(Point, 4326);

-- CreateIndex
CREATE INDEX "incidents_location_idx" ON "incidents" USING GIST ("location");

-- CreateIndex
CREATE INDEX "users_lastLocation_idx" ON "users" USING GIST ("lastLocation");
