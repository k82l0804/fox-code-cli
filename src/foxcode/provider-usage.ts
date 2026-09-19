export type UsageWindowLike = {
  resource?: string
  period?: { unit: "hour" | "day" | "week" | "month"; value: number }
  used?: number
  limit?: number
  remaining?: number
  unit?: string
  state?: "unlimited" | "not_in_plan" | "unknown" | "exhausted" | "active"
  orientation?: "used_percent" | "remaining_percent" | "amount" | "count" | string
  resetAt?: string | null
}

export function windowLabel(window: UsageWindowLike): string {
  if (window.period) {
    const { unit, value } = window.period
    const p = value === 1 ? `${unit}ly` : `${value} ${unit}s`
    return window.resource && window.resource !== "subscription" ? `${window.resource} (${p})` : p
  }
  return window.resource ?? "Quota"
}

export function formatWindow(window: UsageWindowLike): string {
  if (window.state === "unlimited") return "Unlimited"
  if (window.remaining !== undefined && window.limit !== undefined) {
    return `${window.remaining} / ${window.limit} remaining`
  }
  if (window.used !== undefined && window.limit !== undefined) {
    return `${window.used} / ${window.limit} used`
  }
  return window.state ?? "Unknown"
}
