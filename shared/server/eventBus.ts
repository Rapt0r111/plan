/**
 * @file eventBus.ts — shared/server
 *
 * ═══════════════════════════════════════════════════════════════
 * REAL-TIME EVENT BUS
 * ═══════════════════════════════════════════════════════════════
 *
 * Singleton EventEmitter для сервера. Живёт в памяти процесса.
 *
 * АРХИТЕКТУРА (2026-2027 паттерн):
 *   Route Handler мутирует БД → вызывает broadcast() →
 *   EventBus emit → SSE /api/realtime отправляет event всем клиентам →
 *   useServerEvents в браузере обновляет Zustand store.
 *
 * ПОЧЕМУ НЕ WEBSOCKETS:
 *   SSE (Server-Sent Events) оптимальны для этого use-case:
 *   - Серверные push-обновления (unidirectional) — именно то, что нужно
 *   - Нативная поддержка в Next.js App Router без кастомного сервера
 *   - Встроенный reconnect в EventSource (браузерный API)
 *   - Меньше overhead чем WebSocket для read-heavy сценариев
 *   - Работает через HTTP/2 multiplexing
 *
 * ПОЧЕМУ Symbol.for():
 *   В Next.js dev-режиме модули могут перезагружаться при HMR.
 *   Symbol.for() гарантирует что singleton переживёт hot-reload,
 *   так как Symbol.for() обращается к глобальному реестру символов.
 *
 * МАСШТАБИРОВАНИЕ:
 *   Для multi-instance деплоя замените EventEmitter на Redis PubSub:
 *   import { createClient } from "redis"; client.subscribe("realtime", ...)
 *   Для 7 пользователей на одном сервере — in-process достаточно.
 */

import { EventEmitter } from "events";

// ── Event types ───────────────────────────────────────────────────────────────

export type RealtimeEventType =
  | "task:created"
  | "task:updated"
  | "task:deleted"
  | "task:assignee:added"
  | "task:assignee:removed"
  | "task:subtask:toggled"
  | "epic:created"
  | "epic:updated"
  | "epic:deleted"
  | "ping";

export interface RealtimeEvent<T = Record<string, unknown>> {
  type:      RealtimeEventType;
  payload:   T;
  timestamp: number;
  /** Server-generated unique event ID for EventSource lastEventId */
  id:        string;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

class RealtimeEventBus extends EventEmitter {
  private _clientCount = 0;

  /** Notify all SSE subscribers of a mutation */
  broadcast<T = Record<string, unknown>>(
    type:    RealtimeEventType,
    payload: T,
  ): void {
    const event: RealtimeEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      id:        crypto.randomUUID(),
    };
    this.emit("event", event);
  }

  /** Track connected SSE clients for monitoring */
  registerClient():   void { this._clientCount++; }
  unregisterClient(): void { this._clientCount = Math.max(0, this._clientCount - 1); }
  get clientCount():  number { return this._clientCount; }
}

// Global symbol survives Next.js HMR module reloads in dev
const SYMBOL = Symbol.for("plan:realtimeEventBus");
type GlobalWithBus = typeof globalThis & { [SYMBOL]?: RealtimeEventBus };

const g = globalThis as GlobalWithBus;

if (!g[SYMBOL]) {
  const bus = new RealtimeEventBus();
  bus.setMaxListeners(256); // 256 concurrent SSE connections max
  g[SYMBOL] = bus;
}

export const eventBus: RealtimeEventBus = g[SYMBOL]!;

// ── Convenience broadcast function ───────────────────────────────────────────

/**
 * broadcast — shorthand для eventBus.broadcast().
 * Import this in Route Handlers after DB mutations.
 *
 * @example
 * await updateTask(taskId, patch);
 * revalidateTag(EPICS_CACHE_TAG);
 * broadcast("task:updated", { taskId, patch });
 */
export function broadcast<T = Record<string, unknown>>(
  type:    RealtimeEventType,
  payload: T,
): void {
  eventBus.broadcast(type, payload);
}