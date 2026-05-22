import { contextBridge, ipcRenderer } from "electron";
import type { ReviewItem, SessionStats } from "../shared/types.js";

const api = {
  pending: (): Promise<ReviewItem[]> => ipcRenderer.invoke("queue:pending"),
  all: (): Promise<ReviewItem[]> => ipcRenderer.invoke("queue:all"),
  sessions: (): Promise<SessionStats[]> => ipcRenderer.invoke("stats:sessions"),
  runScout: (): Promise<SessionStats> => ipcRenderer.invoke("scout:run"),
  approve: (id: string, editedDraft?: string): Promise<{ ok: boolean; error?: string; signals?: string[] }> =>
    ipcRenderer.invoke("review:approve", { id, editedDraft }),
  reject: (id: string): Promise<ReviewItem[]> => ipcRenderer.invoke("review:reject", id),
};

contextBridge.exposeInMainWorld("agentMkt", api);
export type AgentMktApi = typeof api;
