export interface HttpResponse {
  status: number;
  body: string;
}

export class FrameworkRouter {
  dispatch(handler: () => HttpResponse): string {
    const res = handler();
    // Crashes here if user handler returns undefined/void
    return `[${res.status}] ${res.body}`;
  }
}
