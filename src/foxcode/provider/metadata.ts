export const iconNames: string[] = [
  "fox",
  "opencode",
  "openai",
]
export type IconName = string

export type ProviderMetadata = {
  noteKey?: string
  icon?: string
  priority?: number
}

const notes: Record<string, string> = {
  kilo: "settings.providers.note.kilo",
  opencode: "settings.providers.note.opencode",
  openai: "settings.providers.note.openai",
}

const order = ["fox", "openai"] as const

const priority = new Map<string, number>(order.map((id, index) => [id, index]))

const icons = new Set<string>(iconNames)

function key(id: string) {
  return id
}

export function providerMetadata(id: string): ProviderMetadata {
  const name = key(id)
  const note = notes[name]
  return {
    noteKey: note,
    icon: icons.has(name as IconName) ? name : "synthetic",
    priority: priority.get(name),
  }
}
