export class AuthService {
  getAdminEmails(): string[] {
    return ["admin@corp.local", "secops@corp.local"];
  }
}

export class TelemetryService {
  logEvent(event: string, payload: any): void {
    console.log(`[EVENT] ${event}`, payload);
  }
}

export class NotificationService {
  sendEmail(to: string, subject: string, body: string): boolean {
    return true;
  }
}
