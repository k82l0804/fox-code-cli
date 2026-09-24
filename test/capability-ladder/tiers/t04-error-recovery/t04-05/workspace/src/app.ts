import { FrameworkRouter, type HttpResponse } from "../lib/framework-router";

export class UserApplication {
  private router = new FrameworkRouter();

  execute(): string {
    return this.router.dispatch(() => {
      // BUG: forgot return statement
      const resp: HttpResponse = { status: 200, body: "User payload" };
    } as any);
  }
}
