import { Plugin } from "./plugin";

export class PluginManager {
  // TODO: implement plugin manager
  register(plugin: Plugin): void {}

  async loadAll(): Promise<{ loaded: string[]; failed: string[] }> {
    return { loaded: [], failed: [] };
  }

  async unloadAll(): Promise<void> {}

  getPlugin(name: string): Plugin | undefined {
    return undefined;
  }
}
