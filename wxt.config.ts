import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  outDir: "dist",
  vite: () => ({ plugins: [react(), tailwindcss()] }),
  manifest: {
    name: "agent-mkt hands (dev)",
    permissions: ["alarms", "tabs", "sidePanel"],
    host_permissions: [
      "http://localhost/*",
      "http://127.0.0.1/*",
      "https://www.threads.com/*",
      "https://www.threads.net/*",
    ],
  },
});
