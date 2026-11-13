ALTER TABLE "notifications"
ADD COLUMN "pushClaimedAt" TIMESTAMP(3);

CREATE INDEX "notifications_type_pushSent_pushClaimedAt_idx"
ON "notifications"("type", "pushSent", "pushClaimedAt");

CREATE TABLE maintenance_job_locks (
  job TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  "leaseUntil" TIMESTAMP(3) NOT NULL
);
