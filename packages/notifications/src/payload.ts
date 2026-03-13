export interface NotificationPayload {
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
}
