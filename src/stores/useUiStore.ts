import { create } from 'zustand';

export const VALID_TABS = [
  'preview',
  'symbols',
  'font',
  'widgets',
  'layout',
  'blocks',
  'reference',
  'ui-elements',
  'ui-elements-hero',
  'shields',
  'topology',
  'dev-preview',
  'widgets-dev',
] as const;

export type TabType = typeof VALID_TABS[number];

export interface ToastMessage {
  id?: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export const getTabFromHash = (): TabType => {
  const path = window.location.pathname.replace(/^\//, '').toLowerCase().trim();
  if (
    import.meta.env.DEV &&
    (path === 'ui-elements' || path === 'elements' || path === 'reference' || path === 'hero' || path === 'heroui')
  ) {
    return 'reference';
  }
  if (import.meta.env.DEV && (path === 'shields' || path === 'shield')) {
    return 'shields';
  }
  if (import.meta.env.DEV && (path === 'topology' || path === 'topology-sandbox')) {
    return 'topology';
  }
  if (import.meta.env.DEV && (path === 'dev-preview' || path === 'widgets-dev' || path === 'dev')) {
    return 'dev-preview';
  }
  const hash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
  if (
    (hash === 'reference' ||
      hash === 'shields' ||
      hash === 'shield' ||
      hash === 'topology' ||
      hash === 'topology-sandbox' ||
      hash === 'ui-elements' ||
      hash === 'ui-elements-hero' ||
      hash === 'dev-preview' ||
      hash === 'widgets-dev' ||
      hash === 'dev') &&
    !import.meta.env.DEV
  ) {
    return 'preview';
  }
  if (hash === 'blocks') {
    return 'layout';
  }
  if (import.meta.env.DEV && (hash === 'shields' || hash === 'shield')) {
    return 'shields';
  }
  if (import.meta.env.DEV && (hash === 'topology' || hash === 'topology-sandbox')) {
    return 'topology';
  }
  if (import.meta.env.DEV && (hash === 'dev-preview' || hash === 'widgets-dev' || hash === 'dev')) {
    return 'dev-preview';
  }
  if (VALID_TABS.includes(hash as TabType)) {
    return hash as TabType;
  }
  if (
    import.meta.env.DEV &&
    (hash === 'ui-elements-hero' || hash === 'hero' || hash === 'heroui' || hash === 'elements' || hash === 'ui-elements')
  ) {
    return 'reference';
  }
  return 'preview';
};

export interface UiState {
  activeTab: TabType;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isInitialLoading: boolean;
  toast: ToastMessage | null;
  toasts: ToastMessage[];
  customText: string;

  setActiveTab: (tab: TabType) => void;
  setIsCommandPaletteOpen: (isOpen: boolean) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  openSettingsModal: () => void;
  setIsInitialLoading: (isLoading: boolean) => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
  clearToast: () => void;
  removeToast: (id?: string) => void;
  setCustomText: (updater: string | ((prev: string) => string)) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

const getInitialCustomText = (): string => {
  try {
    const saved = localStorage.getItem('zmk-custom-text');
    if (saved) return saved;
  } catch {}
  return 'BRUNOWB';
};

export const useUiStore = create<UiState>((set) => ({
  activeTab: typeof window !== 'undefined' ? getTabFromHash() : 'preview',
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  isInitialLoading: true,
  toast: null,
  toasts: [],
  customText: getInitialCustomText(),

  setActiveTab: (tab: TabType) => {
    set({ activeTab: tab });
    if (typeof window !== 'undefined') {
      const currentHash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
      if (currentHash !== tab) {
        window.location.hash = tab;
      }
    }
  },

  setIsCommandPaletteOpen: (isOpen: boolean) => set({ isCommandPaletteOpen: isOpen }),

  setIsSettingsOpen: (isOpen: boolean) => set({ isSettingsOpen: isOpen }),

  openSettingsModal: () => set({ isSettingsOpen: true }),

  setIsInitialLoading: (isLoading: boolean) => set({ isInitialLoading: isLoading }),

  showToast: (type: 'success' | 'error' | 'warning', message: string) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    const newToast: ToastMessage = { id: String(Date.now()), type, message };
    set({ toast: newToast, toasts: [newToast] });
    toastTimer = setTimeout(() => {
      set({ toast: null, toasts: [] });
      toastTimer = null;
    }, 4000);
  },

  clearToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null, toasts: [] });
  },

  removeToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null, toasts: [] });
  },

  setCustomText: (updater: string | ((prev: string) => string)) => {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.customText) : updater;
      try {
        localStorage.setItem('zmk-custom-text', next);
      } catch {}
      return { customText: next };
    });
  },
}));
