import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

// Diagram types
export type DiagramType = 'workflow' | 'ssd';

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
  priority: 'low' | 'medium' | 'high';
  order: number;
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
};

type StoryStore = {
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

  // Presentation mode
  isPresentationMode: boolean;
  currentStepIndex: number;
  presentationOrder: string[];

  // React Flow handlers (for workflow)
  onNodesChange: OnNodesChange<Node<StoryNode>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;

  // Project CRUD
  createProject: (name: string, description?: string) => string;
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description'>>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => Project | undefined;
  getProjectDiagrams: (projectId: string) => UserStory[];

  // User Story CRUD
  createUserStory: (name: string, type: DiagramType, description?: string) => string;
  updateUserStory: (id: string, updates: Partial<Pick<UserStory, 'name' | 'description'>>) => void;
  deleteUserStory: (id: string) => void;
  setActiveStory: (id: string | null) => void;
  duplicateUserStory: (id: string) => string;
  getActiveStory: () => UserStory | undefined;

  // Node CRUD (for workflow)
  addNode: (node: Omit<StoryNode, 'id' | 'order'>, position?: { x: number; y: number }) => void;
  importGeneratedWorkflow: (nodes: Array<{ id: string; title: string; description: string; priority: StoryNode['priority']; order: number }>, edges: Array<{ source: string; target: string }>) => void;
  updateNode: (id: string, updates: Partial<Omit<StoryNode, 'id'>>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  getNode: (id: string) => StoryNode | undefined;
  autoLayout: (direction?: LayoutDirection) => void;

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

  // Presentation controls
  startPresentation: () => void;
  stopPresentation: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  getCurrentNodeId: () => string | null;

  // Internal
  _saveActiveStory: () => void;
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

const createDefaultWorkflow = (projectId: string): UserStory => {
  const now = Date.now();
  return {
    id: generateId(),
    projectId,
    name: 'My First Workflow',
    description: 'A sample user workflow to get started',
    type: 'workflow',
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: '1',
        type: 'storyNode',
        position: { x: 100, y: 100 },
        data: {
          id: '1',
          title: 'Step 1: User Authentication',
          description: 'User logs into the system with their credentials.',
          status: 'done',
          priority: 'high',
          order: 1,
        },
      },
      {
        id: '2',
        type: 'storyNode',
        position: { x: 450, y: 100 },
        data: {
          id: '2',
          title: 'Step 2: View Dashboard',
          description: 'User sees their personalized dashboard with key metrics.',
          status: 'in-progress',
          priority: 'high',
          order: 2,
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', animated: true },
    ],
    actors: [],
    messages: [],
  };
};

const getPresentationOrder = (nodes: Node<StoryNode>[]) => {
  if (!nodes || nodes.length === 0) return [];
  return [...nodes]
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

export const useStoryStore = create<StoryStore>()(
  persist(
    (set, get) => ({
      projects: [createDefaultProject()],
      activeProjectId: DEFAULT_PROJECT_ID,
      userStories: [createDefaultWorkflow(DEFAULT_PROJECT_ID)],
      activeStoryId: null,
      nodes: [],
      edges: [],
      actors: [],
      messages: [],
      isPresentationMode: false,
      currentStepIndex: 0,
      presentationOrder: [],

      onNodesChange: (changes) => {
        const newNodes = applyNodeChanges(changes, get().nodes);
        set({ nodes: newNodes });
        get()._saveActiveStory();
      },

      onEdgesChange: (changes) => {
        const newEdges = applyEdgeChanges(changes, get().edges);
        set({ edges: newEdges });
        get()._saveActiveStory();
      },

      onConnect: (connection) => {
        const newEdge = {
          ...connection,
          type: 'smoothstep',
          reconnectable: true,
          style: { strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        };
        const newEdges = addEdge(newEdge, get().edges);
        set({ edges: newEdges });
        get()._saveActiveStory();
      },

      onReconnect: (oldEdge, newConnection) => {
        const newEdges = reconnectEdge(oldEdge, newConnection, get().edges);
        set({ edges: newEdges });
        get()._saveActiveStory();
      },

      // Project CRUD
      createProject: (name, description = '') => {
        const id = generateId();
        const now = Date.now();
        const newProject: Project = {
          id,
          name,
          description,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          projects: [...state.projects, newProject],
          activeProjectId: id,
          activeStoryId: null,
          nodes: [],
          edges: [],
          actors: [],
          messages: [],
        }));
        return id;
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, ...updates, updatedAt: Date.now() }
              : project
          ),
        }));
      },

      deleteProject: (id) => {
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
        }));
      },

      setActiveProject: (id) => {
        set({
          activeProjectId: id,
          activeStoryId: null,
          nodes: [],
          edges: [],
          actors: [],
          messages: [],
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
      createUserStory: (name, type, description = '') => {
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
        };
        set((state) => ({
          userStories: [...state.userStories, newStory],
        }));
        return id;
      },

      updateUserStory: (id, updates) => {
        set((state) => ({
          userStories: state.userStories.map((story) =>
            story.id === id
              ? { ...story, ...updates, updatedAt: Date.now() }
              : story
          ),
        }));
      },

      deleteUserStory: (id) => {
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
      },

      setActiveStory: (id) => {
        const story = get().userStories.find((s) => s.id === id);
        if (story) {
          set({
            activeStoryId: id,
            nodes: story.nodes,
            edges: story.edges,
            actors: story.actors || [],
            messages: story.messages || [],
            presentationOrder: (story.type === 'workflow' || story.type === undefined)
              ? getPresentationOrder(story.nodes)
              : getMessagePresentationOrder(story.messages || []),
            currentStepIndex: 0,
            isPresentationMode: false,
          });
        } else {
          set({
            activeStoryId: null,
            nodes: [],
            edges: [],
            actors: [],
            messages: [],
            presentationOrder: [],
          });
        }
      },

      duplicateUserStory: (id) => {
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
          nodes: story.nodes.map((n) => ({ ...n })),
          edges: story.edges.map((e) => ({ ...e })),
          actors: (story.actors || []).map((a) => ({ ...a })),
          messages: (story.messages || []).map((m) => ({ ...m })),
        };
        set((state) => ({
          userStories: [...state.userStories, newStory],
        }));
        return newId;
      },

      getActiveStory: () => {
        const { userStories, activeStoryId } = get();
        return userStories.find((s) => s.id === activeStoryId);
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
        get()._saveActiveStory();
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
        get()._saveActiveStory();
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
        get()._saveActiveStory();
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
        get()._saveActiveStory();
      },

      autoLayout: (direction = 'TB') => {
        const { nodes, edges, activeStoryId } = get();
        if (!activeStoryId || nodes.length === 0) return;

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          nodes,
          edges,
          direction
        );

        set({
          nodes: layoutedNodes,
          edges: layoutedEdges,
        });
        get()._saveActiveStory();
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

        // Create edges with mapped IDs
        const newEdges: Edge[] = generatedEdges.map((edge, index) => ({
          id: `e${idMap.get(edge.source)}-${idMap.get(edge.target)}-${index}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
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
        get()._saveActiveStory();
      },

      // Actor CRUD (SSD)
      addActor: (actorData) => {
        const { actors, activeStoryId } = get();
        if (!activeStoryId) return;

        const id = getNextId();
        const maxOrder = actors.length > 0 ? Math.max(...actors.map((a) => a.order)) : 0;
        const newActor: Actor = { ...actorData, id, order: maxOrder + 1 };
        set({ actors: [...actors, newActor] });
        get()._saveActiveStory();
      },

      updateActor: (id, updates) => {
        const newActors = get().actors.map((actor) =>
          actor.id === id ? { ...actor, ...updates } : actor
        );
        set({ actors: newActors });
        get()._saveActiveStory();
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
        get()._saveActiveStory();
      },

      reorderActors: (actorIds) => {
        const { actors } = get();
        const newActors = actorIds.map((id, index) => {
          const actor = actors.find((a) => a.id === id);
          return actor ? { ...actor, order: index + 1 } : null;
        }).filter(Boolean) as Actor[];
        set({ actors: newActors });
        get()._saveActiveStory();
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
        get()._saveActiveStory();
      },

      updateMessage: (id, updates) => {
        const newMessages = get().messages.map((msg) =>
          msg.id === id ? { ...msg, ...updates } : msg
        );
        set({
          messages: newMessages,
          presentationOrder: getMessagePresentationOrder(newMessages),
        });
        get()._saveActiveStory();
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
        get()._saveActiveStory();
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
        get()._saveActiveStory();
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
        get()._saveActiveStory();
      },

      // Presentation
      startPresentation: () => {
        const story = get().getActiveStory();
        if (!story) return;

        // Use story.nodes directly as it's always in sync (persisted in userStories)
        const storyNodes = story.nodes || [];
        const storyMessages = story.messages || [];

        // Compute order from the story's data
        // Default to 'workflow' for legacy stories that don't have a type
        const isWorkflow = story.type === 'workflow' || story.type === undefined;
        const order = isWorkflow
          ? getPresentationOrder(storyNodes)
          : getMessagePresentationOrder(storyMessages);

        // Sync the nodes/edges/messages to state and start presentation
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
        const { activeStoryId, nodes, edges, actors, messages } = get();
        if (!activeStoryId) return;

        set((state) => ({
          userStories: state.userStories.map((story) =>
            story.id === activeStoryId
              ? { ...story, nodes, edges, actors, messages, updatedAt: Date.now() }
              : story
          ),
        }));
      },
    }),
    {
      name: 'user-stories-storage',
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        userStories: state.userStories,
        activeStoryId: state.activeStoryId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure projects exist
          if (!state.projects || state.projects.length === 0) {
            state.projects = [createDefaultProject()];
            state.activeProjectId = DEFAULT_PROJECT_ID;
          }

          // Always migrate stories without projectId to the first available project
          const defaultProjectId = state.activeProjectId || state.projects[0]?.id || DEFAULT_PROJECT_ID;
          const hasStoriesWithoutProject = state.userStories.some((s: UserStory) => !s.projectId);
          if (hasStoriesWithoutProject) {
            state.userStories = state.userStories.map((s: UserStory) => ({
              ...s,
              projectId: s.projectId || defaultProjectId,
            }));
          }

          if (state.activeStoryId) {
            const story = state.userStories.find((s: UserStory) => s.id === state.activeStoryId);
            if (story) {
              state.nodes = story.nodes;
              state.edges = story.edges;
              state.actors = story.actors || [];
              state.messages = story.messages || [];
              state.presentationOrder = (story.type === 'workflow' || story.type === undefined)
                ? getPresentationOrder(story.nodes)
                : getMessagePresentationOrder(story.messages || []);
            }
          }
        }
      },
    }
  )
);
