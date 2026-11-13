/** Returns an authenticated user identifier or the proxy-aware request IP.
 * @param {Record<string, unknown>} request Express request object supplied by throttler
 * @returns {string} stable tracker for one user or client
 */
export function getRateLimitTracker(request: Record<string, unknown>): string {
  const databaseUser = request.dbUser;
  if (
    typeof databaseUser === 'object' &&
    databaseUser !== null &&
    'id' in databaseUser &&
    typeof databaseUser.id === 'string'
  ) {
    return `user-${databaseUser.id}`;
  }
  return typeof request.ip === 'string' ? request.ip : 'unknown';
}
