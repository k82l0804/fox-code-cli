export namespace ConsoleAssets {
  export type Result = { file: string } | { missing: true }

  export async function check(input: string): Promise<boolean> {
    return false
  }

  export async function resolve(input: string): Promise<Result | undefined> {
    return undefined
  }
}
