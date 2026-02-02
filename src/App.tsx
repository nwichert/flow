import { useState, useCallback, useEffect } from 'react';
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

import { useStoryStore, type DiagramType } from './store/useStoryStore';
import { StoryNode } from './components/StoryNode';
import { AnnotationNode } from './components/AnnotationNode';
import { AddNodePanel } from './components/AddNodePanel';
import { PresentationControls } from './components/PresentationControls';
import { UserStorySidebar } from './components/UserStorySidebar';
import { SSDCanvas } from './components/SSDCanvas';
import { StateDiagramCanvas } from './components/StateDiagramCanvas';
import { ERDCanvas } from './components/ERDCanvas';
import { useToast } from './components/Toast';
import { useConfirm } from './components/ConfirmDialog';
import { useTheme } from './components/ThemeProvider';
import { useUrlSync } from './hooks/useUrlSync';
import type { LayoutDirection } from './utils/layout';
import { CameraIcon, DocumentTextIcon, LightBulbIcon } from '@heroicons/react/24/solid';
import { SummaryModal } from './components/SummaryModal';
import { classifyDiagramType, type DiagramClassification } from './utils/classifyDiagram';
import { DiagramSuggestionModal } from './components/DiagramSuggestionModal';

const nodeTypes = {
  storyNode: StoryNode,
  annotationNode: AnnotationNode,
};

// Default edge options
const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { strokeWidth: 2, stroke: '#ff0071' },
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
    getActiveStory,
    saveDiagramSummary,
    activeProjectId,
    createUserStory,
    setActiveStory,
    deleteUserStory,
    updateEdgeTypes,
  } = useStoryStore();

  const activeStory = getActiveStory();
  const { fitView } = useReactFlow();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { colors } = useTheme();
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [classification, setClassification] = useState<DiagramClassification | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Compute presentation order from nodes if store's order is empty
  const effectivePresentationOrder = presentationOrder.length > 0
    ? presentationOrder
    : [...nodes].sort((a, b) => (a.data.order || 0) - (b.data.order || 0)).map(n => n.id);

  // Filter edges in presentation mode - only show edges where both nodes are visible
  const visibleEdges = isPresentationMode
    ? edges.filter((edge) => {
        // Annotation edges are always visible in presentation mode
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        const isAnnotationEdge =
          sourceNode?.data?.nodeKind === 'annotation' ||
          targetNode?.data?.nodeKind === 'annotation';

        if (isAnnotationEdge) {
          // Show annotation edge if the non-annotation endpoint is visible
          const otherNode = sourceNode?.data?.nodeKind === 'annotation' ? targetNode : sourceNode;
          if (otherNode?.data?.nodeKind === 'annotation') return true; // both annotations
          const otherIndex = effectivePresentationOrder.indexOf(otherNode?.id || '');
          return otherIndex !== -1 && otherIndex <= currentStepIndex;
        }

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

  const handleAutoLayout = useCallback(async (direction: LayoutDirection) => {
    await autoLayout(direction);
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

  // Align selected nodes vertically (same X position)
  const handleAlignVertical = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);

    if (selectedNodes.length < 2) {
      showToast('Select 2 or more nodes to align (Cmd/Ctrl + click)', 'warning');
      return;
    }

    // Use the average X position of selected nodes
    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;

    // Create position change events for onNodesChange
    const changes = selectedNodes.map(node => ({
      type: 'position' as const,
      id: node.id,
      position: { x: avgX, y: node.position.y },
    }));

    onNodesChange(changes);

    // Find edges that connect the selected nodes and make them straight
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const edgesToStraighten = edges
      .filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
      .map(e => e.id);

    if (edgesToStraighten.length > 0) {
      updateEdgeTypes(edgesToStraighten, 'straight');
    }

    showToast(`Aligned ${selectedNodes.length} nodes vertically`);
  }, [nodes, edges, onNodesChange, updateEdgeTypes, showToast]);

  // Align selected nodes horizontally (same Y position)
  const handleAlignHorizontal = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);

    if (selectedNodes.length < 2) {
      showToast('Select 2 or more nodes to align (Cmd/Ctrl + click)', 'warning');
      return;
    }

    // Use the average Y position of selected nodes
    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

    // Create position change events for onNodesChange
    const changes = selectedNodes.map(node => ({
      type: 'position' as const,
      id: node.id,
      position: { x: node.position.x, y: avgY },
    }));

    onNodesChange(changes);

    // Find edges that connect the selected nodes and make them straight
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const edgesToStraighten = edges
      .filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
      .map(e => e.id);

    if (edgesToStraighten.length > 0) {
      updateEdgeTypes(edgesToStraighten, 'straight');
    }

    showToast(`Aligned ${selectedNodes.length} nodes horizontally`);
  }, [nodes, edges, onNodesChange, updateEdgeTypes, showToast]);

  const handleReEvaluate = useCallback(async () => {
    // Build description from diagram content if none exists
    let descriptionToEvaluate = activeStory?.description || '';

    if (!descriptionToEvaluate && nodes.length > 0) {
      // Generate description from node titles and descriptions
      const nodeDescriptions = nodes.map(n => `${n.data.title}: ${n.data.description || ''}`).join('. ');
      descriptionToEvaluate = `Workflow with steps: ${nodeDescriptions}`;
    }

    if (!descriptionToEvaluate) {
      showToast('Add some nodes to the diagram first', 'warning');
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await classifyDiagramType(descriptionToEvaluate, 'workflow');

      if (result.recommendedType !== 'workflow') {
        setClassification(result);
        setShowSuggestionModal(true);
      } else {
        showToast('This workflow diagram type is the best fit for your content');
      }
    } catch (err) {
      showToast('Failed to evaluate diagram type', 'error');
    } finally {
      setIsEvaluating(false);
    }
  }, [activeStory, nodes, showToast]);

  const handleAcceptSuggestion = async (suggestedType: DiagramType) => {
    setShowSuggestionModal(false);

    if (!activeProjectId || !activeStory) return;

    const confirmed = await confirm({
      title: 'Switch Diagram Type',
      message: `This will create a new ${suggestedType} diagram and delete the current workflow. Continue?`,
      confirmText: 'Switch',
      variant: 'danger',
    });

    if (confirmed) {
      // Create a new diagram of the suggested type
      const newId = await createUserStory(activeStory.name, suggestedType, activeStory.description);
      const oldId = activeStory.id;
      setActiveStory(newId);
      await deleteUserStory(oldId);
      showToast(`Switched to ${suggestedType} diagram`);
    }
  };

  const handleKeepOriginal = () => {
    setShowSuggestionModal(false);
    showToast('Keeping current workflow diagram');
  };

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
                if (node.data?.nodeKind === 'annotation') {
                  return colors.primaryFaded;
                }
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
                <span className="text-xs text-slate-500 mr-1">Align:</span>
                <button
                  onClick={handleAlignVertical}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                  title="Align selected nodes vertically (Cmd/Ctrl + click to select)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m-6-4h12M6 8h12" />
                  </svg>
                </button>
                <button
                  onClick={handleAlignHorizontal}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                  title="Align selected nodes horizontally (Cmd/Ctrl + click to select)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M8 6v12m8-12v12" />
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
                <button
                  onClick={() => setIsSummaryOpen(true)}
                  disabled={nodes.length === 0}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate Summary"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  onClick={handleReEvaluate}
                  disabled={isEvaluating}
                  className="p-1.5 hover:bg-slate-100 rounded text-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Re-evaluate diagram type"
                >
                  {isEvaluating ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <LightBulbIcon className="w-4 h-4" />
                  )}
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

      {/* Summary Modal */}
      {activeStory && (
        <SummaryModal
          isOpen={isSummaryOpen}
          onClose={() => setIsSummaryOpen(false)}
          diagramData={{
            type: 'workflow',
            name: activeStory.name,
            description: activeStory.description,
            nodes,
          }}
          initialSummary={activeStory.summary}
          onSummaryGenerated={saveDiagramSummary}
        />
      )}

      {/* Re-evaluate Suggestion Modal */}
      {classification && (
        <DiagramSuggestionModal
          isOpen={showSuggestionModal}
          onClose={() => setShowSuggestionModal(false)}
          classification={classification}
          requestedType="workflow"
          onAcceptSuggestion={handleAcceptSuggestion}
          onKeepOriginal={handleKeepOriginal}
        />
      )}
    </div>
  );
}

