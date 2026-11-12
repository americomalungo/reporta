ALTER TABLE "notifications"
ADD COLUMN "pushClaimedAt" TIMESTAMP(3);

CREATE INDEX "notifications_type_pushSent_pushClaimedAt_idx"
ON "notifications"("type", "pushSent", "pushClaimedAt");

CREATE TABLE maintenance_job_locks (
  job TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  "leaseUntil" TIMESTAMP(3) NOT NULL
);

-- The previous dispatcher set this timestamp before it had finished delivery.
-- Requeue active risk incidents and recreate any missing in-app alert records.
UPDATE incidents AS i
SET "alertDispatchedAt" = NULL
FROM categories AS c
WHERE i."categoryId" = c.id
  AND i.status = 'ACTIVE'
  AND c."isRisk" = true;

INSERT INTO notifications (
  id, "userId", type, title, body, "incidentId", data,
  "isRead", "pushSent", "createdAt"
)
SELECT
  'legacy-alert-' || ad.id,
  ad."userId",
  'RISK_ALERT',
  'Alerta de risco perto de si',
  CASE
    WHEN ad."distanceM" IS NULL THEN
      'Foi registado um incidente de risco perto de si: ' || i.title || '.'
    ELSE
      'Foi registado um incidente de risco perto de si: ' || i.title ||
      ', a cerca de ' || round(ad."distanceM")::text || ' m.'
  END,
  i.id,
  jsonb_build_object(
    'incidentId', i.id,
    'categoryId', i."categoryId",
    'distanceM', ad."distanceM"
  ),
  false,
  false,
  now()
FROM alert_deliveries AS ad
JOIN incidents AS i ON i.id = ad."incidentId"
JOIN categories AS c ON c.id = i."categoryId"
WHERE i.status = 'ACTIVE'
  AND c."isRisk" = true
  AND NOT EXISTS (
    SELECT 1 FROM notifications AS n
    WHERE n."userId" = ad."userId"
      AND n."incidentId" = i.id
      AND n.type = 'RISK_ALERT'
  );
