import { JobName } from '@/src/common/enums/queue.enums';
import type { JobPayloadMap } from '@/src/common/types/jobs.types';

/** Runtime payload validation functions keyed by job name. */
export const JOB_PAYLOAD_GUARDS: {
  [K in JobName]: (value: unknown) => value is JobPayloadMap[K];
} = {
  [JobName.DISPATCH_RISK_ALERT]: isIncidentPayload,
  [JobName.SEND_ALERT_PUSHES]: isIncidentPayload,
  [JobName.SEND_NOTIFICATION_PUSH]: isNotificationPayload,
  [JobName.RETRY_RISK_ALERT_PUSHES]: isEmptyPayload,
  [JobName.RETRY_AUTO_MODERATION]: isEmptyPayload,
  [JobName.EVALUATE_INCIDENT_MODERATION]: isIncidentPayload,
  [JobName.EXPIRE_INCIDENTS]: isEmptyPayload,
  [JobName.LIFT_SUSPENSIONS]: isEmptyPayload,
  [JobName.CLEANUP_MEDIA]: isEmptyPayload,
  [JobName.SCAN_ORPHANS]: isEmptyPayload,
  [JobName.HOUSEKEEPING]: isEmptyPayload,
};

/** Validates an incident identifier payload.
 * @param {unknown} value untrusted job payload
 * @returns {value is { incidentId: string }} true when the incident id is a string
 */
function isIncidentPayload(value: unknown): value is { incidentId: string } {
  return isRecord(value) && typeof value.incidentId === 'string';
}

/** Validates a notification identifier payload.
 * @param {unknown} value untrusted job payload
 * @returns {value is { notificationId: string }} true when the notification id is a string
 */
function isNotificationPayload(
  value: unknown,
): value is { notificationId: string } {
  return isRecord(value) && typeof value.notificationId === 'string';
}

/** Validates an empty object payload.
 * @param {unknown} value untrusted job payload
 * @returns {value is Record<string, never>} true when the payload has no fields
 */
function isEmptyPayload(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}

/** Checks whether a value is a non-null, non-array object.
 * @param {unknown} value untrusted value
 * @returns {value is Record<string, unknown>} true for an object record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
