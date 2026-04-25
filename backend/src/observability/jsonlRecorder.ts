import fs from 'fs';
import path from 'path';
import type { ObservabilityEvent } from './types';

/**
 * Append-only JSONL recorder — one event per line, human-readable.
 * Backup / audit trail independent of SQLite.
 */
export class JsonlRecorder {
    private stream: fs.WriteStream;
    private filePath: string;

    constructor(filePath?: string) {
        if (filePath) {
            this.filePath = filePath;
        } else {
            const runDir = path.resolve(process.cwd(), 'logs', 'observability');
            fs.mkdirSync(runDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.filePath = path.join(runDir, `events-${stamp}.jsonl`);
        }
        this.stream = fs.createWriteStream(this.filePath, { flags: 'a' });
        console.log(`[observability] JSONL events: ${this.filePath}`);
    }

    record(event: ObservabilityEvent): void {
        try {
            this.stream.write(JSON.stringify(event) + '\n');
        } catch (err) {
            console.warn('[observability] JSONL write failed:', err);
        }
    }

    close(): void {
        this.stream.end();
    }
}

let recorderInstance: JsonlRecorder | null = null;
export function getJsonlRecorder(): JsonlRecorder {
    if (!recorderInstance) {
        recorderInstance = new JsonlRecorder();
    }
    return recorderInstance;
}
