/**
 * @file route.ts — app/api/realtime
 *
 * ═══════════════════════════════════════════════════════════════
 * SERVER-SENT EVENTS (SSE) ENDPOINT
 * ═══════════════════════════════════════════════════════════════
 *
 * Каждый браузерный клиент открывает долгоживущий GET к этому маршруту.
 * Когда сервер делает broadcast(), событие пушится во все открытые потоки.
 *
 * ТЕХНИЧЕСКИЕ ДЕТАЛИ:
 *   Content-Type: text/event-stream
 *   Формат SSE:
 *     id: <uuid>\n
 *     data: <json>\n\n
 *
 *   EventSource в браузере автоматически переподключается при потере связи.
 *   Last-Event-ID позволяет клиенту указать последний полученный event
 *   (для будущей реализации replay missed events).
 *
 * PING INTERVAL:
 *   Каждые 25 секунд отправляем комментарий (: ping) чтобы:
 *   - Предотвратить закрытие idle-соединений proxy-серверами
 *   - Поддерживать соединение через корпоративные брандмауэры
 *
 * CLEANUP:
 *   request.signal.abort срабатывает при разрыве соединения.
 *   Это удаляет обработчик из EventBus, предотвращая утечки памяти.
 *
 * force-dynamic ОБЯЗАТЕЛЕН:
 *   SSE — streaming response, Next.js должен знать что маршрут
 *   нельзя кешировать или статически оптимизировать.
 */

import { eventBus } from "@/shared/server/eventBus";
import type { RealtimeEvent } from "@/shared/server/eventBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // EventEmitter требует Node.js runtime

export function GET(request: Request): Response {
  const { signal } = request;

  const encoder = new TextEncoder();

  // ── SSE stream ─────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    start(controller) {
      // ── Register client ───────────────────────────────────────────────────
      eventBus.registerClient();

      // ── Initial connection confirmation ───────────────────────────────────
      const connectEvent: RealtimeEvent = {
        type:      "ping",
        payload:   { message: "connected", clients: eventBus.clientCount },
        timestamp: Date.now(),
        id:        crypto.randomUUID(),
      };
      enqueue(controller, connectEvent);

      // ── Event handler ─────────────────────────────────────────────────────
      const onEvent = (event: RealtimeEvent) => {
        if (signal.aborted) {
          cleanup();
          return;
        }
        try {
          enqueue(controller, event);
        } catch {
          cleanup();
        }
      };

      // ── Keep-alive ping (every 25s) ───────────────────────────────────────
      const pingInterval = setInterval(() => {
        if (signal.aborted) {
          clearInterval(pingInterval);
          return;
        }
        try {
          // SSE comment — keeps connection alive through proxies
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
        }
      }, 25_000);

      // ── Cleanup on disconnect ─────────────────────────────────────────────
      function cleanup() {
        eventBus.off("event", onEvent);
        eventBus.unregisterClient();
        clearInterval(pingInterval);
        try { controller.close(); } catch {}
      }

      eventBus.on("event", onEvent);

      signal.addEventListener("abort", cleanup, { once: true });

      // ── Format SSE message ────────────────────────────────────────────────
      function enqueue(ctrl: ReadableStreamDefaultController, event: RealtimeEvent) {
        const line = `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
        ctrl.enqueue(encoder.encode(line));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}