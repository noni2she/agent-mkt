import { describe, it, expect } from "vitest";
import type { Storage, SecretStore } from "./adapters.js";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  async get(key: string) { return this.m.get(key) ?? null; }
  async set(key: string, value: string) { this.m.set(key, value); }
}

class EnvSecrets implements SecretStore {
  constructor(private env: Record<string, string>) {}
  async getSecret(name: string) { return this.env[name] ?? null; }
}

describe("adapter interfaces are implementable", () => {
  it("Storage round-trips", async () => {
    const s: Storage = new MemStorage();
    await s.set("k", "v");
    expect(await s.get("k")).toBe("v");
    expect(await s.get("missing")).toBeNull();
  });
  it("SecretStore reads", async () => {
    const s: SecretStore = new EnvSecrets({ OPENAI_API_KEY: "sk-x" });
    expect(await s.getSecret("OPENAI_API_KEY")).toBe("sk-x");
  });
});
