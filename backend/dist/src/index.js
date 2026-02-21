"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const server_1 = require("./server");
const constants_1 = require("./config/constants");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PORT = process.env.PORT ? parseInt(process.env.PORT) : constants_1.CONFIG.DEFAULT_PORT;
async function main() {
    // Prepare run-specific log directory and file
    const logsRoot = path_1.default.resolve(process.cwd(), 'logs');
    const runDir = path_1.default.join(logsRoot, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    fs_1.default.mkdirSync(runDir, { recursive: true });
    const logFilePath = path_1.default.join(runDir, 'backend.log');
    // Simple stream logger that mirrors stdout/stderr
    const logStream = fs_1.default.createWriteStream(logFilePath, { flags: 'a' });
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk, ...args) => {
        try {
            logStream.write(chunk);
        }
        catch { }
        return originalStdoutWrite(chunk, ...args);
    });
    process.stderr.write = ((chunk, ...args) => {
        try {
            logStream.write(chunk);
        }
        catch { }
        return originalStderrWrite(chunk, ...args);
    });
    console.log(`[logging] Writing backend logs to: ${logFilePath}`);
    const { server } = (0, server_1.createServerWithConnectRpc)();
    server.listen(PORT, () => {
        const host = constants_1.CONFIG.DEFAULT_HOST;
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
