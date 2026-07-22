"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

type LoadingListener = () => void;

type LoadingTracker = {
  activeRequests: number;
  installed: boolean;
  listeners: Set<LoadingListener>;
};

type LoadingGlobal = typeof globalThis & {
  __afGlobalLoadingTracker__?: LoadingTracker;
};

const SHOW_DELAY_MS = 350;
const MIN_VISIBLE_MS = 650;

function getTracker() {
  const loadingGlobal = globalThis as LoadingGlobal;
  loadingGlobal.__afGlobalLoadingTracker__ ??= {
    activeRequests: 0,
    installed: false,
    listeners: new Set<LoadingListener>(),
  };
  return loadingGlobal.__afGlobalLoadingTracker__;
}

function notifyListeners(tracker: LoadingTracker) {
  tracker.listeners.forEach(listener => listener());
}

function shouldTrackRequest(input: RequestInfo | URL) {
  if (typeof window === "undefined") return false;

  const rawUrl = input instanceof Request ? input.url : input.toString();
  try {
    const url = new URL(rawUrl, window.location.href);
    return ![
      "/_next/webpack-hmr",
      "/__nextjs_original-stack-frames",
      "/api/analytics",
    ].some(path => url.pathname.startsWith(path));
  } catch {
    return true;
  }
}

function installFetchTracker() {
  if (typeof window === "undefined") return;

  const tracker = getTracker();
  if (tracker.installed) return;

  const originalFetch = window.fetch.bind(window);
  tracker.installed = true;

  window.fetch = ((...args: Parameters<typeof fetch>) => {
    if (!shouldTrackRequest(args[0])) return originalFetch(...args);

    tracker.activeRequests += 1;
    notifyListeners(tracker);

    return originalFetch(...args).finally(() => {
      tracker.activeRequests = Math.max(0, tracker.activeRequests - 1);
      notifyListeners(tracker);
    });
  }) as typeof window.fetch;
}

function subscribe(listener: LoadingListener) {
  const tracker = getTracker();
  tracker.listeners.add(listener);
  return () => tracker.listeners.delete(listener);
}

function getSnapshot() {
  return getTracker().activeRequests;
}

function getServerSnapshot() {
  return 0;
}

export function GlobalLoadingIndicator() {
  const activeRequests = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [visible, setVisible] = useState(false);
  const wasBusyRef = useRef(false);
  const visibleSinceRef = useRef(0);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    installFetchTracker();
  }, []);

  useEffect(() => {
    const isBusy = activeRequests > 0;

    if (isBusy && !wasBusyRef.current) {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;

      if (!visible) {
        showTimerRef.current = window.setTimeout(() => {
          visibleSinceRef.current = Date.now();
          setVisible(true);
          showTimerRef.current = null;
        }, SHOW_DELAY_MS);
      }
    }

    if (!isBusy && wasBusyRef.current) {
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;

      if (visible) {
        const elapsed = Date.now() - visibleSinceRef.current;
        hideTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          hideTimerRef.current = null;
        }, Math.max(0, MIN_VISIBLE_MS - elapsed));
      }
    }

    wasBusyRef.current = isBusy;
  }, [activeRequests, visible]);

  useEffect(() => () => {
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
  }, []);

  if (!visible) return null;

  return (
    <>
      <div className="af-global-loading-bar" aria-hidden="true">
        <span />
      </div>
      <div
        className="af-global-loading-toast"
        role="status"
        aria-live="polite"
        aria-label="Conteudo em carregamento"
      >
        <div className="af-global-loading-icon" aria-hidden="true">
          <LoaderCircle size={22} strokeWidth={2.3} />
        </div>
        <div>
          <div className="af-global-loading-title">Carregando conteúdo</div>
          <div className="af-global-loading-message">Aguarde só um instante…</div>
        </div>
        <span className="af-global-loading-pulse" aria-hidden="true" />
      </div>
    </>
  );
}
