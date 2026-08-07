/**
 * client/src/hooks/useWebRTC.js
 * Custom hook for WebRTC P2P DataChannel file transfer with STUN fallback
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal RTCDataChannel performance

export function useWebRTC({ socket, sessionId, role, onFileReceived }) {
  const [peerState, setPeerState] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'failed'
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const incomingFileRef = useRef({ buffer: [], meta: null, receivedSize: 0 });

  // Cleanup current peer connection
  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setPeerState('disconnected');
  }, []);

  // Set up DataChannel event handlers (for receiving peer)
  const setupDataChannelEvents = useCallback((channel) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('[WebRTC] DataChannel Open!');
      setPeerState('connected');
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel Closed');
      setPeerState('disconnected');
    };

    channel.onerror = (err) => {
      console.error('[WebRTC] DataChannel Error:', err);
      setPeerState('failed');
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const meta = JSON.parse(event.data);
          if (meta.type === 'FILE_START') {
            incomingFileRef.current = {
              meta: meta.file,
              buffer: [],
              receivedSize: 0,
            };
          } else if (meta.type === 'FILE_END') {
            const { meta: fileMeta, buffer } = incomingFileRef.current;
            const blob = new Blob(buffer, { type: fileMeta.mimeType });
            const fileUrl = URL.createObjectURL(blob);
            
            const fileRecord = {
              id: `${Date.now()}_${Math.random()}`,
              originalName: fileMeta.name,
              size: fileMeta.size,
              mimeType: fileMeta.mimeType,
              savedAt: new Date().toISOString(),
              deviceName: fileMeta.deviceName || 'WebRTC Mobile',
              downloadUrl: fileUrl,
              previewUrl: fileUrl,
              isP2P: true,
            };

            if (onFileReceived) onFileReceived(fileRecord);
            incomingFileRef.current = { buffer: [], meta: null, receivedSize: 0 };
          }
        } catch {}
      } else {
        // Binary Chunk
        incomingFileRef.current.buffer.push(event.data);
        incomingFileRef.current.receivedSize += event.data.byteLength;
      }
    };
  }, [onFileReceived]);

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    setPeerState('connecting');

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice_candidate', {
          sessionId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection State:', pc.connectionState);
      if (pc.connectionState === 'connected') setPeerState('connected');
      if (pc.connectionState === 'failed') setPeerState('failed');
    };

    pc.ondatachannel = (event) => {
      dataChannelRef.current = event.channel;
      setupDataChannelEvents(event.channel);
    };

    return pc;
  }, [socket, sessionId, setupDataChannelEvents]);

  // Initiate P2P Connection (Mobile calls this)
  const initiateConnect = useCallback(async () => {
    if (!socket || !sessionId) return;
    const pc = createPeerConnection();

    // Create DataChannel on initiator side
    const dc = pc.createDataChannel('wifiDropDataChannel');
    dataChannelRef.current = dc;
    setupDataChannelEvents(dc);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal_offer', { sessionId, offer });
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
      setPeerState('failed');
    }
  }, [socket, sessionId, createPeerConnection, setupDataChannelEvents]);

  // Send file via WebRTC DataChannel
  const sendFileP2P = useCallback((file, deviceName, onProgress) => {
    return new Promise((resolve, reject) => {
      const channel = dataChannelRef.current;
      if (!channel || channel.readyState !== 'open') {
        return reject(new Error('P2P DataChannel is not open'));
      }

      // Send File Start metadata
      channel.send(JSON.stringify({
        type: 'FILE_START',
        file: {
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          deviceName,
        },
      }));

      const reader = new FileReader();
      let offset = 0;

      reader.onload = (e) => {
        if (!channel || channel.readyState !== 'open') {
          return reject(new Error('P2P Channel closed mid-transfer'));
        }

        channel.send(e.target.result);
        offset += e.target.result.byteLength;
        const progress = Math.round((offset / file.size) * 100);
        if (onProgress) onProgress(progress);

        if (offset < file.size) {
          readNextChunk();
        } else {
          channel.send(JSON.stringify({ type: 'FILE_END' }));
          resolve({ success: true, isP2P: true });
        }
      };

      reader.onerror = (err) => reject(err);

      function readNextChunk() {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      }

      readNextChunk();
    });
  }, []);

  // Listen to Socket signaling events
  useEffect(() => {
    if (!socket) return;

    const onOffer = async ({ from, offer }) => {
      console.log('[WebRTC] Received offer from:', from);
      const pc = createPeerConnection();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal_answer', { sessionId, answer, targetId: from });
      } catch (err) {
        console.error('[WebRTC] Offer handling error:', err);
      }
    };

    const onAnswer = async ({ answer }) => {
      console.log('[WebRTC] Received answer');
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('[WebRTC] Answer handling error:', err);
        }
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] ICE candidate error:', err);
        }
      }
    };

    socket.on('signal_offer', onOffer);
    socket.on('signal_answer', onAnswer);
    socket.on('ice_candidate', onIceCandidate);

    return () => {
      socket.off('signal_offer', onOffer);
      socket.off('signal_answer', onAnswer);
      socket.off('ice_candidate', onIceCandidate);
    };
  }, [socket, sessionId, createPeerConnection]);

  return {
    peerState,
    initiateConnect,
    sendFileP2P,
    cleanup,
  };
}
