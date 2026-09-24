import { expect, test, describe } from "bun:test";
import { handlePricingRequest } from "../src/service";

describe("Pricing Service", () => {
  test("formats currency when accept-language header is provided", () => {
    const res = handlePricingRequest({ headers: { "accept-language": "en-US" } }, 49.9);
    expect(res).toBe("$49.90");
  });

  test("falls back to default locale when accept-language header is missing", () => {
    const res = handlePricingRequest({ headers: {} }, 19.5);
    expect(res).toBe("$19.50");
  });
});
