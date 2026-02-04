import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  reconnectEdge,
  MarkerType,
} from '@xyflow/react';
import { getLayoutedElements, type LayoutDirection } from '../utils/layout';
import * as firestore from '../lib/firestore';

// Diagram types
export type DiagramType = 'workflow' | 'ssd' | 'state-diagram' | 'erd';

// A Project contains multiple diagrams
export type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
};

// A Node represents a single step/stage in a User Workflow
export type StoryNode = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high';
  order: number;
  nodeKind?: 'story' | 'annotation';
  codeContent?: string;
  showCode?: boolean;
};

// An Actor represents a lane/participant in a System Sequence Diagram
export type Actor = {
  id: string;
  name: string;
  type: 'user' | 'system' | 'external';
  order: number;
};

// A Message represents an interaction between actors in an SSD
export type SSDMessage = {
  id: string;
  fromActorId: string;
  toActorId: string;
  label: string;
  description: string;
  type: 'sync' | 'async' | 'return';
  order: number;
};

// A State in a State Diagram
export type DiagramState = {
  id: string;
  name: string;
  description: string;
  type: 'normal' | 'initial' | 'final';
  order: number;
};

// A Transition between states
export type StateTransition = {
  id: string;
  fromStateId: string;
  toStateId: string;
  trigger: string; // Event that causes the transition
  guard?: string; // Condition that must be true
  action?: string; // Action performed during transition
  order: number;
};

// An Entity in an ERD
export type ERDEntity = {
  id: string;
  name: string;
  attributes: ERDAttribute[];
  order: number;
};

// An Attribute of an Entity
export type ERDAttribute = {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isRequired: boolean;
};

// A Relationship between entities
export type ERDRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  fromCardinality: '1' | 'N' | '0..1' | '0..N' | '1..N';
  toCardinality: '1' | 'N' | '0..1' | '0..N' | '1..N';
  label: string;
  order: number;
};

// A User Story/Diagram is a complete experience
export type UserStory = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: DiagramType;
  createdAt: number;
  updatedAt: number;
  // For workflow diagrams
  nodes: Node<StoryNode>[];
  edges: Edge[];
  // For SSD diagrams
  actors: Actor[];
  messages: SSDMessage[];
  // For State Diagrams
  states: DiagramState[];
  transitions: StateTransition[];
  // For ERD
  entities: ERDEntity[];
  relationships: ERDRelationship[];
  // AI-generated summary
  summary?: string;
};

