"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createOperativeTaskAction } from "@/entities/operative/operativeActions";
import { motion, AnimatePresence } from "framer-motion";

// ── Submit button с useFormStatus ─────────────────────────────────────────────
// Вынесен в отдельный компонент — это требование useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
      style={{
        background: "var(--accent-glow)",
        color:      "var(--accent-400)",
        border:     "1px solid rgba(139,92,246,0.3)",
        opacity:    pending ? 0.6 : 1,
        cursor:     pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Создание..." : "Создать задачу"}
    </button>
  );
}

// ── Форма ─────────────────────────────────────────────────────────────────────

interface Props {
  userId:    number;
  onCreated: () => void;
}

export function CreateTaskForm({ userId, onCreated }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  // useActionState — React 19 паттерн для серверных форм
  // Автоматически управляет pending/error состоянием
  const [state, formAction] = useActionState(
    async (_prevState: { error?: string }, formData: FormData) => {
      const result = await createOperativeTaskAction({
        userId,
        title:       formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        dueDate:     (formData.get("dueDate") as string)
          ? `${formData.get("dueDate")}T00:00:00.000Z`
          : null,
      });

      if (result?.serverError) {
        return { error: result.serverError };
      }

      formRef.current?.reset();
      onCreated();
      return {};
    },
    {}
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <AnimatePresence>
        {state.error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs px-3 py-2 rounded-lg"
            style={{
              background: "rgba(239,68,68,0.1)",
              border:     "1px solid rgba(239,68,68,0.25)",
              color:      "#f87171",
            }}
          >
            {state.error}
          </motion.p>
        )}
      </AnimatePresence>

      <input
        name="title"
        placeholder="Название задачи"
        required
        maxLength={200}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
        style={{
          background: "var(--glass-01)",
          border:     "1px solid var(--glass-border)",
          color:      "var(--text-primary)",
        }}
      />

      <textarea
        name="description"
        placeholder="Описание (опционально)"
        rows={2}
        maxLength={2000}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
        style={{
          background: "var(--glass-01)",
          border:     "1px solid var(--glass-border)",
          color:      "var(--text-primary)",
        }}
      />

      <input
        name="dueDate"
        type="date"
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{
          background:  "var(--glass-01)",
          border:      "1px solid var(--glass-border)",
          color:       "var(--text-primary)",
          colorScheme: "light dark",
        }}
      />

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}