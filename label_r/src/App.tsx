import { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import type { HelperLayoutConfig } from "./utils/layoutMath";
import { generatePDF } from "./utils/pdfGenerator";

// Default Config
const DEFAULT_CONFIG: HelperLayoutConfig = {
  rows: 3,
  cols: 3,
  marginMm: 10,
  spacingMm: 10,
  orientation: 'landscape',
};

function App() {
  // State
  const [config, setConfig] = useState<HelperLayoutConfig>(() => {
    // Load from localStorage
    const saved = localStorage.getItem("label_printer_config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  // Persist Config
  useEffect(() => {
    localStorage.setItem("label_printer_config", JSON.stringify(config));
  }, [config]);

  // Handlers
  const handleConfigChange = (updates: Partial<HelperLayoutConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleFileSelect = (file: File) => {
    setImageFile(file);
    setSelectedFileName(file.name);
  };

  const handleGenerateValues = async () => {
    if (!imageFile) return;
    try {
      await generatePDF(config, imageFile);
    } catch (e) {
      alert("Failed to generate PDF: " + (e as Error).message);
    }
  };

  return (
    <Layout>
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <ControlPanel
          config={config}
          onConfigChange={handleConfigChange}
          onFileSelect={handleFileSelect}
          selectedFileName={selectedFileName}
          onGeneratePdf={handleGenerateValues}
        />
        <PreviewPanel
          config={config}
          imageFile={imageFile}
        />
      </main>
    </Layout>
  );
}

export default App;
