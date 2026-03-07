import { Server } from "socket.io";

export function attachSocketServer(httpServer) {
    const io = new Server(httpServer, { 
        cors: {
            origin: ['http://localhost:3030'],
            credentials: true,
        }
    });

    io.on("connection", (socket) => {
        // ...
    });
}