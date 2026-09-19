import { FoxMarkdown } from "../config/markdown"

export namespace KilocodeInstruction {
  export function content(text: string, item: string, options: FoxMarkdown.Options) {
    return FoxMarkdown.substitute(text, item, options)
  }

  export async function read(item: string, options: FoxMarkdown.Options) {
    return content(await FoxMarkdown.read(item, options), item, options)
  }
}
