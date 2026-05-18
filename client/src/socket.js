import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  timeout: 10000,
});
