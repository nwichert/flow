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

TASK: Generate 3-10 workflow steps based on the description. Infer logical steps even when not explicitly stated.

RULES:
- Each step needs a clear, actionable title (2-6 words)
- Add a description explaining what happens, including which persona typically owns or participates
- Infer obvious prerequisite or follow-up steps users might forget
- Consider data handoffs between systems (TPA, RMIS, internal databases)
- Account for compliance requirements (HIPAA, state reporting, OSHA)
- Set priority: "high" for compliance/critical path, "medium" for standard operations, "low" for optimization/enhancement
- Order steps sequentially (1, 2, 3...)

CRITICAL - BRANCHING WORKFLOWS:
- When there is a decision point, condition, or "either/or" scenario, you MUST create SEPARATE nodes for each path
- A decision node should have MULTIPLE edges going to different target nodes (branching)
- Parallel paths may later converge back to a common node
- Look for keywords: "either", "or", "if", "based on", "depending on", "when", "decision", "approve/reject"
- Example: "Review Application" (id:2) branches to BOTH "Approve Request" (id:3) AND "Reject Request" (id:4)
  This requires edges: [{"source":"2","target":"3"}, {"source":"2","target":"4"}]

COMMON WORKFLOW PATTERNS IN THIS DOMAIN:
- Injury reporting → claim filing → medical coordination → return-to-work
- Loss run ingestion → data normalization → analytics → stakeholder reporting
- Medical bill review → validation → approval routing → payment processing
- Decision point → [Path A: approved] + [Path B: denied] → resolution

OUTPUT FORMAT (strict JSON):
{
  "nodes": [
    { "id": "1", "title": "Step title", "description": "What happens.", "priority": "medium", "order": 1 },
    { "id": "2", "title": "Decision Point", "description": "Evaluate condition.", "priority": "high", "order": 2 },
    { "id": "3", "title": "Path A Result", "description": "If condition met.", "priority": "medium", "order": 3 },
    { "id": "4", "title": "Path B Result", "description": "If condition not met.", "priority": "medium", "order": 4 }
  ],
  "edges": [
    { "source": "1", "target": "2" },
    { "source": "2", "target": "3" },
    { "source": "2", "target": "4" }
  ]
}

Note: In the example above, node "2" has TWO outgoing edges - this creates a branch/fork in the workflow.

EXAMPLES OF GOOD TITLES:
- "Ingest TPA loss run" (not "Get the data")
- "Validate claim coding" (not "Check data")
- "Route to Risk Manager" (not "Send for approval")
- "Evaluate restrictions" (for a decision point that branches)

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
