import type { Node } from '@xyflow/react';
import type { StoryNode, Actor, SSDMessage } from '../store/useStoryStore';

type WorkflowData = {
  type: 'workflow';
  name: string;
  description: string;
  nodes: Node<StoryNode>[];
};

type SSDData = {
  type: 'ssd';
  name: string;
  description: string;
  actors: Actor[];
  messages: SSDMessage[];
};

export type DiagramData = WorkflowData | SSDData;

export async function generateSummary(data: DiagramData): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  let diagramContent: string;

  if (data.type === 'workflow') {
    const sortedNodes = [...data.nodes].sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
    const nodeDescriptions = sortedNodes.map((node, index) =>
      `${index + 1}. ${node.data.title}: ${node.data.description}`
    ).join('\n');

    diagramContent = `
Workflow Name: ${data.name}
Description: ${data.description || 'No description provided'}

Steps:
${nodeDescriptions || 'No steps defined'}
`;
  } else {
    const sortedActors = [...data.actors].sort((a, b) => a.order - b.order);
    const sortedMessages = [...data.messages].sort((a, b) => a.order - b.order);

    const actorNames = sortedActors.map(a => `- ${a.name} (${a.type})`).join('\n');

    const actorMap = new Map(sortedActors.map(a => [a.id, a.name]));
    const messageDescriptions = sortedMessages.map((msg, index) => {
      const from = actorMap.get(msg.fromActorId) || 'Unknown';
      const to = actorMap.get(msg.toActorId) || 'Unknown';
      const msgType = msg.type === 'return' ? '(response)' : msg.type === 'async' ? '(async)' : '';
      return `${index + 1}. ${from} → ${to}: ${msg.label} ${msgType}${msg.description ? ` - ${msg.description}` : ''}`;
    }).join('\n');

    diagramContent = `
System Sequence Diagram Name: ${data.name}
Description: ${data.description || 'No description provided'}

Participants:
${actorNames || 'No participants defined'}

Message Flow:
${messageDescriptions || 'No messages defined'}
`;
  }

  const systemPrompt = `You are a technical writer creating clear, concise summaries of software workflows and system interactions.

Given a diagram's content, write a 2-4 paragraph summary that:
1. Explains the overall purpose and goal of this flow
2. Describes the key steps or interactions in plain language
3. Highlights any important decision points, data transformations, or system integrations
4. Notes any potential considerations or dependencies

Write in a professional but accessible tone. Use present tense. Avoid jargon where possible, but use appropriate technical terms when describing system interactions.

Do not include headers or bullet points - write flowing paragraphs.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please summarize this ${data.type === 'workflow' ? 'workflow' : 'system sequence diagram'}:\n${diagramContent}` },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate summary');
  }

  const responseData = await response.json();
  const summary = responseData.choices[0]?.message?.content;

  if (!summary) {
    throw new Error('No summary generated');
  }

  return summary.trim();
}
