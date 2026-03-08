import { describe, it, expect } from "vitest";
import { validateName } from "./validateName";

describe("validateName", () => {
  it("returns null for valid names", () => {
    expect(validateName("My Setup")).toBeNull();
    expect(validateName("test-setup")).toBeNull();
    expect(validateName("setup_2")).toBeNull();
    expect(validateName("Мой сетап")).toBeNull();
    expect(validateName("開発環境")).toBeNull();
  });

  it("returns null for empty/whitespace (handled by disabled button)", () => {
    expect(validateName("")).toBeNull();
    expect(validateName("   ")).toBeNull();
  });

  it("rejects special characters", () => {
    expect(validateName("test!")).not.toBeNull();
    expect(validateName("test@setup")).not.toBeNull();
    expect(validateName("!@#$%")).not.toBeNull();
    expect(validateName("test<>")).not.toBeNull();
    expect(validateName("test:name")).not.toBeNull();
    expect(validateName("test/name")).not.toBeNull();
    expect(validateName("test\\name")).not.toBeNull();
    expect(validateName("test|name")).not.toBeNull();
    expect(validateName("test?name")).not.toBeNull();
    expect(validateName("test*name")).not.toBeNull();
    expect(validateName('test"name')).not.toBeNull();
  });

  it("rejects Windows reserved names", () => {
    expect(validateName("CON")).not.toBeNull();
    expect(validateName("con")).not.toBeNull();
    expect(validateName("PRN")).not.toBeNull();
    expect(validateName("AUX")).not.toBeNull();
    expect(validateName("NUL")).not.toBeNull();
    expect(validateName("COM1")).not.toBeNull();
    expect(validateName("LPT9")).not.toBeNull();
  });

  it("rejects names longer than 30 characters", () => {
    const longName = "a".repeat(31);
    expect(validateName(longName)).not.toBeNull();
    expect(validateName("a".repeat(30))).toBeNull();
  });

  it("allows hyphens and underscores", () => {
    expect(validateName("my-setup")).toBeNull();
    expect(validateName("my_setup")).toBeNull();
    expect(validateName("my-setup_v2")).toBeNull();
  });

  it("allows numbers", () => {
    expect(validateName("setup1")).toBeNull();
    expect(validateName("123")).toBeNull();
  });
});
