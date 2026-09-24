import { FrameworkRouter, type HttpResponse } from "../lib/framework-router";

export class UserApplication {
  private router = new FrameworkRouter();

  execute(): string {
    return this.router.dispatch((): HttpResponse => {
      return { status: 200, body: "User payload" };
    });
  }
}
