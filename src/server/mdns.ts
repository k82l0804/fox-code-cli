export function publish(_port: number, _domain?: string) {
  // mDNS broadcasting is disabled in local telemetry-free CLI
}

export function unpublish() {
  // no-op
}

export * as MDNS from "./mdns"
