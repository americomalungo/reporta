/** Names of the BullMQ queues used by this service. */
export enum QueueName {
  /** Risk alert and notification push work. */
  ALERTS = 'alerts',
  /** Automated incident moderation work. */
  MODERATION = 'moderation',
  /** Periodic and manually requested maintenance work. */
  MAINTENANCE = 'maintenance',
}

/** Names of supported asynchronous jobs. */
export enum JobName {
  /** Dispatches nearby risk alerts for one incident. */
  DISPATCH_RISK_ALERT = 'dispatch-risk-alert',
  /** Sends pending pushes for one incident. */
  SEND_ALERT_PUSHES = 'send-alert-pushes',
  /** Sends a persisted notification push. */
  SEND_NOTIFICATION_PUSH = 'send-notification-push',
  /** Recovers undispatched risk alerts and pending pushes. */
  RETRY_RISK_ALERT_PUSHES = 'retry-risk-alert-pushes',
  /** Rechecks incidents pending automated moderation. */
  RETRY_AUTO_MODERATION = 'retry-auto-moderation',
  /** Evaluates one incident after a disconfirming vote. */
  EVALUATE_INCIDENT_MODERATION = 'evaluate-incident-moderation',
  /** Expires incidents. */
  EXPIRE_INCIDENTS = 'expire-incidents',
  /** Lifts expired suspensions. */
  LIFT_SUSPENSIONS = 'lift-suspensions',
  /** Removes expired media. */
  CLEANUP_MEDIA = 'cleanup-media',
  /** Scans object storage for orphaned media. */
  SCAN_ORPHANS = 'scan-orphans',
  /** Removes expired auxiliary records. */
  HOUSEKEEPING = 'housekeeping',
}
