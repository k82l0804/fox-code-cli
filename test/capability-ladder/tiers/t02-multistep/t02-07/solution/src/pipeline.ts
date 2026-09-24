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
    this.logger.info(`[pipeline] fetching record ${id}`);
    return { id, data: `raw-${id}` };
  }

  transformRecord(record: RecordItem): RecordItem {
    this.logger.info(`[pipeline] transforming record ${record.id}`);
    return { id: record.id, data: record.data.toUpperCase() };
  }

  validateRecord(record: RecordItem): boolean {
    if (record.data.length > 0) {
      this.logger.info(`[pipeline] validating record ${record.id}`);
      return true;
    } else {
      this.logger.warn(`[pipeline] invalid record ${record.id}`);
      return false;
    }
  }

  persistRecord(record: RecordItem): boolean {
    this.logger.info(`[pipeline] persisting record ${record.id}`);
    return true;
  }
}
