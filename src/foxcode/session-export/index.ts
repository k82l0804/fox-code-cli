export namespace SessionExport {
  export const enabled = false as const
  export function init(_config?: any): void {}
  export async function shutdown(): Promise<void> {}
  export function compaction(_args?: any): void {}
  export function beforeRequest(_args?: any): void {}
  export function afterRequest(_args?: any): void {}
  export function agentInfo(_agent?: any): any { return {} }
  export async function onSessionClose(_sessionId?: string, _workspaceKey?: string): Promise<void> {}
  export async function flush(): Promise<void> {}
}
