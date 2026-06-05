import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Persona } from "../core/types.js";

/** 讀 persona yaml（現在 configs/persona_example.yaml；Plan 4b 改 tenant_config）。 */
export function loadPersona(path = process.env.PERSONA_FILE ?? "configs/persona_example.yaml"): Persona {
  return parse(readFileSync(path, "utf8")) as Persona;
}
