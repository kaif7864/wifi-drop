/**
 * client/src/hooks/useSocket.js
 * Custom hook — manages Socket.io connection lifecycle
 */

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { config } from '../config';

/**
 * @param {string} role - 'laptop' or 'mobile'
 * @param {string} [deviceName] - Name to send to server on connect
 * @param {string} [sessionId] - Unique session ID for room-based pairing
 * @returns {{ socket: Socket|null, connected: boolean }}
 */
export function useSocket(role, deviceName = 'Browser', sessionId = null) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const roleRef = useRef(role);
  const deviceNameRef = useRef(deviceName);
  const sessionIdRef = useRef(sessionId);

  roleRef.current = role;
  deviceNameRef.current = deviceName;
  sessionIdRef.current = sessionId;

  useEffect(() => {
    const socket = io(config.serverUrl, {
      transports: ['websocket', 'polling'], // websocket first for production reliability
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (sessionIdRef.current) {
        socket.emit('join_session', {
          sessionId: sessionIdRef.current,
          name: deviceNameRef.current,
          role: roleRef.current,
        });
      } else {
        socket.emit('device_identify', { name: deviceNameRef.current, role: roleRef.current });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Re-join room whenever sessionId changes or connection restores
  useEffect(() => {
    if (connected && socketRef.current && sessionId) {
      socketRef.current.emit('join_session', {
        sessionId,
        name: deviceName,
        role,
      });
    }
  }, [connected, sessionId, deviceName, role]);

  return { socket: socketRef.current, connected };
}
