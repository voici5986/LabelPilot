import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Maximize2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

import { useGenerationReadiness } from "../hooks/useGenerationReadiness";
import { useModalFocus } from "../hooks/useModalFocus";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import { ImageFilesSection } from "./ImageFilesSection";
import { LayoutFields } from "./LayoutFields";
import { SegmentedControl } from "./SegmentedControl";
import { TextModeFields } from "./TextModeFields";
import { ActionButton } from "./ui/ActionButton";
import { InlineAlert } from "./ui/InlineAlert";

interface EditSheetProps {
  open: boolean;
  full: boolean;
  onClose: () => void;
  onToggleFull: () => void;
  onFilesSelect: (files: File[]) => void;
  /** 生成期间冻结会影响当前 PDF 的输入。 */
  isGenerating?: boolean;
}

/**
 * 移动端合并编辑面板（Bottom Sheet）。
 * 高度用 62dvh / 100% 两态（突变、无 height 动画，避免重排卡顿），开合动画仅用 transform；
 * 滚动容器按实际面板高度计算，62% 档底部内容可完整滚动到可视区。
 */
export function EditSheet({
  open,
  full,
  onClose,
  onToggleFull,
  onFilesSelect,
  isGenerating = false,
}: EditSheetProps) {
  const { t } = useI18n();
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown: handlePanelKeyDown } = useModalFocus({
    open,
    containerRef: panelRef,
    onDismiss: onClose,
  });
  const {
    config,
    onConfigChange,
    imageItems,
    onReorder,
    onItemCountChange,
    appMode,
    onAppModeChange,
    textConfig,
    onTextConfigChange,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      onConfigChange: state.setConfig,
      imageItems: state.imageItems,
      onReorder: state.setImageItems,
      onItemCountChange: state.updateItemCount,
      appMode: state.appMode,
      onAppModeChange: state.setAppMode,
      textConfig: state.textConfig,
      onTextConfigChange: state.setTextConfig,
    })),
  );

  const { textOutputMetrics, textOutputError, imageOutputError } =
    useGenerationReadiness(config, appMode, imageItems, textConfig);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-sheet-title"
            onKeyDown={handlePanelKeyDown}
            className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-border-subtle bg-elevated shadow-2xl ${full ? "h-full" : "h-[62dvh]"}`}
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <h2 id="edit-sheet-title" className="sr-only">
              {t("edit")}
            </h2>
            {/* 面板头部：拖拽把手 + 档位切换（全屏时避让顶部安全区） */}
            <div
              role="button"
              tabIndex={0}
              aria-label={t("edit_panel_toggle_size")}
              onClick={onToggleFull}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleFull();
                }
              }}
              className={`relative flex shrink-0 cursor-pointer items-center justify-center pb-2.5 ${full ? "pt-[max(10px,env(safe-area-inset-top))]" : "pt-2.5"}`}
            >
              <div className="h-1 w-10 rounded-full bg-border-subtle" />
              <Maximize2
                className={`absolute right-4 h-4 w-4 text-text-muted transition-transform duration-200 ${full ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </div>

            {/* 查看预览：位于面板顶部，62% 档位下也始终可达 */}
            <div className="shrink-0 px-4 pb-2">
              <ActionButton
                type="button"
                variant="primary"
                onClick={onClose}
                weight="bold"
                className="w-full rounded-lg py-2.5 text-sm"
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                {t("view_preview")}
              </ActionButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              <fieldset
                disabled={isGenerating}
                className="m-0 min-w-0 border-0 p-0"
              >
                <div className="space-y-4">
                  {/* 标签类型：一级工作流，面板第一项 */}
                  <div>
                    <h2 className="group-title">{t("app_mode")}</h2>
                    <SegmentedControl
                      label={t("app_mode")}
                      layoutId="app-mode-active-sheet"
                      value={appMode}
                      onChange={onAppModeChange}
                      options={[
                        { label: t("mode_image"), value: "image" },
                        { label: t("mode_text"), value: "text" },
                      ]}
                    />
                  </div>

                  {appMode === "image" ? (
                    <div className="rounded-xl border border-border-subtle bg-surface p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setFilesCollapsed((collapsed) => !collapsed)
                        }
                        aria-expanded={!filesCollapsed}
                        className="flex w-full items-center gap-2"
                      >
                        <h3
                          className="group-title flex flex-1 items-center gap-2"
                          style={{ marginBottom: 0 }}
                        >
                          <UploadCloud className="h-4 w-4" /> {t("file_group")}
                        </h3>
                        <ChevronDown
                          className={`h-4 w-4 text-text-muted transition-transform duration-200 ${filesCollapsed ? "-rotate-90" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                      <div className={filesCollapsed ? "hidden" : "mt-3"}>
                        <ImageFilesSection
                          imageItems={imageItems}
                          onFilesSelect={onFilesSelect}
                          onReorder={onReorder}
                          onItemCountChange={onItemCountChange}
                        />
                      </div>
                      {imageOutputError && (
                        <InlineAlert className="mt-3 text-sm">
                          {imageOutputError}
                        </InlineAlert>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border-subtle bg-surface p-3">
                      <TextModeFields
                        textConfig={textConfig}
                        metrics={textOutputMetrics}
                        error={textOutputError}
                        onChange={onTextConfigChange}
                      />
                    </div>
                  )}

                  {/* 排版设置 */}
                  <div className="rounded-xl border border-border-subtle bg-surface p-3">
                    <LayoutFields
                      config={config}
                      onConfigChange={onConfigChange}
                      layoutIdPrefix="sheet-orientation-active"
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
