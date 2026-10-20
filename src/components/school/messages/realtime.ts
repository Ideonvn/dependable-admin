// src/components/school/messages/realtime.ts
// Ported from dependable-app services/realtime.ts; keep the two in step.
//
// Chat realtime: one WebSocket while the Messages tab is open.
//
// The server sends ids only ("chat.message" | "chat.updated" for a conversation,
// "chat.typing", "resync"); the UI reacts by fetching through the REST API, which
// is where access rules live. Polling stays as the fallback, so a dead socket
// costs latency, never messages.
//
// Protocol: dependable-api app/realtime/router.py.

import { tokenService } from '@/lib/tokenService';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type RealtimeEvent =
  | { type: 'chat.message' | 'chat.updated'; school_id: string; conversation_id: string }
  | { type: 'chat.typing'; school_id: string; conversation_id: string; user_id: string; display_name: string }
  | { type: 'resync' }
  | { type: 'connected' } // (re)connected: anything may have been missed
  | { type: 'disconnected' };

type Listener = (event: RealtimeEvent) => void;

const HEARTBEAT_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;

export const realtimeUrl = (apiUrl: string = API_URL): string =>
  `${apiUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/realtime`;

/** Exponential backoff with jitter: ~1s, 2s, 4s … capped at 30s. */
export const backoffMs = (attempt: number, random: () => number = Math.random): number => {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.75 + random() * 0.5));
};

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private running = false;
  private open = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  // Bumped by every start/stop. A connect() that awaited the token across a
  // stop+start must not open a second socket, and a stale socket's handlers
  // must not touch the current one's timers or state.
  private generation = 0;

  constructor(
    // Read only. tokenService.getValidToken() without the Google ID token clears
    // the stored token when it can't refresh, which signs the admin out; the API
    // client (polling keeps calling it) does the refreshing, and a retry here
    // picks up the fresh token.
    private readonly getToken: () => Promise<string | null | undefined> = async () =>
      tokenService.isTokenValid() ? tokenService.getAccessToken() : null,
    private readonly url: () => string = () => realtimeUrl(),
  ) {}

  isOpen(): boolean {
    return this.open;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    this.generation += 1;
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.generation += 1;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close(1000);
    }
    this.setClosed();
  }

  /** Throttled by the caller; the server throttles too. */
  sendTyping(conversationId: string): void {
    if (this.open && this.ws) this.ws.send(JSON.stringify({ type: 'typing', conversation_id: conversationId }));
  }

  private emit(event: RealtimeEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // one bad listener must not break the others
      }
    });
  }

  private async connect(): Promise<void> {
    if (!this.running) return;
    const generation = this.generation;
    const token = await this.getToken();
    if (!this.running || generation !== this.generation || this.ws) return;
    if (!token) {
      this.scheduleReconnect();
      return;
    }
    const ws = new WebSocket(this.url());
    this.ws = ws;
    const current = () => this.ws === ws && generation === this.generation;
    ws.onopen = () => {
      if (!current()) return;
      // The token goes in the first frame, never the URL (proxy logs).
      ws.send(JSON.stringify({ type: 'auth', token }));
    };
    ws.onmessage = (message) => {
      if (!current()) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let event: any;
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return;
      }
      if (event?.type === 'ready') {
        this.open = true;
        this.attempt = 0;
        this.startHeartbeat();
        this.emit({ type: 'connected' });
      } else if (event?.type === 'pong') {
        if (this.pongTimer) clearTimeout(this.pongTimer);
        this.pongTimer = null;
      } else if (event?.type) {
        this.emit(event as RealtimeEvent);
      }
    };
    ws.onerror = () => {
      // onclose follows and handles reconnecting
    };
    ws.onclose = (close) => {
      if (!current()) return; // a superseded socket: leave the live one alone
      this.ws = null;
      this.clearTimers();
      this.setClosed();
      if (!this.running) return;
      // 4401: token expired or rejected; the retry reads the token the API client
      // has refreshed meanwhile. 4429: too many sockets.
      if (close?.code === 4429) this.attempt = Math.max(this.attempt, 5);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return;
    const delay = backoffMs(this.attempt);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || !this.open) return;
      this.ws.send(JSON.stringify({ type: 'ping' }));
      if (this.pongTimer) return;
      // No pong: the connection is dead even if the OS hasn't noticed (NAT, Wi-Fi switch).
      this.pongTimer = setTimeout(() => {
        this.pongTimer = null;
        this.abandon();
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  /**
   * Give up on the current socket now. close() on a dead path only starts the
   * closing handshake; onclose can take minutes, and until then the client
   * stayed "open" (threads polled at the slow rate) and couldn't reconnect.
   */
  private abandon(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try {
        ws.close(4000);
      } catch {
        // already closing
      }
    }
    this.clearTimers();
    this.setClosed();
    if (this.running) this.scheduleReconnect();
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.pongTimer = null;
  }

  private setClosed(): void {
    if (this.open) {
      this.open = false;
      this.emit({ type: 'disconnected' });
    }
  }
}

export const realtime = new RealtimeClient();
