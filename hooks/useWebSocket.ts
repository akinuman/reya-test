"use client";

import { WS_URL } from "@/lib/constants";
import type { WSChannelMessage, WSIncomingMessage } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionState = "connecting" | "connected" | "disconnected";
type MessageHandler = (msg: WSChannelMessage) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>(null);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Set connecting state asynchronously to avoid cascading renders
    // On mount, the initial state is already "connecting"
    // On reconnect, this runs from a setTimeout callback (async context)
    queueMicrotask(() => {
      if (mountedRef.current) setConnectionState("connecting");
    });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionState("connected");
      reconnectAttemptRef.current = 0;

      // Re-subscribe to all channels
      subscribedChannelsRef.current.forEach((channel) => {
        ws.send(JSON.stringify({ type: "subscribe", channel }));
      });
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg: WSIncomingMessage = JSON.parse(event.data);

        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          return;
        }

        if (msg.type === "channel_data") {
          const channelMsg = msg as WSChannelMessage;
          const handlers = handlersRef.current.get(channelMsg.channel);
          handlers?.forEach((handler) => handler(channelMsg));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionState("disconnected");

      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
        RECONNECT_MAX_MS,
      );
      reconnectAttemptRef.current++;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectRef.current?.();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const subscribe = useCallback(
    (channel: string, handler: MessageHandler) => {
      subscribedChannelsRef.current.add(channel);

      if (!handlersRef.current.has(channel)) {
        handlersRef.current.set(channel, new Set());
      }

      handlersRef.current.get(channel)!.add(handler);

      // Send subscribe if already connected
      send({ type: "subscribe", channel });

      // Return unsubscribe function
      return () => {
        const handlers = handlersRef.current.get(channel);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            handlersRef.current.delete(channel);
            subscribedChannelsRef.current.delete(channel);
            send({ type: "unsubscribe", channel });
          }
        }
      };
    },
    [send],
  );

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { connectionState, subscribe };
}
