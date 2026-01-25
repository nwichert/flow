import { useState, useEffect } from 'react';
import { DocumentTextIcon, XMarkIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/solid';
import { generateSummary, type DiagramData } from '../utils/generateSummary';
import { useTheme } from './ThemeProvider';

type SummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  diagramData: DiagramData;
  initialSummary?: string;
  onSummaryGenerated?: (summary: string) => void;
};

export function SummaryModal({ isOpen, onClose, diagramData, initialSummary, onSummaryGenerated }: SummaryModalProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { colors } = useTheme();

  // Update summary when initialSummary changes (e.g., when switching diagrams)
  useEffect(() => {
    setSummary(initialSummary || null);
  }, [initialSummary]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await generateSummary(diagramData);
      setSummary(result);
      onSummaryGenerated?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setError(null);
    setIsLoading(false);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-h-[80vh] shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" style={{ color: colors.primary }} />
            <h3 className="text-slate-800 font-semibold text-lg">Diagram Summary</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <p className="text-slate-600 text-sm">
              Generate an AI-powered summary of <strong>{diagramData.name}</strong> that explains the flow in plain language.
            </p>
          </div>

          {!summary && !isLoading && !error && (
            <div className="flex justify-center py-8">
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                <DocumentTextIcon className="w-5 h-5" />
                Generate Summary
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: colors.primary, borderTopColor: 'transparent' }}
              />
              <p className="text-slate-600 text-sm">Analyzing diagram...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={handleGenerate}
                className="mt-3 text-sm text-red-700 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-4 h-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-4 h-4" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
