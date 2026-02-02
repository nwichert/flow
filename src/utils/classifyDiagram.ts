import type { DiagramType } from '../store/useStoryStore';

export type DiagramClassification = {
  recommendedType: DiagramType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternativeTypes: {
    type: DiagramType;
    reason: string;
  }[];
};

export type DiagramTypeInfo = {
  type: DiagramType;
  name: string;
  description: string;
  bestFor: string[];
  icon: string; // emoji
};

export const DIAGRAM_TYPE_INFO: DiagramTypeInfo[] = [
  {
    type: 'workflow',
    name: 'Workflow',
    description: 'Sequential process steps with decision points and branching paths',
    bestFor: [
      'Business processes',
      'Approval flows',
      'Step-by-step procedures',
      'Decision trees',
    ],
    icon: '🔀',
  },
  {
    type: 'ssd',
    name: 'System Sequence Diagram',
    description: 'Interactions between multiple actors, departments, or systems over time',
    bestFor: [
      'Multi-party communication',
      'Department/role interactions',
      'API and service calls',
      'Timeline-based events',
      'Information flow between actors',
    ],
    icon: '↔️',
  },
  {
    type: 'state-diagram',
    name: 'State Diagram',
    description: 'States an object can be in and transitions between them',
    bestFor: [
      'Object lifecycle',
      'Status changes',
      'State machines',
      'Mode transitions',
    ],
    icon: '🔄',
  },
  {
    type: 'erd',
    name: 'Entity Relationship Diagram',
    description: 'Database entities, their attributes, and relationships',
    bestFor: [
      'Database design',
      'Data modeling',
      'Table relationships',
      'Schema planning',
    ],
    icon: '🗃️',
  },
];

export async function classifyDiagramType(
  description: string,
  requestedType: DiagramType
): Promise<DiagramClassification> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    // If no API key, just return the requested type
    return {
      recommendedType: requestedType,
      confidence: 'high',
      reason: 'Using requested diagram type',
      alternativeTypes: [],
    };
  }

  const systemPrompt = `You are an expert at analyzing descriptions and determining the best type of diagram to represent them.

DIAGRAM TYPES:
1. "workflow" - A SINGLE process with sequential steps, possibly with branching/decisions
   - Best for: ONE process owner following steps in order
   - Keywords: steps, process, then, next, workflow, approval flow, procedure
   - Example: "User submits form, manager reviews, if approved goes to HR, else returns to user"
   - NOT for: Multiple parallel tracks, multiple departments with separate processes

2. "ssd" - Sequence Diagram showing interactions between MULTIPLE actors/parties over time
   - Best for: Multiple people, departments, or systems communicating (or failing to communicate)
   - Keywords: multiple actors, departments, roles, notifies, receives, sends to, reports to, tracks, parallel, different perspectives, communication gaps, information silos
   - Example: "HR notifies TPA, TPA assigns adjuster, Chief asks HR for updates, Safety tracks in spreadsheet"
   - STRONG INDICATORS: Multiple named people/roles (Brad, Eric, Chief), parallel tracks, different departments doing separate things, communication delays, information gaps
   - Use SSD when the description mentions 3+ different actors/departments doing their own things

3. "state-diagram" - States a SINGLE entity can be in and transitions between states
   - Best for: Tracking ONE object's lifecycle through different statuses
   - Keywords: state, status, becomes, changes to, transitions, lifecycle, active, inactive, pending
   - Example: "Claim starts as open, when approved becomes active, when paid becomes closed"

4. "erd" - Entity Relationship Diagram for database structure and relationships
   - Best for: Data modeling, database tables, relationships between entities
   - Keywords: table, entity, has many, belongs to, foreign key, database, schema, one-to-many
   - Example: "Users have many orders, each order has many line items"

CRITICAL DECISION RULE:
- If the description mentions MULTIPLE ACTORS/DEPARTMENTS each doing their own separate activities = SSD
- If it's ONE linear process that a single person/team follows = Workflow
- If it's tracking ONE thing through different statuses = State Diagram
- If it's about data structure/tables = ERD

TASK: Analyze the description and determine which diagram type best represents it.

OUTPUT FORMAT (JSON only):
{
  "recommendedType": "workflow" | "ssd" | "state-diagram" | "erd",
  "confidence": "high" | "medium" | "low",
  "reason": "Brief explanation of why this type is recommended",
  "alternativeTypes": [
    { "type": "...", "reason": "Why this could also work" }
  ]
}

Be conservative with "high" confidence - only use it when the description clearly matches one type.
Use "medium" when it could reasonably be represented multiple ways.
Use "low" when the description is ambiguous.

Respond with valid JSON only.`;

  try {
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
          { role: 'user', content: `User requested: ${requestedType}\n\nDescription: ${description}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error('Classification failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response');
    }

    const parsed = JSON.parse(content);
    return parsed as DiagramClassification;
  } catch (error) {
    console.error('Classification error:', error);
    // Fallback to requested type
    return {
      recommendedType: requestedType,
      confidence: 'high',
      reason: 'Using requested diagram type',
      alternativeTypes: [],
    };
  }
}

// Quick local classification without API call (for instant feedback)
export function quickClassify(description: string): DiagramType | null {
  const lower = description.toLowerCase();

  // Strong SSD indicators - multiple actors, departments, communication
  const ssdKeywords = [
    'api', 'endpoint', 'request', 'response', 'webhook', 'calls', 'server', 'client', 'microservice',
    'notifies', 'receives', 'sends', 'reports to', 'tracks', 'parallel', 'department', 'actor',
    'hr ', 'tpa', 'chief', 'manager', 'admin', 'user ', 'system ', 'track 1', 'track 2',
    'different answers', 'information', 'communication', 'silos', 'batch', 'real-time'
  ];
  let ssdCount = ssdKeywords.filter(k => lower.includes(k)).length;

  // Bonus for multiple named roles/people (strong SSD indicator)
  const rolePattern = /\b(brad|eric|chief|captain|adjuster|hr|tpa|safety|ops)\b/gi;
  const roleMatches = lower.match(rolePattern);
  if (roleMatches && new Set(roleMatches.map(r => r.toLowerCase())).size >= 3) {
    ssdCount += 5; // Strong bonus for 3+ distinct roles
  }

  // Strong State Diagram indicators
  const stateKeywords = ['state', 'status', 'becomes', 'transitions', 'lifecycle', 'active', 'inactive', 'pending', 'approved', 'rejected'];
  const stateCount = stateKeywords.filter(k => lower.includes(k)).length;

  // Strong ERD indicators
  const erdKeywords = ['table', 'entity', 'has many', 'belongs to', 'foreign key', 'database', 'schema', 'one-to-many', 'many-to-many', 'relationship'];
  const erdCount = erdKeywords.filter(k => lower.includes(k)).length;

  // Strong Workflow indicators
  const workflowKeywords = ['step', 'process', 'workflow', 'approval', 'submit', 'review', 'then', 'next'];
  const workflowCount = workflowKeywords.filter(k => lower.includes(k)).length;

  // Find the highest count
  const counts = [
    { type: 'ssd' as DiagramType, count: ssdCount },
    { type: 'state-diagram' as DiagramType, count: stateCount },
    { type: 'erd' as DiagramType, count: erdCount },
    { type: 'workflow' as DiagramType, count: workflowCount },
  ];

  counts.sort((a, b) => b.count - a.count);

  // Only suggest if there's a clear winner with at least 2 matches
  if (counts[0].count >= 2 && counts[0].count > counts[1].count) {
    return counts[0].type;
  }

  return null;
}
