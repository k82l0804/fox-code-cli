export interface Plugin {
  name: string;
  version: string;
  init(): Promise<void>;
  shutdown(): Promise<void>;
}
