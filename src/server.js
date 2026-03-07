import http from 'http';
import express from 'express';
import { attachSocketServer } from './socket/server.js';

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

attachSocketServer(httpServer);

httpServer.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ?  `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
    console.log(`Server is running on ${baseUrl}`);
    console.log(`Socket.io server is running on ${baseUrl.replace('http', 'socket')}/socket`);
});