type StoryStore = {
  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Projects
  projects: Project[];
  activeProjectId: string | null;

  // All user stories
  userStories: UserStory[];
  activeStoryId: string | null;

  // Current active story's data
  nodes: Node<StoryNode>[];
  edges: Edge[];
  actors: Actor[];
  messages: SSDMessage[];
  states: DiagramState[];
  transitions: StateTransition[];
  entities: ERDEntity[];
  relationships: ERDRelationship[];

  // Presentation mode
  isPresentationMode: boolean;
  currentStepIndex: number;
  presentationOrder: string[];

  // React Flow handlers (for workflow)
  onNodesChange: OnNodesChange<Node<StoryNode>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;

  // Initialization
  initializeStore: () => Promise<void>;

  // Project CRUD
  createProject: (name: string, description?: string) => Promise<string>;
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description'>>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => Project | undefined;
  getProjectDiagrams: (projectId: string) => UserStory[];

  // User Story CRUD
  createUserStory: (name: string, type: DiagramType, description?: string) => Promise<string>;
  updateUserStory: (id: string, updates: Partial<Pick<UserStory, 'name' | 'description'>>) => Promise<void>;
  changeDiagramType: (id: string, newType: DiagramType) => Promise<void>;
  deleteUserStory: (id: string) => Promise<void>;
  setActiveStory: (id: string | null) => void;
  duplicateUserStory: (id: string) => Promise<string>;
  getActiveStory: () => UserStory | undefined;
  saveDiagramSummary: (summary: string) => Promise<void>;

  // Node CRUD (for workflow)
  addNode: (node: Omit<StoryNode, 'id' | 'order'>, position?: { x: number; y: number }) => void;
  addAnnotationNode: (title: string, description: string, position?: { x: number; y: number }) => void;
  importGeneratedWorkflow: (nodes: Array<{ id: string; title: string; description: string; priority: StoryNode['priority']; order: number }>, edges: Array<{ source: string; target: string }>) => void;
  updateNode: (id: string, updates: Partial<Omit<StoryNode, 'id'>>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  getNode: (id: string) => StoryNode | undefined;
  autoLayout: (direction?: LayoutDirection) => Promise<void>;
  updateEdgeTypes: (edgeIds: string[], edgeType: string) => void;

  // Actor CRUD (for SSD)
  addActor: (actor: Omit<Actor, 'id' | 'order'>) => void;
  updateActor: (id: string, updates: Partial<Omit<Actor, 'id'>>) => void;
  deleteActor: (id: string) => void;
  reorderActors: (actorIds: string[]) => void;

  // Message CRUD (for SSD)
  addMessage: (message: Omit<SSDMessage, 'id' | 'order'>) => void;
  updateMessage: (id: string, updates: Partial<Omit<SSDMessage, 'id'>>) => void;
  deleteMessage: (id: string) => void;
  reorderMessages: (messageIds: string[]) => void;
  importGeneratedSSD: (
    generatedActors: Omit<Actor, 'id'>[],
    generatedMessages: Omit<SSDMessage, 'id' | 'order'>[],
    participantIdMap: Map<string, number>
  ) => void;

  // State CRUD (for State Diagrams)
  addState: (state: Omit<DiagramState, 'id' | 'order'>) => void;
  updateState: (id: string, updates: Partial<Omit<DiagramState, 'id'>>) => void;
  deleteState: (id: string) => void;
  reorderStates: (stateIds: string[]) => void;

  // Transition CRUD (for State Diagrams)
  addTransition: (transition: Omit<StateTransition, 'id' | 'order'>) => void;
  updateTransition: (id: string, updates: Partial<Omit<StateTransition, 'id'>>) => void;
  deleteTransition: (id: string) => void;
  importGeneratedStateDiagram: (
    generatedStates: Omit<DiagramState, 'id'>[],
    generatedTransitions: Omit<StateTransition, 'id' | 'order'>[]
  ) => void;

  // Entity CRUD (for ERD)
  addEntity: (entity: Omit<ERDEntity, 'id' | 'order'>) => void;
  updateEntity: (id: string, updates: Partial<Omit<ERDEntity, 'id'>>) => void;
  deleteEntity: (id: string) => void;
  reorderEntities: (entityIds: string[]) => void;

  // Relationship CRUD (for ERD)
  addRelationship: (relationship: Omit<ERDRelationship, 'id' | 'order'>) => void;
  updateRelationship: (id: string, updates: Partial<Omit<ERDRelationship, 'id'>>) => void;
  deleteRelationship: (id: string) => void;
  importGeneratedERD: (
    generatedEntities: Omit<ERDEntity, 'id'>[],
    generatedRelationships: Omit<ERDRelationship, 'id' | 'order'>[]
  ) => void;

  // Presentation controls
  startPresentation: () => void;
  stopPresentation: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  getCurrentNodeId: () => string | null;

  // Internal
  _saveActiveStory: () => void;
  _debouncedSave: () => void;
};

const generateId = () => Math.random().toString(36).substring(2, 11);

const DEFAULT_PROJECT_ID = 'default-project';

const createDefaultProject = (): Project => {
  const now = Date.now();
  return {
    id: DEFAULT_PROJECT_ID,
    name: 'My First Project',
    description: 'A sample project to get started',
    createdAt: now,
    updatedAt: now,
  };
};

const getPresentationOrder = (nodes: Node<StoryNode>[]) => {
  if (!nodes || nodes.length === 0) return [];
  return [...nodes]
    .filter((n) => n.data?.nodeKind !== 'annotation')
    .sort((a, b) => (a.data?.order ?? 0) - (b.data?.order ?? 0))
    .map((n) => n.id);
};

const getMessagePresentationOrder = (messages: SSDMessage[]) => {
  return [...messages]
    .sort((a, b) => a.order - b.order)
    .map((m) => m.id);
};

let idCounter = 100;
const getNextId = () => `${idCounter++}`;

// Debounce helper
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useStoryStore = create<StoryStore>()(
  (set, get) => ({
    isLoading: true,
    isInitialized: false,
    projects: [],
    activeProjectId: null,
    userStories: [],
    activeStoryId: null,
    nodes: [],
    edges: [],
    actors: [],
    messages: [],
    states: [],
    transitions: [],
    entities: [],
    relationships: [],
    isPresentationMode: false,
    currentStepIndex: 0,
    presentationOrder: [],

    initializeStore: async () => {
      if (get().isInitialized) return;

      set({ isLoading: true });

      try {
        // Fetch projects and diagrams from Firestore
        const [projects, diagrams] = await Promise.all([
          firestore.fetchProjects(),
          firestore.fetchDiagrams(),
        ]);

        // If no projects exist, create a default one
        if (projects.length === 0) {
          const defaultProject = createDefaultProject();
          await firestore.createProject(defaultProject);
          projects.push(defaultProject);
        }

        set({
          projects,
          userStories: diagrams,
          activeProjectId: projects[0]?.id || null,
          isLoading: false,
          isInitialized: true,
        });
      } catch (error) {
        console.error('Failed to initialize store from Firestore:', error);
        // Fall back to default state
        const defaultProject = createDefaultProject();
        set({
          projects: [defaultProject],
          activeProjectId: DEFAULT_PROJECT_ID,
          userStories: [],
          isLoading: false,
          isInitialized: true,
        });
      }
    },

    onNodesChange: (changes) => {
      const newNodes = applyNodeChanges(changes, get().nodes);
      set({ nodes: newNodes });
      get()._debouncedSave();
    },

    onEdgesChange: (changes) => {
      const newEdges = applyEdgeChanges(changes, get().edges);
      set({ edges: newEdges });
      get()._debouncedSave();
    },

    onConnect: (connection) => {
      const { nodes } = get();
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      const isAnnotationEdge =
        sourceNode?.data?.nodeKind === 'annotation' ||
        targetNode?.data?.nodeKind === 'annotation';

      const newEdge = {
        ...connection,
        type: 'smoothstep',
        reconnectable: true,
        style: {
          strokeWidth: 2,
          ...(isAnnotationEdge ? { strokeDasharray: '6 4' } : {}),
        },
        ...(isAnnotationEdge ? { className: 'annotation-edge' } : {}),
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      const newEdges = addEdge(newEdge, get().edges);
      set({ edges: newEdges });
      get()._debouncedSave();
    },

    onReconnect: (oldEdge, newConnection) => {
      const newEdges = reconnectEdge(oldEdge, newConnection, get().edges);
      set({ edges: newEdges });
      get()._debouncedSave();
    },

    // Project CRUD
    createProject: async (name, description = '') => {
      const id = generateId();
      const now = Date.now();
      const newProject: Project = {
        id,
        name,
        description,
        createdAt: now,
        updatedAt: now,
      };

      // Update local state immediately
      set((state) => ({
        projects: [...state.projects, newProject],
        activeProjectId: id,
        activeStoryId: null,
        nodes: [],
        edges: [],
        actors: [],
        messages: [],
        states: [],
        transitions: [],
        entities: [],
        relationships: [],
      }));

      // Sync to Firestore
      await firestore.createProject(newProject);

      return id;
    },

    updateProject: async (id, updates) => {
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id
            ? { ...project, ...updates, updatedAt: Date.now() }
            : project
        ),
      }));

      await firestore.updateProject(id, updates);
    },

    deleteProject: async (id) => {
      const { activeProjectId, projects } = get();
      if (projects.length <= 1) return;

      const remainingProjects = projects.filter((p) => p.id !== id);
      const newActiveProjectId = activeProjectId === id ? remainingProjects[0]?.id || null : activeProjectId;

      set((state) => ({
        projects: remainingProjects,
        userStories: state.userStories.filter((s) => s.projectId !== id),
        activeProjectId: newActiveProjectId,
        activeStoryId: null,
        nodes: [],
        edges: [],
        actors: [],
        messages: [],
        states: [],
        transitions: [],
        entities: [],
        relationships: [],
      }));

      await firestore.deleteProject(id);
    },

    setActiveProject: (id) => {
      set({
        activeProjectId: id,
        activeStoryId: null,
        nodes: [],
        edges: [],
        actors: [],
        messages: [],
        states: [],
        transitions: [],
        entities: [],
        relationships: [],
        isPresentationMode: false,
        currentStepIndex: 0,
        presentationOrder: [],
      });
    },

    getActiveProject: () => {
      const { projects, activeProjectId } = get();
      return projects.find((p) => p.id === activeProjectId);
    },

    getProjectDiagrams: (projectId) => {
      return get().userStories.filter((s) => s.projectId === projectId);
    },

    // User Story CRUD
    createUserStory: async (name, type, description = '') => {
      const { activeProjectId } = get();
      if (!activeProjectId) return '';

      const id = generateId();
      const now = Date.now();
      const newStory: UserStory = {
        id,
        projectId: activeProjectId,
        name,
        description,
        type,
        createdAt: now,
        updatedAt: now,
        nodes: [],
        edges: [],
        actors: type === 'ssd' ? [
          { id: getNextId(), name: 'Client', type: 'user', order: 1 },
          { id: getNextId(), name: 'Server', type: 'system', order: 2 },
        ] : [],
        messages: [],
        states: type === 'state-diagram' ? [
          { id: getNextId(), name: 'Start', description: 'Initial state', type: 'initial', order: 1 },
        ] : [],
        transitions: [],
        entities: [],
        relationships: [],
      };

      set((state) => ({
        userStories: [...state.userStories, newStory],
      }));

      await firestore.createDiagram(newStory);

      return id;
    },

    updateUserStory: async (id, updates) => {
      set((state) => ({
        userStories: state.userStories.map((story) =>
          story.id === id
            ? { ...story, ...updates, updatedAt: Date.now() }
            : story
        ),
      }));

      await firestore.updateDiagram(id, updates);
    },

    changeDiagramType: async (id, newType) => {
      // Update the diagram type and clear type-specific content
      set((state) => ({
        userStories: state.userStories.map((story) =>
          story.id === id
            ? {
                ...story,
                type: newType,
                updatedAt: Date.now(),
                // Clear all type-specific content
                nodes: [],
                edges: [],
                actors: newType === 'ssd' ? [
                  { id: 'actor-1', name: 'Client', type: 'user', order: 1 },
                  { id: 'actor-2', name: 'Server', type: 'system', order: 2 },
                ] : [],
                messages: [],
                states: newType === 'state-diagram' ? [
                  { id: 'state-1', name: 'Start', description: 'Initial state', type: 'initial', order: 1 },
                ] : [],
                transitions: [],
                entities: [],
                relationships: [],
              }
            : story
        ),
        // Also clear current working state if this is the active story
        ...(state.activeStoryId === id ? {
          nodes: [],
          edges: [],
          actors: newType === 'ssd' ? [
            { id: 'actor-1', name: 'Client', type: 'user', order: 1 },
            { id: 'actor-2', name: 'Server', type: 'system', order: 2 },
          ] : [],
          messages: [],
          states: newType === 'state-diagram' ? [
            { id: 'state-1', name: 'Start', description: 'Initial state', type: 'initial', order: 1 },
          ] : [],
          transitions: [],
          entities: [],
          relationships: [],
        } : {}),
      }));

      await firestore.updateDiagram(id, { type: newType });
    },

    deleteUserStory: async (id) => {
      const { activeStoryId } = get();

      set((state) => ({
        userStories: state.userStories.filter((s) => s.id !== id),
        ...(activeStoryId === id ? {
          activeStoryId: null,
          nodes: [],
          edges: [],
          actors: [],
          messages: [],
        } : {}),
      }));

      await firestore.deleteDiagram(id);
    },

    setActiveStory: (id) => {
      const story = get().userStories.find((s) => s.id === id);
      if (story) {
        const nodes = story.nodes || [];
        const nodeIds = new Set(nodes.map(n => n.id));

        // Clean up broken edges - remove any edge where source or target node doesn't exist
        const validEdges = (story.edges || []).filter(edge =>
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );

        set({
          activeStoryId: id,
          nodes: nodes,
          edges: validEdges,
          actors: story.actors || [],
          messages: story.messages || [],
          states: story.states || [],
          transitions: story.transitions || [],
          entities: story.entities || [],
          relationships: story.relationships || [],
          presentationOrder: (story.type === 'workflow' || story.type === undefined)
            ? getPresentationOrder(nodes)
            : getMessagePresentationOrder(story.messages || []),
          currentStepIndex: 0,
          isPresentationMode: false,
        });

        // If we cleaned up any edges, save the cleaned state
        if (validEdges.length !== (story.edges || []).length) {
          get()._debouncedSave();
        }
      } else {
        set({
          activeStoryId: null,
          nodes: [],
          edges: [],
          actors: [],
          messages: [],
          states: [],
          transitions: [],
          entities: [],
          relationships: [],
          presentationOrder: [],
        });
      }
    },

    duplicateUserStory: async (id) => {
      const story = get().userStories.find((s) => s.id === id);
      if (!story) return '';

      const newId = generateId();
      const now = Date.now();
      const newStory: UserStory = {
        ...story,
        id: newId,
        name: `${story.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
        nodes: (story.nodes || []).map((n) => ({ ...n })),
        edges: (story.edges || []).map((e) => ({ ...e })),
        actors: (story.actors || []).map((a) => ({ ...a })),
        messages: (story.messages || []).map((m) => ({ ...m })),
        states: (story.states || []).map((s) => ({ ...s })),
        transitions: (story.transitions || []).map((t) => ({ ...t })),
        entities: (story.entities || []).map((e) => ({ ...e, attributes: [...e.attributes] })),
        relationships: (story.relationships || []).map((r) => ({ ...r })),
      };

      set((state) => ({
        userStories: [...state.userStories, newStory],
      }));

      await firestore.createDiagram(newStory);

      return newId;
    },

    getActiveStory: () => {
      const { userStories, activeStoryId } = get();
      return userStories.find((s) => s.id === activeStoryId);
    },

    saveDiagramSummary: async (summary: string) => {
      const { activeStoryId } = get();
      if (!activeStoryId) return;

      set((state) => ({
        userStories: state.userStories.map((story) =>
          story.id === activeStoryId
            ? { ...story, summary, updatedAt: Date.now() }
            : story
        ),
      }));

      await firestore.updateDiagram(activeStoryId, { summary });
    },

    // Node CRUD (workflow)
    addNode: (nodeData, position = { x: 250, y: 250 }) => {
      const { nodes, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.data.order)) : 0;
      const newNode: Node<StoryNode> = {
        id,
        type: 'storyNode',
        position,
        data: { ...nodeData, id, order: maxOrder + 1 },
      };
      const newNodes = [...nodes, newNode];
      set({
        nodes: newNodes,
        presentationOrder: getPresentationOrder(newNodes),
      });
      get()._debouncedSave();
    },

    addAnnotationNode: (title, description, position = { x: 250, y: 250 }) => {
      const { nodes, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.data.order)) : 0;
      const newNode: Node<StoryNode> = {
        id,
        type: 'annotationNode',
        position,
        data: {
          id,
          title,
          description,
          status: 'todo',
          priority: 'low',
          order: maxOrder + 1,
          nodeKind: 'annotation',
          codeContent: '',
          showCode: false,
        },
      };
      const newNodes = [...nodes, newNode];
      set({
        nodes: newNodes,
        presentationOrder: getPresentationOrder(newNodes),
      });
      get()._debouncedSave();
    },

    updateNode: (id, updates) => {
      const newNodes = get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      );
      set({
        nodes: newNodes,
        presentationOrder: getPresentationOrder(newNodes),
      });
      get()._debouncedSave();
    },

    deleteNode: (id) => {
      const newNodes = get().nodes.filter((node) => node.id !== id);
      const currentIndex = get().currentStepIndex;
      const newOrder = getPresentationOrder(newNodes);
      set({
        nodes: newNodes,
        edges: get().edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
        presentationOrder: newOrder,
        currentStepIndex: Math.min(currentIndex, Math.max(0, newOrder.length - 1)),
      });
      get()._debouncedSave();
    },

    getNode: (id) => {
      const node = get().nodes.find((n) => n.id === id);
      return node?.data;
    },

    duplicateNode: (id) => {
      const { nodes, activeStoryId } = get();
      if (!activeStoryId) return;

      const sourceNode = nodes.find((n) => n.id === id);
      if (!sourceNode) return;

      const newId = getNextId();
      const maxOrder = Math.max(...nodes.map((n) => n.data.order));
      const newNode: Node<StoryNode> = {
        ...sourceNode,
        id: newId,
        position: {
          x: sourceNode.position.x + 50,
          y: sourceNode.position.y + 50,
        },
        data: {
          ...sourceNode.data,
          id: newId,
          title: `${sourceNode.data.title} (Copy)`,
          order: maxOrder + 1,
        },
        selected: false,
      };
      const newNodes = [...nodes, newNode];
      set({
        nodes: newNodes,
        presentationOrder: getPresentationOrder(newNodes),
      });
      get()._debouncedSave();
    },

    autoLayout: async (direction = 'TB') => {
      const { nodes, edges, activeStoryId } = get();
      if (!activeStoryId || nodes.length === 0) return;

      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
        nodes,
        edges,
        direction
      );

      set({
        nodes: layoutedNodes,
        edges: layoutedEdges,
      });
      get()._debouncedSave();
    },

    updateEdgeTypes: (edgeIds, edgeType) => {
      const { edges } = get();
      const edgeIdSet = new Set(edgeIds);
      const updatedEdges = edges.map(edge => {
        if (edgeIdSet.has(edge.id)) {
          return { ...edge, type: edgeType };
        }
        return edge;
      });
      set({ edges: updatedEdges });
      get()._debouncedSave();
    },

    importGeneratedWorkflow: (generatedNodes, generatedEdges) => {
      const { nodes: existingNodes, activeStoryId } = get();
      if (!activeStoryId) return;

      // Create ID mapping from generated IDs to new IDs
      const idMap = new Map<string, string>();
      const startX = 100;
      const startY = 100;
      const horizontalGap = 350;
      const verticalGap = 150;
      const nodesPerRow = 3;

      // Get max order from existing nodes
      const maxOrder = existingNodes.length > 0
        ? Math.max(...existingNodes.map((n) => n.data.order))
        : 0;

      // Create new nodes with proper React Flow structure
      const newNodes: Node<StoryNode>[] = generatedNodes.map((node, index) => {
        const newId = getNextId();
        idMap.set(node.id, newId);

        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;

        return {
          id: newId,
          type: 'storyNode',
          position: {
            x: startX + col * horizontalGap,
            y: startY + row * verticalGap,
          },
          data: {
            id: newId,
            title: node.title,
            description: node.description,
            status: 'todo' as const,
            priority: node.priority,
            order: maxOrder + node.order,
          },
        };
      });

      // Create edges with mapped IDs - use bottom-source/top-target handles for TB layout
      const newEdges: Edge[] = generatedEdges.map((edge, index) => ({
        id: `e${idMap.get(edge.source)}-${idMap.get(edge.target)}-${index}`,
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target',
        type: 'smoothstep',
        style: { strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      })).filter(edge => edge.source && edge.target);

      const allNodes = [...existingNodes, ...newNodes];
      const allEdges = [...get().edges, ...newEdges];

      set({
        nodes: allNodes,
        edges: allEdges,
        presentationOrder: getPresentationOrder(allNodes),
      });
      get()._debouncedSave();
    },

    // Actor CRUD (SSD)
    addActor: (actorData) => {
      const { actors, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = actors.length > 0 ? Math.max(...actors.map((a) => a.order)) : 0;
      const newActor: Actor = { ...actorData, id, order: maxOrder + 1 };
      set({ actors: [...actors, newActor] });
      get()._debouncedSave();
    },

    updateActor: (id, updates) => {
      const newActors = get().actors.map((actor) =>
        actor.id === id ? { ...actor, ...updates } : actor
      );
      set({ actors: newActors });
      get()._debouncedSave();
    },

    deleteActor: (id) => {
      const newActors = get().actors.filter((a) => a.id !== id);
      const newMessages = get().messages.filter(
        (m) => m.fromActorId !== id && m.toActorId !== id
      );
      set({
        actors: newActors,
        messages: newMessages,
      });
      get()._debouncedSave();
    },

    reorderActors: (actorIds) => {
      const { actors } = get();
      const newActors = actorIds.map((id, index) => {
        const actor = actors.find((a) => a.id === id);
        return actor ? { ...actor, order: index + 1 } : null;
      }).filter(Boolean) as Actor[];
      set({ actors: newActors });
      get()._debouncedSave();
    },

    // Message CRUD (SSD)
    addMessage: (messageData) => {
      const { messages, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = messages.length > 0 ? Math.max(...messages.map((m) => m.order)) : 0;
      const newMessage: SSDMessage = { ...messageData, id, order: maxOrder + 1 };
      const newMessages = [...messages, newMessage];
      set({
        messages: newMessages,
        presentationOrder: getMessagePresentationOrder(newMessages),
      });
      get()._debouncedSave();
    },

    updateMessage: (id, updates) => {
      const newMessages = get().messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      );
      set({
        messages: newMessages,
        presentationOrder: getMessagePresentationOrder(newMessages),
      });
      get()._debouncedSave();
    },

    deleteMessage: (id) => {
      const newMessages = get().messages.filter((m) => m.id !== id);
      const currentIndex = get().currentStepIndex;
      const newOrder = getMessagePresentationOrder(newMessages);
      set({
        messages: newMessages,
        presentationOrder: newOrder,
        currentStepIndex: Math.min(currentIndex, Math.max(0, newOrder.length - 1)),
      });
      get()._debouncedSave();
    },

    reorderMessages: (messageIds) => {
      const { messages } = get();
      const newMessages = messageIds.map((id, index) => {
        const msg = messages.find((m) => m.id === id);
        return msg ? { ...msg, order: index + 1 } : null;
      }).filter(Boolean) as SSDMessage[];
      set({
        messages: newMessages,
        presentationOrder: getMessagePresentationOrder(newMessages),
      });
      get()._debouncedSave();
    },

    importGeneratedSSD: (generatedActors, generatedMessages, participantIdMap) => {
      const { activeStoryId } = get();
      if (!activeStoryId) return;

      // Create actor ID mapping from generated IDs to new IDs
      const actorIdMap = new Map<string, string>();

      // Create actors with proper IDs
      const newActors: Actor[] = generatedActors.map((actor, index) => {
        const newId = getNextId();
        // Map the generated participant ID (p1, p2, etc.) to our new ID
        const generatedId = Array.from(participantIdMap.entries())
          .find(([, orderIndex]) => orderIndex === index)?.[0];
        if (generatedId) {
          actorIdMap.set(generatedId, newId);
        }
        return {
          id: newId,
          name: actor.name,
          type: actor.type,
          order: actor.order,
        };
      });

      // Create messages with mapped actor IDs
      const newMessages: SSDMessage[] = generatedMessages.map((msg, index) => ({
        id: getNextId(),
        fromActorId: actorIdMap.get(msg.fromActorId) || msg.fromActorId,
        toActorId: actorIdMap.get(msg.toActorId) || msg.toActorId,
        label: msg.label,
        description: msg.description,
        type: msg.type,
        order: index + 1,
      }));

      set({
        actors: newActors,
        messages: newMessages,
        presentationOrder: getMessagePresentationOrder(newMessages),
      });
      get()._debouncedSave();
    },

    // State CRUD (State Diagrams)
    addState: (stateData) => {
      const { states, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = states.length > 0 ? Math.max(...states.map((s) => s.order)) : 0;
      const newState: DiagramState = { ...stateData, id, order: maxOrder + 1 };
      set({ states: [...states, newState] });
      get()._debouncedSave();
    },

    updateState: (id, updates) => {
      const newStates = get().states.map((state) =>
        state.id === id ? { ...state, ...updates } : state
      );
      set({ states: newStates });
      get()._debouncedSave();
    },

    deleteState: (id) => {
      const newStates = get().states.filter((s) => s.id !== id);
      const newTransitions = get().transitions.filter(
        (t) => t.fromStateId !== id && t.toStateId !== id
      );
      set({
        states: newStates,
        transitions: newTransitions,
      });
      get()._debouncedSave();
    },

    reorderStates: (stateIds) => {
      const { states } = get();
      const newStates = stateIds.map((id, index) => {
        const state = states.find((s) => s.id === id);
        return state ? { ...state, order: index + 1 } : null;
      }).filter(Boolean) as DiagramState[];
      set({ states: newStates });
      get()._debouncedSave();
    },

    // Transition CRUD (State Diagrams)
    addTransition: (transitionData) => {
      const { transitions, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = transitions.length > 0 ? Math.max(...transitions.map((t) => t.order)) : 0;
      const newTransition: StateTransition = { ...transitionData, id, order: maxOrder + 1 };
      set({ transitions: [...transitions, newTransition] });
      get()._debouncedSave();
    },

    updateTransition: (id, updates) => {
      const newTransitions = get().transitions.map((transition) =>
        transition.id === id ? { ...transition, ...updates } : transition
      );
      set({ transitions: newTransitions });
      get()._debouncedSave();
    },

    deleteTransition: (id) => {
      const newTransitions = get().transitions.filter((t) => t.id !== id);
      set({ transitions: newTransitions });
      get()._debouncedSave();
    },

    importGeneratedStateDiagram: (generatedStates, generatedTransitions) => {
      const { activeStoryId } = get();
      if (!activeStoryId) return;

      const stateIdMap = new Map<string, string>();

      // Create states with proper IDs
      const newStates: DiagramState[] = generatedStates.map((state, index) => {
        const newId = getNextId();
        stateIdMap.set(`s${index + 1}`, newId);
        return {
          id: newId,
          name: state.name,
          description: state.description,
          type: state.type,
          order: state.order,
        };
      });

      // Create transitions with mapped state IDs
      const newTransitions: StateTransition[] = generatedTransitions.map((trans, index) => ({
        id: getNextId(),
        fromStateId: stateIdMap.get(trans.fromStateId) || trans.fromStateId,
        toStateId: stateIdMap.get(trans.toStateId) || trans.toStateId,
        trigger: trans.trigger,
        guard: trans.guard,
        action: trans.action,
        order: index + 1,
      }));

      set({
        states: newStates,
        transitions: newTransitions,
      });
      get()._debouncedSave();
    },

    // Entity CRUD (ERD)
    addEntity: (entityData) => {
      const { entities, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = entities.length > 0 ? Math.max(...entities.map((e) => e.order)) : 0;
      const newEntity: ERDEntity = { ...entityData, id, order: maxOrder + 1 };
      set({ entities: [...entities, newEntity] });
      get()._debouncedSave();
    },

    updateEntity: (id, updates) => {
      const newEntities = get().entities.map((entity) =>
        entity.id === id ? { ...entity, ...updates } : entity
      );
      set({ entities: newEntities });
      get()._debouncedSave();
    },

    deleteEntity: (id) => {
      const newEntities = get().entities.filter((e) => e.id !== id);
      const newRelationships = get().relationships.filter(
        (r) => r.fromEntityId !== id && r.toEntityId !== id
      );
      set({
        entities: newEntities,
        relationships: newRelationships,
      });
      get()._debouncedSave();
    },

    reorderEntities: (entityIds) => {
      const { entities } = get();
      const newEntities = entityIds.map((id, index) => {
        const entity = entities.find((e) => e.id === id);
        return entity ? { ...entity, order: index + 1 } : null;
      }).filter(Boolean) as ERDEntity[];
      set({ entities: newEntities });
      get()._debouncedSave();
    },

    // Relationship CRUD (ERD)
    addRelationship: (relationshipData) => {
      const { relationships, activeStoryId } = get();
      if (!activeStoryId) return;

      const id = getNextId();
      const maxOrder = relationships.length > 0 ? Math.max(...relationships.map((r) => r.order)) : 0;
      const newRelationship: ERDRelationship = { ...relationshipData, id, order: maxOrder + 1 };
      set({ relationships: [...relationships, newRelationship] });
      get()._debouncedSave();
    },

    updateRelationship: (id, updates) => {
      const newRelationships = get().relationships.map((rel) =>
        rel.id === id ? { ...rel, ...updates } : rel
      );
      set({ relationships: newRelationships });
      get()._debouncedSave();
    },

    deleteRelationship: (id) => {
      const newRelationships = get().relationships.filter((r) => r.id !== id);
      set({ relationships: newRelationships });
      get()._debouncedSave();
    },

    importGeneratedERD: (generatedEntities, generatedRelationships) => {
      const { activeStoryId } = get();
      if (!activeStoryId) return;

      const entityIdMap = new Map<string, string>();

      // Create entities with proper IDs
      const newEntities: ERDEntity[] = generatedEntities.map((entity, index) => {
        const newId = getNextId();
        entityIdMap.set(`e${index + 1}`, newId);
        return {
          id: newId,
          name: entity.name,
          attributes: entity.attributes.map((attr) => ({
            ...attr,
            id: getNextId(),
          })),
          order: entity.order,
        };
      });

      // Create relationships with mapped entity IDs
      const newRelationships: ERDRelationship[] = generatedRelationships.map((rel, index) => ({
        id: getNextId(),
        fromEntityId: entityIdMap.get(rel.fromEntityId) || rel.fromEntityId,
        toEntityId: entityIdMap.get(rel.toEntityId) || rel.toEntityId,
        fromCardinality: rel.fromCardinality,
        toCardinality: rel.toCardinality,
        label: rel.label,
        order: index + 1,
      }));

      set({
        entities: newEntities,
        relationships: newRelationships,
      });
      get()._debouncedSave();
    },

    // Presentation
    startPresentation: () => {
      const story = get().getActiveStory();
      if (!story) return;

      const storyNodes = story.nodes || [];
      const storyMessages = story.messages || [];

      const isWorkflow = story.type === 'workflow' || story.type === undefined;
      const order = isWorkflow
        ? getPresentationOrder(storyNodes)
        : getMessagePresentationOrder(storyMessages);

      set({
        isPresentationMode: true,
        currentStepIndex: 0,
        presentationOrder: order,
        nodes: storyNodes,
        edges: story.edges || [],
        actors: story.actors || [],
        messages: storyMessages,
      });
    },

    stopPresentation: () => {
      set({ isPresentationMode: false });
    },

    nextStep: () => {
      const { currentStepIndex, presentationOrder } = get();
      if (currentStepIndex < presentationOrder.length - 1) {
        set({ currentStepIndex: currentStepIndex + 1 });
      }
    },

    prevStep: () => {
      const { currentStepIndex } = get();
      if (currentStepIndex > 0) {
        set({ currentStepIndex: currentStepIndex - 1 });
      }
    },

    goToStep: (index: number) => {
      const { presentationOrder } = get();
      if (index >= 0 && index < presentationOrder.length) {
        set({ currentStepIndex: index });
      }
    },

    getCurrentNodeId: () => {
      const { presentationOrder, currentStepIndex } = get();
      return presentationOrder[currentStepIndex] || null;
    },

    _saveActiveStory: () => {
      const { activeStoryId, nodes, edges, actors, messages, states, transitions, entities, relationships, userStories } = get();
      if (!activeStoryId) return;

      const updatedStory = userStories.find((s) => s.id === activeStoryId);
      if (!updatedStory) return;

      const newStory = {
        ...updatedStory,
        nodes,
        edges,
        actors,
        messages,
        states,
        transitions,
        entities,
        relationships,
        updatedAt: Date.now(),
      };

      set((state) => ({
        userStories: state.userStories.map((story) =>
          story.id === activeStoryId ? newStory : story
        ),
      }));

      // Sync to Firestore
      firestore.updateDiagram(activeStoryId, {
        nodes,
        edges,
        actors,
        messages,
        states,
        transitions,
        entities,
        relationships,
      }).catch((err) => console.error('Failed to save to Firestore:', err));
    },

    _debouncedSave: () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        get()._saveActiveStory();
      }, 500);
    },
  })
);
