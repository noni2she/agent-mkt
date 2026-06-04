import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "dist",
  manifest: {
    name: "agent-mkt hands (dev)",
    permissions: ["alarms"],
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
  },
});
