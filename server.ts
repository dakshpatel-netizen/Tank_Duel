import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { RoomManager } from './server/roomManager';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);
  const roomManager = new RoomManager();

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true, rooms: roomManager.getRoomCount() });
  });

  // WebSocket endpoint on /ws (same port as HTTP)
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
  wss.on('connection', (ws) => {
    roomManager.handleConnection(ws);
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tank Duel Online server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    roomManager.dispose();
    wss.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start Tank Duel Online server:', err);
  process.exit(1);
});
