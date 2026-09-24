/**
 * Pipeline — Orchestrates parsing and formatting.
 */

import { parseAll } from "./parser";
import { formatReport } from "./formatter";

/**
 * Process raw input through the full pipeline.
 */
export function processInput(rawInput: string): string {
  const records = parseAll(rawInput);
  return formatReport(records);
}
