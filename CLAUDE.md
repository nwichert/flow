# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Flow-based visual workflow and diagram tool for **Ready Rebound**, a healthcare navigation platform serving first responders (police, fire, EMS) through municipal workers' compensation programs.

The tool enables users to create, edit, and AI-generate:
- **Workflows**: Step-by-step processes with status tracking
- **System Sequence Diagrams (SSDs)**: Technical interaction flows between actors and systems

Primary users are product, engineering, and operations teams designing processes for municipal customers.

---

## Tech Stack

- **Frontend**: React + TypeScript
- **Flow Visualization**: React Flow
- **AI Generation**: OpenAI API (GPT-4o-mini)
- **Styling**: Tailwind CSS
- **State Management**: Zustand

---

## Domain Context

### Industry
Municipal workers' compensation and healthcare navigation for first responders.

### What Ready Rebound Does
- Concierge healthcare navigation for injured police, firefighters, and EMTs
- Helps members access faster care and return to work more quickly
- Serves 350+ departments and 60,000+ members across 18+ states
- Integrates with TPAs, carriers, and municipal systems

### Key Data Sources
| Source | Description |
|--------|-------------|
| Loss Run Reports | Claims history exports from TPAs (CSV, Excel) |
| Medical Bill Detail | Line-item medical charges and payments |
| Pharmacy Reports | Prescription utilization and costs |
| RMIS Data | Risk Management Information System exports |

### Third Party Administrators (TPAs)
- Sedgwick
- Gallagher Bassett
- CorVel
- PMA
- Helmsman

### Key Systems
| System | Purpose |
|--------|---------|
| Ready Rebound Platform | Core product - care navigation + claims intelligence |
| Origami Risk | Major RMIS competitor/integration partner |
| HRIS Systems | Workday, ADP, Tyler Munis (municipal payroll/HR) |
| Carrier Portals | Insurance carrier claim systems |
| State WC Boards | Compliance and reporting |

---

## User Personas

When generating workflows or SSDs, consider these stakeholders:

| Persona | Responsibilities | Cares About |
|---------|------------------|-------------|
| **Fire/Police Chief** | Operational oversight, return-to-duty decisions | Staffing, officer safety, quick RTW |
| **HR Coordinator** | Benefits admin, FMLA, claim filing | Compliance, employee communication |
| **Risk Manager** | Claims analysis, carrier relationships | Cost containment, loss trends |
| **Safety Manager** | Incident investigation, prevention | Training, OSHA compliance |
| **City Manager** | Cross-department oversight | Budget impact, liability |
| **Finance Director** | Reserves, payments, budgeting | Accuracy, forecasting |
| **Injured Worker** | Reporting injuries, accessing care | Fast treatment, job security |
| **Care Navigator** | Coordinating member care (RR staff) | Member outcomes, provider scheduling |

---

## Data Structures

### Workflow Node (storyNode)
```typescript
interface WorkflowNode {
  id: string;
  type: 'storyNode';
  position: { x: number; y: number };
  data: {
    id: string;
    title: string;           // 2-6 words, action-oriented
    description: string;     // 1-2 sentences, includes owner
    status: 'todo' | 'in-progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    order: number;           // Presentation sequence
  };
}
```

### Workflow Edge
```typescript
interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}
```

### SSD Participant
```typescript
interface SSDParticipant {
  id: string;                // p1, p2, p3...
  name: string;              // Display name
  participantType: 'actor' | 'system' | 'database' | 'external' | 'service';
  order: number;             // Left-to-right position
}
```

### SSD Message
```typescript
interface SSDMessage {
  id: string;                // m1, m2, m3...
  label: string;             // Action: "Submit injury report"
  messageType: 'request' | 'response' | 'async' | 'self';
  sequence: number;          // Top-to-bottom order
  sourceParticipant: string; // Participant ID
  targetParticipant: string; // Participant ID
  description?: string;      // Optional detail
}
```

### AI Generation Response (Workflow)
```typescript
interface AIWorkflowResponse {
  nodes: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    order: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
}
```

### AI Generation Response (SSD)
```typescript
interface AISSDResponse {
  diagramType: 'ssd';
  title: string;
  description: string;
  participants: SSDParticipant[];
  messages: SSDMessage[];
}
```

---

## AI Generation Prompts

System prompts for AI generation are stored in:
- `/src/prompts/workflow-prompt.ts` - Workflow generation
- `/src/prompts/ssd-prompt.ts` - System Sequence Diagram generation

### Prompt Design Principles
1. Include full domain context (personas, systems, terminology)
2. Specify exact JSON output format matching our types
3. Provide good/bad examples for labels and titles
4. Include common scenario patterns for the domain
5. Explicitly forbid markdown wrapping of JSON output

