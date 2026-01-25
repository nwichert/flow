import { getFileExtension } from '../hooks/useVoiceRecording';

type DiagramType = 'workflow' | 'ssd';

type TranscriptionResult = {
  transcription: string;
  summarized: boolean;
};

// Word count threshold for summarization
const SUMMARIZATION_THRESHOLD = 500;

const WORKFLOW_SUMMARIZATION_PROMPT = `You are helping a user create a workflow diagram. They have dictated a description of their process.

Extract the key process steps from this description and rewrite it as a clear, concise set of instructions for creating a workflow diagram.

Focus on:
- The sequence of actions/steps in order
- Any decision points or branching logic
- The goal or outcome of the process

Keep it concise but complete. Write in second person (e.g., "User does X, then Y happens").
Do not include any preamble - just output the refined description.

Transcription:
`;

const SSD_SUMMARIZATION_PROMPT = `You are helping a user create a System Sequence Diagram (SSD). They have dictated a description of system interactions.

Extract the key interactions from this description and rewrite it as a clear, concise set of instructions for creating an SSD.

Focus on:
- The participants/actors involved (users, systems, external services, databases)
- The messages or requests exchanged between them
- The order of interactions

Keep it concise but complete. Clearly identify who sends what to whom.
Do not include any preamble - just output the refined description.

Transcription:
`;

export async function transcribeAudio(
  audioBlob: Blob,
  diagramType: DiagramType
): Promise<TranscriptionResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  // Get the file extension from the blob's MIME type
  const extension = getFileExtension(audioBlob.type);
  const filename = `recording.${extension}`;

  // Create FormData for the Whisper API
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  // Call Whisper API for transcription
  const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!transcriptionResponse.ok) {
    const error = await transcriptionResponse.json();
    throw new Error(error.error?.message || 'Failed to transcribe audio');
  }

  const transcriptionData = await transcriptionResponse.json();
  const transcription = transcriptionData.text;

  if (!transcription || transcription.trim().length === 0) {
    throw new Error('No speech detected in the recording. Please try again.');
  }

  // Check if we need to summarize (long transcription)
  const wordCount = transcription.split(/\s+/).length;

  if (wordCount > SUMMARIZATION_THRESHOLD) {
    // Summarize the transcription
    const summarizedText = await summarizeTranscription(transcription, diagramType, apiKey);
    return {
      transcription: summarizedText,
      summarized: true,
    };
  }

  return {
    transcription: transcription.trim(),
    summarized: false,
  };
}

async function summarizeTranscription(
  transcription: string,
  diagramType: DiagramType,
  apiKey: string
): Promise<string> {
  const systemPrompt = diagramType === 'workflow'
    ? WORKFLOW_SUMMARIZATION_PROMPT
    : SSD_SUMMARIZATION_PROMPT;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: systemPrompt + transcription },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to summarize transcription');
  }

  const data = await response.json();
  const summary = data.choices[0]?.message?.content;

  if (!summary) {
    // Fall back to original transcription if summarization fails
    return transcription;
  }

  return summary.trim();
}
