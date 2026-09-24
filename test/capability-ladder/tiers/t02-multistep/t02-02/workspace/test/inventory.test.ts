import { expect, test, describe, beforeEach } from "bun:test";
import { InventoryRegistry } from "../src/inventory";

describe("InventoryRegistry", () => {
  let inv: InventoryRegistry;

  beforeEach(() => {
    inv = new InventoryRegistry();
    inv.addItem("SKU-1", "Widget", 10);
  });

  test("initializes stock with 0 reserved", () => {
    expect(inv.getAvailableStock("SKU-1")).toBe(10);
    expect(inv.getReservedStock("SKU-1")).toBe(0);
  });

  test("successfully reserves available stock", () => {
    expect(inv.reserveStock("SKU-1", 4)).toBe(true);
    expect(inv.getAvailableStock("SKU-1")).toBe(6);
    expect(inv.getReservedStock("SKU-1")).toBe(4);
  });

  test("rejects reservation when requested exceeds available", () => {
    expect(inv.reserveStock("SKU-1", 15)).toBe(false);
    expect(inv.getAvailableStock("SKU-1")).toBe(10);
    expect(inv.getReservedStock("SKU-1")).toBe(0);
  });

  test("releases reserved stock back to available", () => {
    inv.reserveStock("SKU-1", 5);
    expect(inv.releaseStock("SKU-1", 3)).toBe(true);
    expect(inv.getAvailableStock("SKU-1")).toBe(8);
    expect(inv.getReservedStock("SKU-1")).toBe(2);
  });

  test("rejects release exceeding reserved amount", () => {
    inv.reserveStock("SKU-1", 2);
    expect(inv.releaseStock("SKU-1", 5)).toBe(false);
    expect(inv.getAvailableStock("SKU-1")).toBe(8);
    expect(inv.getReservedStock("SKU-1")).toBe(2);
  });
});
