import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ConnectRpcService } from './services/connectRpcService.js';
import agentRoutes from './routes/agent.routes.js';

export function createApp() {
  const app = express();
  app.use(cors());

  // Only parse JSON for non-ConnectRPC routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/crypto.ticker.TickerService') ||
      req.path.includes('Connect') ||
      req.headers['content-type']?.includes('application/proto')) {
      // Skip JSON parsing for ConnectRPC routes
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // healthcheck
  app.get('/health', (_: Request, res: Response) => res.json({ status: 'ok' }));

  // Agent routes
  app.use('/api/agent', agentRoutes);

  // ConnectRPC stats endpoint
  app.get('/api/stats', (_: Request, res: Response) => {
    res.json({ message: 'ConnectRPC stats endpoint - stats will be available when ConnectRPC service is initialized' });
  });

  return app;
}

export function createServerWithConnectRpc() {
  const app = createApp();
  const server = createServer(app);

  // Initialize ConnectRPC service
  const connectRpcService = new ConnectRpcService();
  const middleware = connectRpcService.createMiddleware();

  // Mount ConnectRPC middleware
  app.use(middleware);

  // Update stats endpoint to use ConnectRPC service
  app.get('/api/stats', (_: Request, res: Response) => {
    res.json(connectRpcService.getStats());
  });

  return { server, connectRpcService };
}