import { AuthService } from "./services/auth";
import { TelemetryService } from "./services/telemetry";
import { NotificationService } from "./services/notifications";

export { AuthService } from "./services/auth";
export { TelemetryService } from "./services/telemetry";
export { NotificationService } from "./services/notifications";

export function sendAlertToAdmins(
  message: string,
  auth = new AuthService(),
  telemetry = new TelemetryService(),
  notif = new NotificationService()
): void {
  const admins = auth.getAdminEmails();
  for (const email of admins) {
    notif.sendEmail(email, "Alert", message);
  }
  telemetry.logEvent("alert_sent", { recipientCount: admins.length, message });
}
