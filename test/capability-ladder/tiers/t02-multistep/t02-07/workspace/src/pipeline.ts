export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface RecordItem {
  id: string;
  data: string;
}

export class PipelineRunner {
  constructor(private logger: Logger) {}

  fetchRecord(id: string): RecordItem {
    // Missing logger call
    return { id, data: `raw-${id}` };
  }

  transformRecord(record: RecordItem): RecordItem {
    // Missing logger call
    return { id: record.id, data: record.data.toUpperCase() };
  }

  validateRecord(record: RecordItem): boolean {
    // Missing logger calls
    return record.data.length > 0;
  }

  persistRecord(record: RecordItem): boolean {
    // Missing logger call
    return true;
  }
}
