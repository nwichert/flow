import type { Actor, SSDMessage } from '../store/useStoryStore';

type GeneratedParticipant = {
  id: string;
  name: string;
  participantType: 'actor' | 'system' | 'database' | 'external' | 'service';
  order: number;
};

type GeneratedMessage = {
  id: string;
  label: string;
  messageType: 'request' | 'response' | 'async' | 'self';
  sequence: number;
  sourceParticipant: string;
  targetParticipant: string;
  description?: string;
};

type GeneratedSSD = {
  diagramType: 'ssd';
  title: string;
  description: string;
  participants: GeneratedParticipant[];
  messages: GeneratedMessage[];
};

// Map participant types to Actor types
function mapParticipantType(type: GeneratedParticipant['participantType']): Actor['type'] {
  switch (type) {
    case 'actor':
      return 'user';
    case 'system':
    case 'database':
    case 'service':
      return 'system';
    case 'external':
      return 'external';
    default:
      return 'system';
  }
}

// Map message types to SSDMessage types
function mapMessageType(type: GeneratedMessage['messageType']): SSDMessage['type'] {
  switch (type) {
    case 'request':
      return 'sync';
    case 'response':
      return 'return';
    case 'async':
      return 'async';
    case 'self':
      return 'sync';
    default:
      return 'sync';
  }
}

export type ProcessedSSD = {
  title: string;
  description: string;
  actors: Omit<Actor, 'id'>[];
  messages: Omit<SSDMessage, 'id' | 'order'>[];
  participantIdMap: Map<string, number>; // Maps generated IDs to order index
};

