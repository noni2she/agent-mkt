import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  parseClientMessage,
  type Command,
  type ResponseEnvelope,
  type RequestEnvelope,
} from "../core/protocol.js";

interface Pending {
  resolve: (r: ResponseEnvelope) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/** WS server：管理 hands 連線（依 tenant）並做請求/回應配對。 */
export class Gateway {
  private wss: WebSocketServer | null = null;
  private readonly conns = new Map<string, WebSocket>();
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly port: number) {}

  /** 啟動並回傳實際監聽的 port（傳 0 時由 OS 配）。 */
  listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ port: this.port }, () => {
        const addr = wss.address();
        const actual = typeof addr === "object" && addr ? addr.port : this.port;
        resolve(actual);
      });
      wss.once("error", (err) => reject(err));
      wss.on("connection", (ws) => this.onConnection(ws));
      this.wss = wss;
    });
  }

  private onConnection(ws: WebSocket): void {
    let tenant: string | null = null;
    ws.on("message", (data) => {
      let msg;
      try {
        msg = parseClientMessage(data.toString());
      } catch {
        return;
      }
      if (msg.type === "hello") {
        // 同一 tenant 若有新連線，採 last-write-wins 覆寫。舊 socket 的 close handler 以
        // identity guard 確保不誤刪新連線；舊連線殘留的 pending 會在 timeout 後自然清除。
        tenant = msg.tenant;
        this.conns.set(tenant, ws);
        return;
      }
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        p.resolve(msg);
      }
    });
    ws.on("close", () => {
      if (tenant && this.conns.get(tenant) === ws) this.conns.delete(tenant);
    });
  }

  /** 對某 tenant 的 hands 派一個指令，等回應或逾時。 */
  sendCommand(tenant: string, command: Command, timeoutMs = 30_000): Promise<ResponseEnvelope> {
    const ws = this.conns.get(tenant);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`no connection for tenant: ${tenant}`));
    }
    const id = randomUUID();
    const env: RequestEnvelope = { type: "request", id, command };
    return new Promise<ResponseEnvelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`command timeout for tenant ${tenant} (${command.action})`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        ws.send(JSON.stringify(env));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** 該 tenant 目前是否有 active 連線（排程派工前檢查）。 */
  isConnected(tenant: string): boolean {
    const ws = this.conns.get(tenant);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  close(): Promise<void> {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("gateway closing"));
    }
    this.pending.clear();
    this.conns.clear();
    const wss = this.wss;
    this.wss = null;
    return new Promise((resolve) => {
      if (!wss) return resolve();
      // Terminate all active connections so wss.close() callback fires promptly.
      for (const client of wss.clients) client.terminate();
      wss.close(() => resolve());
    });
  }
}
