import { Plugin } from "./plugin";

export class PluginManager {
  private plugins: Plugin[] = [];
  private loadedPlugins: Plugin[] = [];

  register(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  async loadAll(): Promise<{ loaded: string[]; failed: string[] }> {
    const loaded: string[] = [];
    const failed: string[] = [];

    for (const plugin of this.plugins) {
      try {
        await plugin.init();
        this.loadedPlugins.push(plugin);
        loaded.push(plugin.name);
      } catch (err) {
        failed.push(plugin.name);
      }
    }

    return { loaded, failed };
  }

  async unloadAll(): Promise<void> {
    const reversed = [...this.loadedPlugins].reverse();
    for (const plugin of reversed) {
      try {
        await plugin.shutdown();
      } catch (err) {
        // Suppress shutdown errors
      }
    }
    this.loadedPlugins = [];
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }
}
