import 'dotenv/config';
import { createServerWithConnectRpc } from './server';
import { CONFIG } from './config/constants';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : CONFIG.DEFAULT_PORT;

async function main() {
  // Prepare run-specific log directory and file
  const logsRoot = path.resolve(process.cwd(), 'logs');
  const runDir = path.join(logsRoot, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(runDir, { recursive: true });
  const logFilePath = path.join(runDir, 'backend.log');

  // Simple stream logger that mirrors stdout/stderr
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: any, ...args: any[]) => {
    try { logStream.write(chunk); } catch { }
    return originalStdoutWrite(chunk, ...args);
  }) as any;
  process.stderr.write = ((chunk: any, ...args: any[]) => {
    try { logStream.write(chunk); } catch { }
    return originalStderrWrite(chunk, ...args);
  }) as any;

  console.log(`[logging] Writing backend logs to: ${logFilePath}`);

  const { server } = createServerWithConnectRpc();

  server.listen(PORT, () => {
    const host = CONFIG.DEFAULT_HOST;
    console.log(`[backend] Listening on http://${host}:${PORT}`);
    console.log(`[backend] ConnectRPC endpoint: http://${host}:${PORT}/crypto.ticker.TickerService/`);
    console.log(`[backend] Health check: http://${host}:${PORT}/health`);
    console.log(`[backend] Stats endpoint: http://${host}:${PORT}/api/stats`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});