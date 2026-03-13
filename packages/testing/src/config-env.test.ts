import { describe, it, expect } from "vitest";
import { loadBaseEnv, loadApiEnv } from "@pkg/config";

describe("env validation", () => {
  it("parses minimal api env", () => {
    const env = loadApiEnv({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      API_PORT: "3000",
      API_HOST: "127.0.0.1",
    });
    expect(env.API_PORT).toBe(3000);
    expect(env.API_HOST).toBe("127.0.0.1");
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() =>
      loadBaseEnv({
        NODE_ENV: "development",
        LOG_LEVEL: "verbose",
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow();
  });
});
