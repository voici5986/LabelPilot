import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  HelperLayoutConfig,
  ImageItem,
  PaperSize,
  TextConfig,
} from "../utils/layoutMath";
import {
  A3_HEIGHT_MM,
  A3_WIDTH_MM,
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  A5_HEIGHT_MM,
  A5_WIDTH_MM,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TEXT_CONFIG,
  LETTER_HEIGHT_MM,
  LETTER_WIDTH_MM,
  getPaperSizeInfo,
  normalizeLayoutConfig,
  normalizeTextConfig,
} from "../utils/layoutMath";
import { normalizeImageItemCount } from "../utils/imageLimits";

export interface AppState {
  // Configs
  config: HelperLayoutConfig;
  textConfig: TextConfig;
  appMode: "image" | "text";
  theme: "system" | "light" | "dark";
  paperSizeMode: PaperSize;

  // Non-persistent state
  imageItems: ImageItem[];
  imageUrlMap: Map<string, string>;

  // Actions
  setConfig: (updates: Partial<HelperLayoutConfig>) => void;
  setTextConfig: (updates: Partial<TextConfig>) => void;
  setAppMode: (mode: "image" | "text") => void;
  setTheme: (theme: "system" | "light" | "dark") => void;
  setPaperSizeMode: (mode: PaperSize) => void;
  setImageItems: (items: ImageItem[]) => void;
  updateItemCount: (id: string, count: number) => void;
}

export const PERSIST_STORAGE_KEY = "label-pilot-storage";
export const PERSIST_STORAGE_VERSION = 2;

type PaperPreset = Exclude<PaperSize, "Custom">;

const PAPER_SIZE_MODES: readonly PaperSize[] = [
  "A4",
  "A3",
  "A5",
  "Letter",
  "Custom",
];

const PAPER_PRESETS: Record<
  PaperPreset,
  Pick<HelperLayoutConfig, "pageWidthMm" | "pageHeightMm">
> = {
  A4: { pageWidthMm: A4_WIDTH_MM, pageHeightMm: A4_HEIGHT_MM },
  A3: { pageWidthMm: A3_WIDTH_MM, pageHeightMm: A3_HEIGHT_MM },
  A5: { pageWidthMm: A5_WIDTH_MM, pageHeightMm: A5_HEIGHT_MM },
  Letter: {
    pageWidthMm: LETTER_WIDTH_MM,
    pageHeightMm: LETTER_HEIGHT_MM,
  },
};

export function resetPersistedSettings(): void {
  localStorage.removeItem(PERSIST_STORAGE_KEY);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePaperSizeMode(
  value: unknown,
  config: HelperLayoutConfig,
): PaperSize {
  if (PAPER_SIZE_MODES.includes(value as PaperSize)) {
    return value as PaperSize;
  }
  return getPaperSizeInfo(config).label;
}

function normalizePaperState(
  value: unknown,
  config: HelperLayoutConfig,
): { config: HelperLayoutConfig; paperSizeMode: PaperSize } {
  const paperSizeMode = normalizePaperSizeMode(value, config);
  if (paperSizeMode === "Custom") return { config, paperSizeMode };

  return {
    paperSizeMode,
    config: normalizeLayoutConfig(
      { ...config, ...PAPER_PRESETS[paperSizeMode] },
      config,
    ),
  };
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      config: DEFAULT_LAYOUT_CONFIG,
      textConfig: DEFAULT_TEXT_CONFIG,
      appMode: "image",
      theme: "system",
      paperSizeMode: "A4",
      imageItems: [],
      imageUrlMap: new Map(),

      setConfig: (updates) =>
        set((state) => {
          const changesPaperDimensions =
            Object.prototype.hasOwnProperty.call(updates, "pageWidthMm") ||
            Object.prototype.hasOwnProperty.call(updates, "pageHeightMm");

          return {
            config: normalizeLayoutConfig(
              { ...state.config, ...updates },
              state.config,
            ),
            ...(changesPaperDimensions
              ? { paperSizeMode: "Custom" as const }
              : {}),
          };
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

      setPaperSizeMode: (mode) =>
        set((state) => {
          if (mode === "Custom") return { paperSizeMode: mode };

          return {
            paperSizeMode: mode,
            config: normalizeLayoutConfig(
              { ...state.config, ...PAPER_PRESETS[mode] },
              state.config,
            ),
          };
        }),

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
            item.id === id
              ? {
                  ...item,
                  count: normalizeImageItemCount(count),
                }
              : item,
          ),
        })),
    }),
    {
      name: PERSIST_STORAGE_KEY,
      version: PERSIST_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Only persist configuration, not the actual image files (which can't be JSON serialized)
      partialize: (state) => ({
        config: state.config,
        textConfig: state.textConfig,
        appMode: state.appMode,
        theme: state.theme,
        paperSizeMode: state.paperSizeMode,
      }),
      migrate: (persistedState) => {
        const persisted = asRecord(persistedState);
        const paperState = normalizePaperState(
          persisted.paperSizeMode,
          normalizeLayoutConfig(persisted.config),
        );
        return {
          config: paperState.config,
          textConfig: normalizeTextConfig(persisted.textConfig),
          appMode:
            persisted.appMode === "image" || persisted.appMode === "text"
              ? persisted.appMode
              : "image",
          theme:
            persisted.theme === "system" ||
            persisted.theme === "light" ||
            persisted.theme === "dark"
              ? persisted.theme
              : "system",
          paperSizeMode: paperState.paperSizeMode,
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = asRecord(persistedState);
        const persistedConfig = asRecord(persisted.config);
        const persistedTextConfig = asRecord(persisted.textConfig);
        const paperState = normalizePaperState(
          persisted.paperSizeMode,
          normalizeLayoutConfig(
            { ...currentState.config, ...persistedConfig },
            currentState.config,
          ),
        );

        return {
          ...currentState,
          config: paperState.config,
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
          paperSizeMode: paperState.paperSizeMode,
        };
      },
    },
  ),
) as UseBoundStore<StoreApi<AppState>>;
