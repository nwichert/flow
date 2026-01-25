import { useState, useEffect } from 'react';
import { SparklesIcon, XMarkIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';
import { generateWorkflowFromText } from '../utils/generateWorkflow';
import { useStoryStore } from '../store/useStoryStore';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { transcribeAudio } from '../utils/transcribeAudio';

type AIWorkflowGeneratorProps = {
  isOpen: boolean;
  onClose: () => void;
};

// Format seconds to MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AIWorkflowGenerator({ isOpen, onClose }: AIWorkflowGeneratorProps) {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { importGeneratedWorkflow, activeStoryId, autoLayout } = useStoryStore();

  const {
    isRecording,
    recordingDuration,
    audioBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    resetRecording,
  } = useVoiceRecording();

  // Handle transcription when recording stops
  useEffect(() => {
    if (audioBlob && !isTranscribing) {
      handleTranscription(audioBlob);
    }
  }, [audioBlob]);

  // Reset recording state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetRecording();
      setIsTranscribing(false);
    }
  }, [isOpen, resetRecording]);

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const result = await transcribeAudio(blob, 'workflow');
      setDescription(prev => {
        // Append to existing text if there's any
        if (prev.trim()) {
          return prev + '\n\n' + result.transcription;
        }
        return result.transcription;
      });
      resetRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setError(null);
      startRecording();
    }
  };

  const handleGenerate = async () => {
    if (!description.trim() || !activeStoryId) return;

    setIsLoading(true);
    setError(null);

    try {
      const workflow = await generateWorkflowFromText(description);

      // Import the generated nodes and edges
      importGeneratedWorkflow(workflow.nodes, workflow.edges);

      // Auto-layout for a clean arrangement
      setTimeout(() => autoLayout('TB'), 100);

      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate workflow');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[500px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-slate-800 font-semibold text-lg">AI Workflow Generator</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-slate-600 text-sm mb-4">
            Describe the workflow you want to create and AI will generate the steps for you.
          </p>

          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: A user registration flow that includes signing up with email, verifying the email address, completing their profile, and getting a welcome message..."
              className="w-full h-32 px-3 py-2 pr-12 bg-slate-50 rounded-lg text-slate-800 text-sm border border-slate-300 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
              disabled={isLoading || isRecording || isTranscribing}
            />

            {/* Voice Recording Button */}
            <button
              onClick={handleRecordClick}
              disabled={isLoading || isTranscribing}
              className={`absolute right-2 top-2 p-2 rounded-lg transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Stop recording' : 'Start voice recording'}
            >
              {isRecording ? (
                <StopIcon className="w-5 h-5" />
              ) : (
                <MicrophoneIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording... {formatDuration(recordingDuration)}
            </div>
          )}

          {/* Transcribing Status */}
          {isTranscribing && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Transcribing your voice...
            </div>
          )}

          {(error || recordingError) && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error || recordingError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors"
            disabled={isLoading || isRecording || isTranscribing}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isLoading || isRecording || isTranscribing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Generate Workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