### When Modifying Prompts
- Test with simple, medium, and complex inputs
- Verify JSON parses correctly
- Check that IDs and references are consistent
- Ensure edge sources/targets match node IDs
- Validate participant references in SSD messages

---

## Common Tasks

### Adding a New Node Type
1. Define the type interface in `/src/types/`
2. Create the React Flow node component in `/src/components/nodes/`
3. Register in React Flow's `nodeTypes` prop
4. Update AI prompts if the new type should be AI-generated

### Adding a New Participant Type (SSD)
1. Add to `participantType` union in types
2. Update SSD prompt's PARTICIPANT TYPES section
3. Add icon/styling in the participant renderer
4. Add to KNOWN SYSTEMS table if it's a specific system

### Adding a New Persona
1. Add to personas table in this file
2. Update workflow prompt's PERSONAS section
3. Update SSD prompt's KNOWN ACTORS table

### Modifying AI Output Structure
1. Update TypeScript interfaces first
2. Modify the relevant prompt's OUTPUT FORMAT section
3. Update parsing logic in the AI service
4. Update React Flow transformation utilities

---

## Code Conventions

### Naming
- Components: PascalCase (`WorkflowNode.tsx`)
- Utilities: camelCase (`transformAIResponse.ts`)
- Types: PascalCase with descriptive suffixes (`WorkflowNodeData`, `SSDMessage`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_NODE_POSITION`)

### File Organization
```
src/
├── components/
│   ├── nodes/          # React Flow node components
│   ├── edges/          # React Flow edge components
│   └── ui/             # Shared UI components
├── prompts/            # AI system prompts
├── services/           # API calls, AI generation
├── types/              # TypeScript interfaces
├── utils/              # Transformation, validation helpers
└── hooks/              # Custom React hooks
```

### React Flow Patterns
- Use `useNodesState` and `useEdgesState` for flow state
- Transform AI responses to React Flow format in a dedicated utility
- Keep node data minimal; derive display values in components
- Use `useCallback` for node/edge event handlers

---

## Terminology Guide

| Term | Meaning |
|------|---------|
| Loss Run | Claims history report exported from a TPA |
| TPA | Third Party Administrator - handles claims on behalf of municipalities |
| RMIS | Risk Management Information System |
| Experience Mod | Insurance pricing modifier based on claims history |
| RTW | Return to Work |
| Modified Duty | Light duty assignment during recovery |
| First Report of Injury | Initial claim documentation (FROI) |
| Indemnity | Wage replacement benefits |
| Medical Only | Claim with no lost time, just treatment costs |
| Reserves | Estimated future cost of an open claim |
| Subrogation | Recovery of costs from responsible third party |
| Utilization Review | Evaluation of medical treatment necessity |

---

## Things to Avoid

### In Code
- Don't store sensitive member data in this tool
- Don't hardcode TPA-specific logic; keep integrations configurable
- Don't couple React Flow rendering to AI response format directly

### In AI Prompts
- Don't allow prompts to return markdown-wrapped JSON
- Don't request more than 8 workflow steps or 15 SSD messages
- Don't include PII examples in prompts

### In Domain Logic
- Don't assume all municipalities use the same TPA
- Don't assume consistent field names across loss run formats
- Don't conflate "claim" (insurance) with "incident" (event)

---

## Testing AI Generation

### Workflow Test Cases
```
Simple: "User registration flow"
Domain-specific: "Process monthly loss run from Sedgwick"
Complex: "New injury reported by firefighter through return to work"
```

### SSD Test Cases
```
Simple: "HR uploads a loss run file"
Integration: "Platform syncs claim updates from Gallagher Bassett"
Full flow: "Firefighter injury from report to TPA submission"
Technical: "Dashboard load with department filtering"
```

### Validation Checklist
- [ ] JSON parses without error
- [ ] All node/participant IDs are unique
- [ ] All edge sources reference valid node IDs
- [ ] All edge targets reference valid node IDs
- [ ] All message sourceParticipant values reference valid participant IDs
- [ ] All message targetParticipant values reference valid participant IDs
- [ ] Order/sequence values are sequential
- [ ] No empty titles or labels
- [ ] Priority/status values are valid enum values

---

## Useful Commands
```bash
# Development
npm run dev

# Type checking
npm run typecheck

# Test AI prompt changes
npm run test:prompts

# Build for production
npm run build
```

---

## Related Documentation

- [React Flow Documentation](https://reactflow.dev/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- Ready Rebound Product Wiki (internal)
- Loss Run Format Specifications (internal)
