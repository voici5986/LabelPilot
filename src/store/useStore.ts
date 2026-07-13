import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  HelperLayoutConfig,
  ImageItem,
  TextConfig,
} from "../utils/layoutMath";
import {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  DEFAULT_TEXT_CONFIG,
  normalizeTextConfig,
} from "../utils/layoutMath";

export interface AppState {
  // Configs
  config: HelperLayoutConfig;
  textConfig: TextConfig;
  appMode: "image" | "text";
  theme: "system" | "light" | "dark";

  // Non-persistent state
  imageItems: ImageItem[];
  imageUrlMap: Map<string, string>;

  // Actions
  setConfig: (updates: Partial<HelperLayoutConfig>) => void;
  setTextConfig: (updates: Partial<TextConfig>) => void;
  setAppMode: (mode: "image" | "text") => void;
  setTheme: (theme: "system" | "light" | "dark") => void;
  setImageItems: (items: ImageItem[]) => void;
  updateItemCount: (id: string, count: number) => void;
}

const DEFAULT_CONFIG: HelperLayoutConfig = {
  rows: 3,
  cols: 3,
  marginMm: 10,
  spacingMm: 10,
  orientation: "landscape",
  pageWidthMm: A4_WIDTH_MM,
  pageHeightMm: A4_HEIGHT_MM,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      textConfig: DEFAULT_TEXT_CONFIG,
      appMode: "image",
      theme: "system",
      imageItems: [],
      imageUrlMap: new Map(),

      setConfig: (updates) =>
        set((state) => {
          const next = { ...state.config, ...updates };
          const isPortrait = next.orientation === "portrait";
          const maxR = isPortrait ? 20 : 10;
          const maxC = isPortrait ? 10 : 20;
          next.rows = Math.min(Math.max(1, next.rows), maxR);
          next.cols = Math.min(Math.max(1, next.cols), maxC);
          return { config: next };
        }),

      setTextConfig: (updates) =>
        set((state) => {
          const next = normalizeTextConfig(
            { ...state.textConfig, ...updates },
            state.textConfig,
          );
          return { textConfig: next };
        }),

      setAppMode: (mode) => set({ appMode: mode }),

      setTheme: (theme) => set({ theme }),

      setImageItems: (items) =>
        set((state) => {
          const nextMap = new Map(state.imageUrlMap);
          const nextIds = new Set(items.map((item) => item.id));
          const prevFilesById = new Map(
            state.imageItems.map((item) => [item.id, item.file]),
          );

          for (const item of items) {
            const prevFile = prevFilesById.get(item.id);
            const existingUrl = nextMap.get(item.id);
            if (!existingUrl || (prevFile && prevFile !== item.file)) {
              if (existingUrl) {
                URL.revokeObjectURL(existingUrl);
              }
              nextMap.set(item.id, URL.createObjectURL(item.file));
            }
          }

          for (const [id, url] of state.imageUrlMap) {
            if (!nextIds.has(id)) {
              URL.revokeObjectURL(url);
              nextMap.delete(id);
            }
          }

          return { imageItems: items, imageUrlMap: nextMap };
        }),

      updateItemCount: (id, count) =>
        set((state) => ({
          imageItems: state.imageItems.map((item) =>
            item.id === id ? { ...item, count } : item,
          ),
        })),
    }),
    {
      name: "label-pilot-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist configuration, not the actual image files (which can't be JSON serialized)
      partialize: (state) => ({
        config: state.config,
        textConfig: state.textConfig,
        appMode: state.appMode,
        theme: state.theme,
      }),
      merge: (persistedState, currentState) => {
        const persisted = asRecord(persistedState);
        const persistedConfig = asRecord(persisted.config);
        const persistedTextConfig = asRecord(persisted.textConfig);

        return {
          ...currentState,
          config: {
            ...currentState.config,
            ...persistedConfig,
          } as HelperLayoutConfig,
          textConfig: normalizeTextConfig(
            {
              ...currentState.textConfig,
              ...persistedTextConfig,
            },
            currentState.textConfig,
          ),
          appMode:
            persisted.appMode === "image" || persisted.appMode === "text"
              ? persisted.appMode
              : currentState.appMode,
          theme:
            persisted.theme === "system" ||
            persisted.theme === "light" ||
            persisted.theme === "dark"
              ? persisted.theme
              : currentState.theme,
        };
      },
    },
  ),
) as UseBoundStore<StoreApi<AppState>>;
