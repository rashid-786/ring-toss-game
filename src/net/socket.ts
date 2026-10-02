import { io } from 'socket.io-client';

export const socket = io({ autoConnect: false, transports: ['websocket', 'polling'] });

export function connectSocket(): void {
  socket.connect();
}

export function disconnectSocket(): void {
  socket.disconnect();
}