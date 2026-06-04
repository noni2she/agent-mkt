import { randomUUID } from "node:crypto";
import type { Command, ResponseEnvelope } from "../core/protocol.js";

interface Queued { id: string; command: Command; }
interface Pending {
  resolve: (r: ResponseEnvelope) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/** per-tenant 指令佇列 + 結果配對。後端入隊、hands poll 拉走、POST 回報。 */
export class CommandQueue {
  private readonly queues = new Map<string, Queued[]>();
  private readonly awaiting = new Map<string, Pending>();
  private readonly lastPoll = new Map<string, number>();

  enqueue(tenant: string, command: Command, timeoutMs = 30_000): Promise<ResponseEnvelope> {
    const id = randomUUID();
    const q = this.queues.get(tenant) ?? [];
    q.push({ id, command });
    this.queues.set(tenant, q);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.awaiting.delete(id);
        reject(new Error(`command timeout (${command.action})`));
      }, timeoutMs);
      this.awaiting.set(id, { resolve, reject, timer });
    });
  }

  drain(tenant: string): Queued[] {
    this.lastPoll.set(tenant, Date.now());
    const q = this.queues.get(tenant) ?? [];
    this.queues.set(tenant, []);
    return q;
  }

  resolveResult(res: ResponseEnvelope): void {
    const p = this.awaiting.get(res.id);
    if (!p) return;
    clearTimeout(p.timer);
    this.awaiting.delete(res.id);
    p.resolve(res);
  }

  isConnected(tenant: string, withinMs = 90_000): boolean {
    const t = this.lastPoll.get(tenant);
    return !!t && Date.now() - t < withinMs;
  }
}
