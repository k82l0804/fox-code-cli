import { computeSecretHash } from "./helper";

export function getSecuredData(data: string): string {
  return computeSecretHash(data);
}