function FlowCanvas({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const { activeStoryId, getActiveStory } = useStoryStore();
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
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100%' }}>
        <SSDCanvas isSidebarOpen={isSidebarOpen} />
      </div>
    );
  }

  if (activeStory?.type === 'state-diagram') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100%' }}>
        <StateDiagramCanvas isSidebarOpen={isSidebarOpen} />
      </div>
    );
  }

  if (activeStory?.type === 'erd') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100%' }}>
        <ERDCanvas isSidebarOpen={isSidebarOpen} />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkflowCanvas isSidebarOpen={isSidebarOpen} />
    </ReactFlowProvider>
  );
}

function AppContent() {
  const { isPresentationMode, isLoading, initializeStore } = useStoryStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(288); // w-72 = 18rem = 288px
  const [isResizing, setIsResizing] = useState(false);
  const { colors } = useTheme();

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 200), 500); // Min 200px, max 500px
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Initialize store from Firestore
  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  // Sync URL with active diagram
  useUrlSync();

  // Show loading state
  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100%' }} className="flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: colors.primary, borderTopColor: 'transparent' }}
          />
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }} className="flex bg-[#f8fafc]">
      {!isPresentationMode && (
        <>
          {/* Sidebar */}
          <div
            className={`relative flex-shrink-0 ${
              isSidebarOpen ? '' : 'w-0'
            } overflow-hidden ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`}
            style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
          >
            <UserStorySidebar onClose={() => setIsSidebarOpen(false)} />

            {/* Resize handle */}
            {isSidebarOpen && (
              <div
                onMouseDown={handleMouseDown}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-slate-300 active:bg-slate-400 transition-colors z-10"
                title="Drag to resize"
              />
            )}
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

function App() {
  return <AppContent />;
}

export default App;
