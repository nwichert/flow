import type { StoryNode } from '../store/useStoryStore';

type GeneratedNode = {
  id: string;
  title: string;
  description: string;
  priority: StoryNode['priority'];
  order: number;
};

type GeneratedEdge = {
  source: string;
  target: string;
};

export type GeneratedWorkflow = {
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
};

export async function generateWorkflowFromText(description: string): Promise<GeneratedWorkflow> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  const systemPrompt = `You are a workflow designer specializing in municipal workers' compensation, healthcare navigation for first responders, and claims data management.

DOMAIN CONTEXT:
- Industry: Municipal workers' compensation for police, fire, and EMS departments
- Data sources: TPA (Third Party Administrator) loss run reports, medical bill details, pharmacy reports
- Technical: Data ingestion pipelines, report processing, claims intelligence
- Stakeholders: Chiefs, HR, Risk Management, Safety Managers, City Managers, Finance

PERSONAS (consider who owns/participates in each step):
- Chiefs (Police/Fire): Operational oversight, return-to-duty decisions, staffing impact
- Human Resources: Benefits administration, FMLA coordination, employee communication
- Risk Management: Claims analysis, cost containment, carrier relationships
- Safety Managers: Injury prevention, incident investigation, training compliance
- City Managers: Budget impact, policy decisions, cross-department coordination
- Finance: Cost allocation, reserve analysis, budget forecasting

TASK: Generate 3-8 workflow steps based on the description. Infer logical steps even when not explicitly stated.

RULES:
- Each step needs a clear, actionable title (2-6 words)
- Add a description explaining what happens, including which persona typically owns or participates
- Infer obvious prerequisite or follow-up steps users might forget
- Consider data handoffs between systems (TPA, RMIS, internal databases)
- Account for compliance requirements (HIPAA, state reporting, OSHA)
- Set priority: "high" for compliance/critical path, "medium" for standard operations, "low" for optimization/enhancement
- Order steps sequentially (1, 2, 3...)
- Connect steps logically - branch when workflows naturally split (e.g., light duty vs. full duty return)

COMMON WORKFLOW PATTERNS IN THIS DOMAIN:
- Injury reporting → claim filing → medical coordination → return-to-work
- Loss run ingestion → data normalization → analytics → stakeholder reporting
- Medical bill review → validation → approval routing → payment processing
- Pharmacy report analysis → utilization review → cost optimization
- Claims intelligence → trend identification → prevention program design

OUTPUT FORMAT (strict JSON):
{
  "nodes": [
    {
      "id": "1",
      "title": "Step title here",
      "description": "What happens in this step. Owned by [Persona].",
      "priority": "low" | "medium" | "high",
      "order": 1
    }
  ],
  "edges": [
    { "source": "1", "target": "2" }
  ]
}

EXAMPLES OF GOOD TITLES:
- "Ingest TPA loss run" (not "Get the data")
- "Validate claim coding" (not "Check data")
- "Route to Risk Manager" (not "Send for approval")
- "Calculate experience mod impact" (not "Do calculations")

All steps start with status "todo".

Respond with valid JSON only. No markdown, no explanation.`;

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
        { role: 'user', content: description },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate workflow');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    // Parse the JSON response
    const parsed = JSON.parse(content);
    return parsed as GeneratedWorkflow;
  } catch {
    // Try to extract JSON from the response if it has extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GeneratedWorkflow;
    }
    throw new Error('Failed to parse AI response');
  }
}
