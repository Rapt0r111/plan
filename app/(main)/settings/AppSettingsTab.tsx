"use client";

import { useEffect, useState } from "react";

type SettingsPayload = Record<string, unknown>;

export function AppSettingsTab() {
  const [settings, setSettings] = useState<SettingsPayload>({});
  const [name, setName] = useState("TaskFlow");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings/app")
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) return;
        setSettings(data.data);
        const product = data.data.product as { name?: string } | undefined;
        if (product?.name) setName(product.name);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const product = {
      ...(settings.product as Record<string, unknown> | undefined),
      name,
      mode: "b2b-single-tenant",
      offlineRequired: false,
    };
    const response = await fetch("/api/settings/app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    });
    const data = await response.json();
    if (data.ok) {
      setSettings(data.data);
      setMessage("Настройки сохранены");
    } else {
      setMessage(data.error ?? "Не удалось сохранить настройки");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          SaaS-настройки приложения
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Единый single-tenant профиль, базовые политики и параметры продукта.
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Профиль продукта</h3>
        </div>
        <div className="p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Название</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard label="SaaS-модель" value="B2B single-tenant" />
            <InfoCard label="Offline-режим" value="Не обязателен" />
            <InfoCard label="Аудит" value="Включен" />
            <InfoCard label="Отчеты" value="CSV / HTML" />
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: saving ? "var(--glass-01)" : "linear-gradient(135deg, var(--accent-500), var(--accent-400))",
              color: saving ? "var(--text-muted)" : "white",
            }}
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
          {message && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{message}</p>}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm mt-1" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
