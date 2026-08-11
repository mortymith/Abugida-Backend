import { describe, it, expect } from "bun:test";
import { isProduction, isDevelopment, isTest, parseEnvironment } from "../src/core/environment";

describe("environment helpers", () => {
  it("isProduction is true only for production", () => {
    expect(isProduction({ environment: "production" })).toBe(true);
    expect(isProduction({ environment: "development" })).toBe(false);
    expect(isProduction({ environment: "test" })).toBe(false);
  });

  it("isDevelopment is true only for development", () => {
    expect(isDevelopment({ environment: "development" })).toBe(true);
    expect(isDevelopment({ environment: "production" })).toBe(false);
  });

  it("isTest is true only for test", () => {
    expect(isTest({ environment: "test" })).toBe(true);
    expect(isTest({ environment: "production" })).toBe(false);
  });
});

describe("parseEnvironment", () => {
  it("passes through recognized values", () => {
    expect(parseEnvironment("production")).toBe("production");
    expect(parseEnvironment("test")).toBe("test");
    expect(parseEnvironment("development")).toBe("development");
  });

  it("defaults to development for unrecognized or missing values", () => {
    expect(parseEnvironment(undefined)).toBe("development");
    expect(parseEnvironment("staging")).toBe("development");
    expect(parseEnvironment("")).toBe("development");
  });
});
