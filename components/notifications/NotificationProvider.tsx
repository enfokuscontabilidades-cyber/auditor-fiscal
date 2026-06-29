"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type NotificationStatus = "running" | "success" | "error";

type DownloadAction = {
  type: "download";
  filename: string;
  mimeType: string;
  blob: Blob;
};

type DetailsAction = {
  type: "details";
  details: string;
};

export type NotificationAction = DownloadAction | DetailsAction;

export type FiscalNotification = {
  id: string;
  title: string;
  message: string;
  status: NotificationStatus;
  createdAt: number;
  completedAt?: number;
  read: boolean;
  action?: NotificationAction;
};

export type NotificationPreferences = {
  toastEnabled: boolean;
  soundEnabled: boolean;
  runningToastEnabled: boolean;
};

type ToastNotification = {
  id: string;
  title: string;
  message: string;
  status: NotificationStatus;
};

type TaskResult = {
  title?: string;
  message?: string;
  action?: NotificationAction;
};

type NotificationInput = {
  title: string;
  message: string;
  status?: NotificationStatus;
  action?: NotificationAction;
};

type RunTaskOptions = {
  title: string;
  runningMessage: string;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
};

type NotificationContextValue = {
  notifications: FiscalNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  addNotification: (input: NotificationInput) => string;
  runTask: (options: RunTaskOptions, task: () => Promise<TaskResult | void>) => Promise<void>;
  updatePreferences: (patch: Partial<NotificationPreferences>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearRead: () => void;
  triggerAction: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const PREFERENCES_KEY = "af-notification-preferences";
const DEFAULT_PREFERENCES: NotificationPreferences = {
  toastEnabled: true,
  soundEnabled: false,
  runningToastEnabled: true,
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadBlob(action: DownloadAction) {
  const url = URL.createObjectURL(action.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = action.filename;
  link.type = action.mimeType;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) as Partial<NotificationPreferences> };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function playNotificationSound(status: NotificationStatus) {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextCtor = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextCtor) return;
  const ctx = new AudioContextCtor();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = status === "error" ? 220 : status === "success" ? 660 : 440;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.25);
  window.setTimeout(() => void ctx.close(), 350);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<FiscalNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => loadPreferences());

  const showToast = useCallback((toast: Omit<ToastNotification, "id">) => {
    if (!preferences.toastEnabled) return;
    if (toast.status === "running" && !preferences.runningToastEnabled) return;
    const id = createId();
    setToasts(prev => [{ id, ...toast }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id));
    }, toast.status === "running" ? 5200 : 6200);
  }, [preferences.runningToastEnabled, preferences.toastEnabled]);

  const notifySound = useCallback((status: NotificationStatus) => {
    if (!preferences.soundEnabled || status === "running") return;
    try {
      playNotificationSound(status);
    } catch {
      // Som e bloqueios do navegador nao devem quebrar o fluxo da tarefa.
    }
  }, [preferences.soundEnabled]);

  const addNotification = useCallback((input: NotificationInput) => {
    const id = createId();
    const now = Date.now();
    const status = input.status ?? "success";
    setNotifications(prev => [{
      id,
      title: input.title,
      message: input.message,
      status,
      createdAt: now,
      completedAt: input.status === "running" ? undefined : now,
      read: false,
      action: input.action,
    }, ...prev]);
    showToast({ title: input.title, message: input.message, status });
    notifySound(status);
    return id;
  }, [notifySound, showToast]);

  const runTask = useCallback(async (options: RunTaskOptions, task: () => Promise<TaskResult | void>) => {
    const id = createId();
    const runningMessage = `${options.runningMessage} Voce pode navegar por outras paginas do sistema enquanto isso.`;
    setNotifications(prev => [{
      id,
      title: options.title,
      message: runningMessage,
      status: "running",
      createdAt: Date.now(),
      read: false,
    }, ...prev]);
    showToast({ title: options.title, message: runningMessage, status: "running" });

    try {
      const result = await task();
      const title = result?.title ?? options.successTitle ?? options.title;
      const message = result?.message ?? options.successMessage ?? "Tarefa finalizada.";
      setNotifications(prev => prev.map(item => item.id === id ? {
        ...item,
        title,
        message,
        status: "success",
        completedAt: Date.now(),
        read: false,
        action: result?.action,
      } : item));
      showToast({ title, message, status: "success" });
      notifySound("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel concluir a tarefa.";
      const title = options.errorTitle ?? "Tarefa com erro";
      setNotifications(prev => prev.map(item => item.id === id ? {
        ...item,
        title,
        message,
        status: "error",
        completedAt: Date.now(),
        read: false,
      } : item));
      showToast({ title, message, status: "error" });
      notifySound("error");
      throw err;
    }
  }, [notifySound, showToast]);

  const updatePreferences = useCallback((patch: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...patch };
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearRead = useCallback(() => {
    setNotifications(prev => prev.filter(item => !item.read || item.status === "running"));
  }, []);

  const triggerAction = useCallback((id: string) => {
    const notification = notifications.find(item => item.id === id);
    if (!notification) return;
    markAsRead(id);
    if (notification.action?.type === "download") downloadBlob(notification.action);
  }, [markAsRead, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.read && item.status !== "running").length,
    [notifications],
  );

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    preferences,
    addNotification,
    runTask,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearRead,
    triggerAction,
  }), [notifications, unreadCount, preferences, addNotification, runTask, updatePreferences, markAsRead, markAllAsRead, removeNotification, clearRead, triggerAction]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div style={{
        position: "fixed",
        top: 84,
        right: 20,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 360,
        maxWidth: "calc(100vw - 32px)",
        pointerEvents: "none",
      }}>
        {toasts.map(toast => {
          const color = toast.status === "error" ? "#ef4444" : toast.status === "success" ? "#22c55e" : "#f59e0b";
          return (
            <div key={toast.id} style={{
              background: "var(--af-elevated)",
              border: `1px solid ${color}66`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 12,
              boxShadow: "var(--af-shadow)",
              padding: "12px 14px",
              color: "var(--af-text)",
              pointerEvents: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{toast.title}</div>
                  <div style={{ fontSize: 12, color: "var(--af-muted)", lineHeight: 1.4 }}>{toast.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts(prev => prev.filter(item => item.id !== toast.id))}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--af-muted)",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                  }}
                  aria-label="Fechar aviso"
                >
                  x
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications deve ser usado dentro de NotificationProvider");
  return value;
}
