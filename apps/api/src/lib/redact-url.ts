/** Drop invite and password-reset secrets from request logs. */
export function redactTokenQuery(url: string): string {
  return url.replace(/([?&])token=[^&#]*/gi, "$1token=redacted");
}
