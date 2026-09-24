import { expect, test, describe } from "bun:test";
import { AuthService, TelemetryService, NotificationService, sendAlertToAdmins } from "../src/index";

describe("Monolith Decomposed Services", () => {
  test("services are available from index.ts", () => {
    const auth = new AuthService();
    expect(auth.getAdminEmails()).toContain("admin@corp.local");

    const telemetry = new TelemetryService();
    expect(telemetry.logEvent).toBeDefined();

    const notif = new NotificationService();
    expect(notif.sendEmail("test@corp.local", "Hi", "Body")).toBe(true);
  });

  test("sendAlertToAdmins sends email to all admins and logs event", () => {
    let emailsSent = 0;
    let logged = false;

    const mockAuth = new AuthService();
    const mockNotif = new NotificationService();
    mockNotif.sendEmail = () => { emailsSent++; return true; };

    const mockTel = new TelemetryService();
    mockTel.logEvent = () => { logged = true; };

    sendAlertToAdmins("Urgent Alert", mockAuth, mockTel, mockNotif);
    expect(emailsSent).toBe(2);
    expect(logged).toBe(true);
  });
});
