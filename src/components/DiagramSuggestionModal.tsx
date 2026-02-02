import { LightBulbIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { type DiagramClassification, DIAGRAM_TYPE_INFO } from '../utils/classifyDiagram';
import type { DiagramType } from '../store/useStoryStore';
import { useTheme } from './ThemeProvider';

type DiagramSuggestionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  classification: DiagramClassification;
  requestedType: DiagramType;
  onAcceptSuggestion: (type: DiagramType) => void;
  onKeepOriginal: () => void;
  isLoading?: boolean;
};

export function DiagramSuggestionModal({
  isOpen,
  onClose,
  classification,
  requestedType,
  onAcceptSuggestion,
  onKeepOriginal,
  isLoading = false,
}: DiagramSuggestionModalProps) {
  const { colors } = useTheme();

  if (!isOpen) return null;

  const recommendedInfo = DIAGRAM_TYPE_INFO.find(d => d.type === classification.recommendedType);
  const requestedInfo = DIAGRAM_TYPE_INFO.find(d => d.type === requestedType);

  const confidenceColors = {
    high: 'bg-green-100 text-green-700 border-green-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    low: 'bg-slate-100 text-slate-600 border-slate-300',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[550px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <LightBulbIcon className="w-5 h-5 text-yellow-500" />
            <h3 className="text-slate-800 font-semibold text-lg">Diagram Type Suggestion</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-slate-600 text-sm mb-4">
            Based on your description, we think a different diagram type might work better:
          </p>

          {/* Recommendation */}
          <div
            className="p-4 rounded-lg border-2 mb-4"
            style={{ borderColor: colors.primary, backgroundColor: `${colors.primary}10` }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{recommendedInfo?.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-800">{recommendedInfo?.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${confidenceColors[classification.confidence]}`}>
                    {classification.confidence} confidence
                  </span>
                </div>
                <p className="text-slate-600 text-sm mb-2">{recommendedInfo?.description}</p>
                <p className="text-slate-700 text-sm">
                  <strong>Why:</strong> {classification.reason}
                </p>
              </div>
            </div>
          </div>

          {/* Original choice */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{requestedInfo?.icon}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-1">{requestedInfo?.name}</h4>
                <p className="text-slate-600 text-sm">{requestedInfo?.description}</p>
              </div>
            </div>
          </div>

          {/* Alternatives */}
          {classification.alternativeTypes.length > 0 && (
            <div className="mb-4">
              <p className="text-slate-500 text-xs font-medium mb-2">Other options:</p>
              <div className="space-y-2">
                {classification.alternativeTypes.map((alt) => {
                  const altInfo = DIAGRAM_TYPE_INFO.find(d => d.type === alt.type);
                  return (
                    <button
                      key={alt.type}
                      onClick={() => onAcceptSuggestion(alt.type)}
                      disabled={isLoading}
                      className="w-full p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <span>{altInfo?.icon}</span>
                        <span className="font-medium text-slate-700 text-sm">{altInfo?.name}</span>
                        <span className="text-slate-500 text-xs">- {alt.reason}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          {isLoading ? (
            <div className="flex items-center gap-3 px-4 py-2">
              <svg className="animate-spin w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-slate-600 text-sm font-medium">Generating diagram...</span>
            </div>
          ) : (
            <>
              <button
                onClick={onKeepOriginal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors"
              >
                Keep {requestedInfo?.name}
              </button>
              <button
                onClick={() => onAcceptSuggestion(classification.recommendedType)}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ backgroundColor: colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                Use {recommendedInfo?.name}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
