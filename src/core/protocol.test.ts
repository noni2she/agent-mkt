import { describe, it, expect } from "vitest";
import { parseClientMessage, RequestEnvelope } from "./protocol.js";

describe("parseClientMessage", () => {
  it("parses a hello message", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "hello", tenant: "us" }));
    expect(msg).toEqual({ type: "hello", tenant: "us" });
  });
  it("parses a response envelope", () => {
    const raw = JSON.stringify({ type: "response", id: "abc", status: "ok", payload: "pong" });
    const msg = parseClientMessage(raw);
    expect(msg).toEqual({ type: "response", id: "abc", status: "ok", payload: "pong" });
  });
  it("throws on malformed json", () => {
    expect(() => parseClientMessage("{not json")).toThrow();
  });
  it("throws on unknown shape", () => {
    expect(() => parseClientMessage(JSON.stringify({ foo: 1 }))).toThrow();
  });

  it("builds a ping request envelope", () => {
    const env: RequestEnvelope = { type: "request", id: "x", command: { action: "ping" } };
    expect(env.command.action).toBe("ping");
  });
});
