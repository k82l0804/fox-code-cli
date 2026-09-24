# System Architecture

The monolith was decomposed into 3 standalone services:
- `AuthService` (`src/services/auth.ts`): Manages authentication and user roles.
- `TelemetryService` (`src/services/telemetry.ts`): Logs operational events.
- `NotificationService` (`src/services/notifications.ts`): Dispatches notifications.

All services are re-exported in `src/index.ts`, alongside composite workflows like `sendAlertToAdmins`.
