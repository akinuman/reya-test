"use client";

import { WS_URL } from "@/lib/constants";
import type {
  WSErrorMessage,
  WSChannelMessage,
  WSIncomingMessage,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionState = "connecting" | "connected" | "disconnected";
type MessageHandler = (msg: WSChannelMessage) => void;
type ErrorHandler = (msg: WSErrorMessage) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * Shared WebSocket transport for the whole trading UI.
 *
 * Why this shape:
 * - One socket connection for many UI consumers (chart, trades, order book, etc.).
 * - Channel fan-out (Map<channel, handlers>) so feature hooks stay transport-agnostic.
 * - Auto reconnect + re-subscribe for 24/7 market streams.
 */
export function useWebSocket() {
  // Mutable socket instance; ref avoids re-renders on every network event.
  const wsRef = useRef<WebSocket | null>(null);
  // Small status surface for UI (header connection dot).
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  // Channel -> set of listeners (multiple consumers can share same channel).
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  // Channel -> set of error listeners (for channel-specific server errors).
  const errorHandlersRef = useRef<Map<string, Set<ErrorHandler>>>(new Map());
  // Tracks desired subscriptions so reconnect can restore them.
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  // Exponential backoff counter for reconnect attempts.
  const reconnectAttemptRef = useRef(0);
  // Stores pending reconnect timer for cleanup/cancel.
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents state updates after unmount.
  const mountedRef = useRef(true);
  // Timeout callback reads latest connect function without stale closure risk.
  const connectRef = useRef<() => void>(null);

  // Safe send helper: only emit frames when socket is fully open.
  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    // Avoid opening a second socket if one is already active.
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    /**
     * Why queueMicrotask here?
     * - It schedules this state update right after current sync work completes.
     * - That avoids synchronous "set state while wiring socket callbacks" chains.
     * - It runs sooner than setTimeout(0), so UI can show "connecting" quickly.
     *
     * Alternatives:
     * - Promise.resolve().then(...): similar microtask semantics, less explicit intent.
     * - setTimeout(..., 0): macrotask; slower and more jitter under load.
     * - Direct setState call: works, but can create noisier render timing during reconnect.
     */
    queueMicrotask(() => {
      if (mountedRef.current) setConnectionState("connecting");
    });

    // Create a fresh connection for this attempt.
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionState("connected");
      // Success resets backoff so the next disconnect starts from 1s again.
      reconnectAttemptRef.current = 0;

      // Re-subscribe all channels tracked as desired state.
      subscribedChannelsRef.current.forEach((channel) => {
        ws.send(JSON.stringify({ type: "subscribe", channel }));
      });
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg: WSIncomingMessage = JSON.parse(event.data);

        // Server heartbeat: reply immediately so connection stays healthy.
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          return;
        }

        // Fan out channel payload to all registered handlers for this channel.
        if (msg.type === "channel_data") {
          const channelMsg = msg as WSChannelMessage;
          const handlers = handlersRef.current.get(channelMsg.channel);
          handlers?.forEach((handler) => handler(channelMsg));
          return;
        }

        if (msg.type === "error") {
          const errorMsg = msg as WSErrorMessage;
          const channel = errorMsg.channel ?? "*";
          const handlers = errorHandlersRef.current.get(channel);
          handlers?.forEach((handler) => handler(errorMsg));

          // Also notify global listeners when channel-specific errors arrive.
          if (errorMsg.channel) {
            const globalHandlers = errorHandlersRef.current.get("*");
            globalHandlers?.forEach((handler) => handler(errorMsg));
          }
        }
      } catch {
        // Defensive: ignore malformed frames so one bad message doesn't crash UI.
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionState("disconnected");

      // Exponential backoff with cap: 1s, 2s, 4s ... up to 30s max.
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
        RECONNECT_MAX_MS,
      );
      reconnectAttemptRef.current++;

      // Retry using the latest connect function reference.
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectRef.current?.();
      }, delay);
    };

    ws.onerror = () => {
      // Normalize all failures through onclose path (single reconnect strategy).
      ws.close();
    };
  }, []);

  // Keep current connect callback in a ref so delayed retries call fresh logic.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const subscribe = useCallback(
    (channel: string, handler: MessageHandler) => {
      // Record "desired" subscription for reconnect recovery.
      subscribedChannelsRef.current.add(channel);

      // Lazily create listener set per channel.
      if (!handlersRef.current.has(channel)) {
        handlersRef.current.set(channel, new Set());
      }

      // Add this consumer's callback.
      handlersRef.current.get(channel)!.add(handler);

      // If currently connected, subscribe immediately.
      send({ type: "subscribe", channel });

      // Caller gets an unsubscribe function for cleanup on unmount/symbol switch.
      return () => {
        const handlers = handlersRef.current.get(channel);
        if (handlers) {
          handlers.delete(handler);
          // Only unsubscribe server-side when no local consumers remain.
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

  const subscribeError = useCallback(
    (channel: string, handler: ErrorHandler) => {
      if (!errorHandlersRef.current.has(channel)) {
        errorHandlersRef.current.set(channel, new Set());
      }

      errorHandlersRef.current.get(channel)!.add(handler);

      return () => {
        const handlers = errorHandlersRef.current.get(channel);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            errorHandlersRef.current.delete(channel);
          }
        }
      };
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    // Initial connection on mount.
    connect();

    return () => {
      mountedRef.current = false;
      // Cancel pending reconnect, then close socket on teardown.
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { connectionState, subscribe, subscribeError };
}
