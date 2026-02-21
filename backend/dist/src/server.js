"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.createServerWithConnectRpc = createServerWithConnectRpc;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const connectRpcService_js_1 = require("./services/connectRpcService.js");
const agent_routes_js_1 = __importDefault(require("./routes/agent.routes.js"));
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    // Only parse JSON for non-ConnectRPC routes
    app.use((req, res, next) => {
        if (req.path.startsWith('/crypto.ticker.TickerService') ||
            req.path.includes('Connect') ||
            req.headers['content-type']?.includes('application/proto')) {
            // Skip JSON parsing for ConnectRPC routes
            next();
        }
        else {
            express_1.default.json()(req, res, next);
        }
    });
    // healthcheck
    app.get('/health', (_, res) => res.json({ status: 'ok' }));
    // Agent routes
    app.use('/api/agent', agent_routes_js_1.default);
    // ConnectRPC stats endpoint
    app.get('/api/stats', (_, res) => {
        res.json({ message: 'ConnectRPC stats endpoint - stats will be available when ConnectRPC service is initialized' });
    });
    return app;
}
function createServerWithConnectRpc() {
    const app = createApp();
    const server = (0, http_1.createServer)(app);
    // Initialize ConnectRPC service
    const connectRpcService = new connectRpcService_js_1.ConnectRpcService();
    const middleware = connectRpcService.createMiddleware();
    // Mount ConnectRPC middleware
    app.use(middleware);
    // Update stats endpoint to use ConnectRPC service
    app.get('/api/stats', (_, res) => {
        res.json(connectRpcService.getStats());
    });
    return { server, connectRpcService };
}
