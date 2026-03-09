import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { attachSocketServer } from './socket/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, '../public')));

const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

attachSocketServer(httpServer);

httpServer.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
    console.log(`Server is running on ${baseUrl}`);
    console.log(`Socket.io server is running on ${baseUrl.replace('http', 'socket')}/socket`);
});