export async function generateSSDFromText(description: string): Promise<ProcessedSSD> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  const systemPrompt = `You are a technical architect creating System Sequence Diagrams for municipal workers' compensation and healthcare navigation software.

PURPOSE: Generate SSDs that show the sequence of interactions between actors and systems for a given scenario. SSDs answer: "What messages get exchanged, between whom, and in what order?"

DOMAIN CONTEXT:
Industry: Municipal workers' compensation for police, fire, and EMS departments
Core Platform: Ready Rebound - healthcare navigation and claims intelligence for first responders
Data Sources: TPA loss run reports, medical bill details, pharmacy reports, carrier data

KNOWN SYSTEMS:
| System | Type | Description |
|--------|------|-------------|
| Ready Rebound Platform | system | Core healthcare navigation and claims intelligence |
| Ready Rebound App | system | Mobile/web interface for members and admins |
| Claims Database | database | Primary claims and member data store |
| Analytics Warehouse | database | Aggregated data for reporting and insights |
| Ingestion Service | service | ETL for external file processing |
| Normalization Engine | service | Data standardization and field mapping |
| Notification Service | service | Email, SMS, push notification dispatch |
| Sedgwick | external | Third Party Administrator |
| Gallagher Bassett | external | Third Party Administrator |
| CorVel | external | Third Party Administrator |
| Origami Risk | external | Risk Management Information System |
| Carrier Portal | external | Insurance carrier claim systems |
| HRIS | external | Municipal HR/payroll (Workday, ADP, Tyler Munis) |
| Medical Provider | external | Clinics, hospitals, occupational health |
| Pharmacy Benefit Manager | external | Prescription claims and utilization |
| State WC Board | external | State reporting and compliance |
| OSHA Portal | external | Federal safety reporting |

KNOWN ACTORS:
| Actor | Role |
|-------|------|
| Injured Worker | Police officer, firefighter, or EMT using the platform |
| Fire Chief | Operational oversight, return-to-duty approval |
| Police Chief | Operational oversight, return-to-duty approval |
| HR Coordinator | Benefits admin, claim filing, leave coordination |
| Risk Manager | Claims analysis, carrier relationships, cost containment |
| Safety Manager | Incident investigation, prevention programs |
| City Manager | Budget oversight, policy decisions |
| Finance Director | Payment processing, reserve tracking |
| TPA Adjuster | External claims handler at TPA |
| Care Navigator | Ready Rebound staff coordinating member care |

PARTICIPANT TYPES:
- actor: Human user interacting with the system
- system: Internal application or platform component
- database: Data persistence layer
- external: Third-party system or API
- service: Internal microservice or background worker

MESSAGE TYPES:
- request: Synchronous call expecting a response (solid arrow →)
- response: Return value from a synchronous call (dashed arrow ←)
- async: Fire-and-forget, webhook, or background job (open arrowhead →)
- self: Internal processing within the same component (arrow to self)

RULES:
1. Identify ALL participants involved - don't skip intermediary systems
2. Order messages chronologically (sequence: 1, 2, 3...)
3. Order participants left-to-right by first interaction (order: 1, 2, 3...)
4. Use clear action labels: verb + object (e.g., "Submit injury report")
5. Include responses for synchronous request/response pairs
6. Mark background jobs and notifications as async
7. Show database operations explicitly (reads and writes)
8. Include external API calls to TPAs, carriers, and state systems
9. Add descriptions for complex or ambiguous messages
10. Limit to 15 messages max - break larger flows into multiple diagrams

LABEL GUIDELINES:
Good labels:
- "Submit injury report"
- "Query open claims"
- "POST /api/claims"
- "Return claim status"
- "Upsert normalized records"
- "Trigger email notification"
- "Validate file schema"

Bad labels:
- "User does thing"
- "Get data"
- "Response"
- "Process"
- "Handle request"

OUTPUT FORMAT (strict JSON):
{
  "diagramType": "ssd",
  "title": "Short descriptive title",
  "description": "One sentence explaining the scenario",
  "participants": [
    {
      "id": "p1",
      "name": "Display Name",
      "participantType": "actor|system|database|external|service",
      "order": 1
    }
  ],
  "messages": [
    {
      "id": "m1",
      "label": "Action label",
      "messageType": "request|response|async|self",
      "sequence": 1,
      "sourceParticipant": "p1",
      "targetParticipant": "p2",
      "description": "Optional clarifying detail"
    }
  ]
}

COMMON SCENARIOS TO RECOGNIZE:
- Injury reporting: Worker → App → Database → Notifications → Chief/HR
- Loss run ingestion: TPA SFTP → Ingestion → Normalization → Database → Dashboard
- Medical bill processing: Provider → Platform → Bill Review → TPA → Payment
- Return-to-work flow: Platform → Chief Approval → HR Update → Worker Notification
- Claims sync: TPA → Webhook/Polling → Platform → Database → Analytics refresh
- Dashboard load: User → App → API → Database → Render
- Carrier reporting: Platform → Generate report → Carrier Portal → Confirmation
- Care coordination: Care Navigator → Platform → Provider → Member notification

Respond with valid JSON only. No markdown, no explanation, no preamble.`;

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
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate SSD');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from AI');
  }

  let parsed: GeneratedSSD;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from the response if it has extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse AI response');
    }
  }

  // Create participant ID map for message reference
  const participantIdMap = new Map<string, number>();
  parsed.participants.forEach((p, index) => {
    participantIdMap.set(p.id, index);
  });

  // Convert to our internal format
  const actors: Omit<Actor, 'id'>[] = parsed.participants.map((p) => ({
    name: p.name,
    type: mapParticipantType(p.participantType),
    order: p.order,
  }));

  const messages: Omit<SSDMessage, 'id' | 'order'>[] = parsed.messages.map((m) => ({
    fromActorId: m.sourceParticipant,
    toActorId: m.messageType === 'self' ? m.sourceParticipant : m.targetParticipant,
    label: m.label,
    description: m.description || '',
    type: mapMessageType(m.messageType),
  }));

  return {
    title: parsed.title,
    description: parsed.description,
    actors,
    messages,
    participantIdMap,
  };
}
