import React, { useState } from 'react';
import { X, FileSpreadsheet, UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CsvImportModalProps {
  onClose: () => void;
  onImport: (csvText: string) => Promise<number>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ onClose, onImport }) => {
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setError('Please provide CSV file content.');
      return;
    }
    setError(null);
    setIsProcessing(true);

    try {
      const count = await onImport(csvContent);
      setSuccessCount(count);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleCsv = `Name,Category,City,Website,Phone
Main Taunus Dental,Dentist,Frankfurt,https://www.main-taunus-dental.de,+49 69 9001122
Goethe Kanzlei,Lawyer,Frankfurt,,+49 69 334455
Sachsenhausen Bakery,Bakery,Frankfurt,http://sachsenhausen-brot.de,+49 69 778899`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Import Business Prospects from CSV</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Successfully imported {successCount} business prospects!</span>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <p className="text-zinc-400">
            Upload any spreadsheet CSV containing columns like <code>Name</code>, <code>City</code>, <code>Category</code>, and optional <code>Website</code>.
          </p>

          {/* File input / Drag drop */}
          <div className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-6 text-center transition-colors cursor-pointer bg-zinc-900/40 relative">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <UploadCloud className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
            <div className="font-medium text-zinc-200">
              {fileName ? fileName : 'Click to browse or drop CSV file'}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Comma-separated, UTF-8 encoded</div>
          </div>

          {/* Or Paste CSV text */}
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>Or Paste Raw CSV Data</span>
              <button
                type="button"
                onClick={() => setCsvContent(sampleCsv)}
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Insert Sample Data
              </button>
            </div>
            <textarea
              rows={5}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Name,Category,City,Website,Phone..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 font-mono text-[11px] text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-[11px] text-zinc-500">
            <strong>Security Notice:</strong> All imported fields are sanitized. Exports automatically quote and escape spreadsheet formulas (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>, tab) to prevent CSV DDE code injection.
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isProcessing || !csvContent.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isProcessing ? 'Importing...' : 'Parse & Import Leads'}
          </button>
        </div>
      </div>
    </div>
  );
};
