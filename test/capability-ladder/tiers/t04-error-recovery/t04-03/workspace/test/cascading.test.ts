import { expect, test, describe } from "bun:test";
import { EntityRepo } from "../src/repo";
import { EntityService } from "../src/service";

describe("cascading type fix", () => {
  test("supports object entity ids with namespace", () => {
    const repo = new EntityRepo();
    repo.save({ id: "101", ns: "billing" }, "Invoice-101");
    expect(repo.find({ id: "101", ns: "billing" })).toBe("Invoice-101");
  });

  test("supports plain string entity ids using default namespace", () => {
    const repo = new EntityRepo();
    const service = new EntityService(repo);

    service.registerUser("user-42", "Alice");
    expect(service.getUser("user-42")).toBe("Alice");
    expect(repo.find({ id: "user-42", ns: "default" })).toBe("Alice");
  });
});
