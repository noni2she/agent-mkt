import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { Gateway } from "./gateway.js";
import { parseClientMessage } from "../core/protocol.js";

let gw: Gateway;
afterEach(async () => { await gw?.close(); });

/** 啟一個假 hands：連入、hello、對 ping 回 pong。 */
function fakeHands(port: number, tenant: string): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on("open", () => ws.send(JSON.stringify({ type: "hello", tenant })));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "request" && msg.command.action === "ping") {
        ws.send(JSON.stringify({ type: "response", id: msg.id, status: "ok", payload: "pong" }));
      }
    });
    ws.on("open", () => setTimeout(() => resolve(ws), 50));
  });
}

describe("Gateway", () => {
  it("dispatches a command to a registered tenant and resolves the response", async () => {
    gw = new Gateway(0);
    const port = await gw.listen();
    const hands = await fakeHands(port, "us");

    const res = await gw.sendCommand("us", { action: "ping" }, 2000);
    expect(res.status).toBe("ok");
    expect(res.payload).toBe("pong");
    hands.close();
  });

  it("rejects when tenant has no connection", async () => {
    gw = new Gateway(0);
    await gw.listen();
    await expect(gw.sendCommand("nobody", { action: "ping" }, 500)).rejects.toThrow(/no connection/i);
  });

  it("rejects on timeout when hands never responds", async () => {
    gw = new Gateway(0);
    const port = await gw.listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", () => { ws.send(JSON.stringify({ type: "hello", tenant: "silent" })); setTimeout(r, 50); }));
    await expect(gw.sendCommand("silent", { action: "ping" }, 300)).rejects.toThrow(/timeout/i);
    ws.close();
  });

  it("ignores malformed client messages without crashing", async () => {
    gw = new Gateway(0);
    const port = await gw.listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", r));
    ws.send("{not json");
    const hands = await fakeHands(port, "us");
    const res = await gw.sendCommand("us", { action: "ping" }, 2000);
    expect(res.payload).toBe("pong");
    ws.close(); hands.close();
  });
});

void parseClientMessage;
