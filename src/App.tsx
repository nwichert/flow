import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import { toPng } from 'html-to-image';

import '@xyflow/react/dist/style.css';

import { useStoryStore } from './store/useStoryStore';
import { StoryNode } from './components/StoryNode';
import { AddNodePanel } from './components/AddNodePanel';
import { PresentationControls } from './components/PresentationControls';
import { UserStorySidebar } from './components/UserStorySidebar';
import { SSDCanvas } from './components/SSDCanvas';
import { useToast } from './components/Toast';
import { useConfirm } from './components/ConfirmDialog';
import { useTheme } from './components/ThemeProvider';
import type { LayoutDirection } from './utils/layout';
import { CameraIcon } from '@heroicons/react/24/solid';

const nodeTypes = {
  storyNode: StoryNode,
};

// Default edge options - using React Flow's default pink color
const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { strokeWidth: 2 },
  reconnectable: true,
};

// Context menu state type
type ContextMenu = {
  id: string;
  top: number;
  left: number;
} | null;

function WorkflowCanvas({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    isPresentationMode,
    currentStepIndex,
    presentationOrder,
    autoLayout,
    deleteNode,
    duplicateNode,
  } = useStoryStore();

  const { fitView } = useReactFlow();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { colors } = useTheme();
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);

  // Compute presentation order from nodes if store's order is empty
  const effectivePresentationOrder = presentationOrder.length > 0
    ? presentationOrder
    : [...nodes].sort((a, b) => (a.data.order || 0) - (b.data.order || 0)).map(n => n.id);

  // Filter edges in presentation mode - only show edges where both nodes are visible
  const visibleEdges = isPresentationMode
    ? edges.filter((edge) => {
        const sourceIndex = effectivePresentationOrder.indexOf(edge.source);
        const targetIndex = effectivePresentationOrder.indexOf(edge.target);
        // Both nodes must be visible (current step or earlier)
        const sourceVisible = sourceIndex !== -1 && sourceIndex <= currentStepIndex;
        const targetVisible = targetIndex !== -1 && targetIndex <= currentStepIndex;
        return sourceVisible && targetVisible;
      })
    : edges;

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleAutoLayout = useCallback((direction: LayoutDirection) => {
    autoLayout(direction);
    // Fit view after layout with a small delay to let nodes settle
    setTimeout(() => fitView({ duration: 500, padding: 0.2 }), 50);
  }, [autoLayout, fitView]);

  const handleScreenshot = useCallback(async () => {
    if (nodes.length === 0) return;

    // First, fit the view to show all nodes
    fitView({ padding: 0.2 });

    // Wait for the view to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the React Flow container
    const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowElement) return;

    try {
      // Capture at 4x resolution for crisp, high-quality image
      const dataUrl = await toPng(reactFlowElement, {
        backgroundColor: '#f8fafc',
        pixelRatio: 4,
        filter: (node) => {
          // Exclude controls, minimap, and other UI elements
          const className = node.className?.toString() || '';
          if (
            className.includes('react-flow__controls') ||
            className.includes('react-flow__minimap') ||
            className.includes('react-flow__panel') ||
            className.includes('react-flow__attribution')
          ) {
            return false;
          }
          return true;
        },
      });

      const link = document.createElement('a');
      link.download = 'workflow.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    }
  }, [nodes, fitView]);

  return (
    <div className="flex-1 relative" style={{ height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={closeContextMenu}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-[#f8fafc]"
        panOnDrag={!isPresentationMode}
        zoomOnScroll={!isPresentationMode}
        nodesDraggable={!isPresentationMode}
        nodesConnectable={!isPresentationMode}
        elementsSelectable={!isPresentationMode}
        edgesFocusable={!isPresentationMode}
        edgesReconnectable={!isPresentationMode}
        snapToGrid
        snapGrid={[20, 20]}
      >
        {!isPresentationMode && (
          <>
            <Controls className="bg-white border-slate-200 rounded-lg shadow-sm [&>button]:bg-white [&>button]:border-slate-200 [&>button]:text-slate-600 [&>button:hover]:bg-slate-50" />
            <MiniMap
              className="bg-white rounded-lg shadow-sm border border-slate-200"
              nodeColor={(node) => {
                const status = node.data?.status;
                switch (status) {
                  case 'done':
                    return colors.primary;
                  case 'in-progress':
                    return colors.primaryLight;
                  default:
                    return colors.primaryMuted;
                }
              }}
            />

            {/* Auto-layout panel */}
            <Panel position="top-center" className="flex gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-200">
                <span className="text-xs text-slate-500 mr-1">Layout:</span>
                <button
                  onClick={() => handleAutoLayout('TB')}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                  title="Top to Bottom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
                <button
                  onClick={() => handleAutoLayout('LR')}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                  title="Left to Right"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  onClick={handleScreenshot}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                  title="Download as Image"
                >
                  <CameraIcon className="w-4 h-4" />
                </button>
              </div>
            </Panel>
          </>
        )}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#91919a" />
        {!isPresentationMode && <AddNodePanel isSidebarOpen={isSidebarOpen} />}
      </ReactFlow>

      {/* Play button - positioned outside ReactFlow for proper absolute positioning */}
      {!isPresentationMode && <PresentationControls />}

      {/* Presentation mode controls */}
      {isPresentationMode && <PresentationControls />}

      {/* Context Menu */}
      {contextMenu && !isPresentationMode && (
        <div
          className="fixed bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[160px]"
          style={{ top: contextMenu.top, left: contextMenu.left }}
        >
          <button
            onClick={() => {
              const node = nodes.find(n => n.id === contextMenu.id);
              duplicateNode(contextMenu.id);
              closeContextMenu();
              showToast(`Duplicated "${node?.data.title || 'node'}"`);
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </button>
          <button
            onClick={async () => {
              const node = nodes.find(n => n.id === contextMenu.id);
              closeContextMenu();
              const confirmed = await confirm({
                title: 'Delete Node',
                message: `Are you sure you want to delete "${node?.data.title || 'this node'}"?`,
                confirmText: 'Delete',
                variant: 'danger',
              });
              if (confirmed) {
                deleteNode(contextMenu.id);
                showToast(`Deleted "${node?.data.title || 'node'}"`);
              }
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function FlowCanvas({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const { activeStoryId, getActiveStory, isPresentationMode } = useStoryStore();
  const activeStory = getActiveStory();

  if (!activeStoryId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-slate-700 font-semibold text-lg mb-2">No Diagram Selected</h3>
          <p className="text-slate-500 text-sm">Select a diagram from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  if (activeStory?.type === 'ssd') {
    return (
      <div className="flex-1 flex flex-col" style={{ height: '100%' }}>
        <SSDCanvas isSidebarOpen={isSidebarOpen} />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkflowCanvas isSidebarOpen={isSidebarOpen} />
    </ReactFlowProvider>
  );
}

function App() {
  const { isPresentationMode } = useStoryStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div style={{ width: '100%', height: '100%' }} className="flex bg-[#f8fafc]">
      {!isPresentationMode && (
        <>
          {/* Sidebar */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isSidebarOpen ? 'w-72' : 'w-0'
            } overflow-hidden`}
          >
            <UserStorySidebar onClose={() => setIsSidebarOpen(false)} />
          </div>

          {/* Toggle button when sidebar is closed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-4 top-4 z-20 p-2 bg-white hover:bg-slate-50 rounded-lg shadow-md border border-slate-200 transition-colors"
              title="Open sidebar"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </>
      )}
      <FlowCanvas isSidebarOpen={isSidebarOpen} />
    </div>
  );
}

export default App;
