// BROKEN: points to wrong relative directory ./sub/helper instead of ./helper
import { computeSecretHash } from "./sub/helper";

export function getSecuredData(data: string): string {
  return computeSecretHash(data);
}
