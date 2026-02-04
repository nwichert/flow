import { useEffect, useMemo } from 'react';
import { Panel, useReactFlow, type Rect } from '@xyflow/react';
import { PlayIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useStoryStore } from '../store/useStoryStore';

function PresentationControlsInner({ isInsideReactFlow }: { isInsideReactFlow: boolean }) {
  const {
    isPresentationMode,
    currentStepIndex,
    presentationOrder,
    nodes,
    edges,
    messages,
    startPresentation,
    stopPresentation,
    nextStep,
    prevStep,
    getActiveStory,
  } = useStoryStore();

  const activeStory = getActiveStory();
  // Default to workflow for legacy stories without a type
  const isWorkflow = activeStory?.type === 'workflow' || activeStory?.type === undefined;

  // Only use ReactFlow hooks if we're inside ReactFlow
  let setCenter: ((x: number, y: number, opts?: { duration?: number; zoom?: number }) => void) | null = null;
  let fitView: ((opts?: { duration?: number }) => void) | null = null;
  let fitBounds: ((bounds: Rect, opts?: { duration?: number; padding?: number }) => void) | null = null;

  if (isInsideReactFlow) {
    try {
      const reactFlow = useReactFlow();
      setCenter = reactFlow.setCenter;
      fitView = reactFlow.fitView;
      fitBounds = reactFlow.fitBounds;
    } catch {
      // Not inside ReactFlow provider
    }
  }

  // Compute effective presentation order - use store's order or compute from nodes
  const effectiveOrder = useMemo(() => {
    if (presentationOrder.length > 0) return presentationOrder;
    if (isWorkflow && nodes.length > 0) {
      return [...nodes]
        .sort((a, b) => (a.data?.order ?? 0) - (b.data?.order ?? 0))
        .map(n => n.id);
    }
    if (!isWorkflow && messages.length > 0) {
      return [...messages]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(m => m.id);
    }
    return [];
  }, [presentationOrder, nodes, messages, isWorkflow]);

  const currentId = effectiveOrder[currentStepIndex];
  const currentNode = isWorkflow ? nodes.find((n) => n.id === currentId) : null;
  const currentMessage = !isWorkflow ? messages.find((m) => m.id === currentId) : null;
  const totalSteps = effectiveOrder.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Auto-focus on current node + connected annotations when step changes (workflow)
  useEffect(() => {
    if (!isPresentationMode || !currentNode) return;

    // Find annotation nodes connected to the current node
    const connectedAnnotationIds = edges
      .filter((e) => e.source === currentNode.id || e.target === currentNode.id)
      .map((e) => (e.source === currentNode.id ? e.target : e.source));

    const connectedAnnotations = nodes.filter(
      (n) => connectedAnnotationIds.includes(n.id) && n.data?.nodeKind === 'annotation'
    );

    // Collect all nodes to fit: current node + its annotations
    const relevantNodes = [currentNode, ...connectedAnnotations];

    // Estimate node dimensions (width x height)
    const getNodeSize = (n: typeof currentNode) =>
      n.data?.nodeKind === 'annotation'
        ? { w: 240, h: 150 }
        : { w: 320, h: 120 };

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of relevantNodes) {
      const { w, h } = getNodeSize(n);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    if (fitBounds && connectedAnnotations.length > 0) {
      fitBounds(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        { duration: 500, padding: 0.3 }
      );
    } else if (setCenter) {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setCenter(cx, cy, { duration: 500, zoom: 1.2 });
    }
  }, [isPresentationMode, currentStepIndex, currentNode, edges, nodes, setCenter, fitBounds]);

  // Keyboard navigation
  useEffect(() => {
    if (!isPresentationMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopPresentation();
        if (fitView) fitView({ duration: 500 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode, nextStep, prevStep, stopPresentation, fitView]);

  const currentLabel = currentNode?.data?.title || currentMessage?.label || '';

  if (!isPresentationMode) {
    // Check if there are items to present (nodes for workflow)
    if (isWorkflow && nodes.length === 0) {
      return null;
    }

    const content = (
      <button
        onClick={startPresentation}
        className="w-12 h-12 flex items-center justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-full text-white shadow-lg transition-colors"
        title="Start Presentation"
      >
        <PlayIcon className="w-5 h-5 ml-0.5" />
      </button>
    );

    // Always return the button wrapped for absolute positioning
    // The parent container should handle the positioning
    return (
      <div className="absolute top-4 right-6 z-10">
        {content}
      </div>
    );
  }

  const controls = (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 px-6 py-3 bg-white/95 backdrop-blur rounded-full shadow-xl border border-slate-200">
        {/* Previous button */}
        <button
          onClick={prevStep}
          disabled={isFirstStep}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous (Left Arrow)"
        >
          <ChevronLeftIcon className="w-6 h-6 text-slate-600" />
        </button>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-4">
          <span className="text-slate-800 font-semibold text-lg">
            {currentStepIndex + 1}
          </span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-400 text-lg">
            {totalSteps}
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {effectiveOrder.map((_, index) => (
            <button
              key={index}
              onClick={() => useStoryStore.getState().goToStep(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStepIndex
                  ? 'bg-[var(--color-primary)] w-4'
                  : index < currentStepIndex
                  ? 'bg-[var(--color-primary)]/50'
                  : 'bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={nextStep}
          disabled={isLastStep}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next (Right Arrow / Space)"
        >
          <ChevronRightIcon className="w-6 h-6 text-slate-600" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200 mx-2" />

        {/* Stop button */}
        <button
          onClick={() => {
            stopPresentation();
            if (fitView) fitView({ duration: 500 });
          }}
          className="p-2 rounded-full hover:bg-red-50 transition-colors"
          title="Exit (Escape)"
        >
          <XMarkIcon className="w-6 h-6 text-red-500" />
        </button>
      </div>

      {/* Current step label */}
      {currentLabel && (
        <div className="mt-3 text-center">
          <span className="px-4 py-1.5 bg-white/90 border border-slate-200 rounded-full text-slate-700 text-sm font-medium shadow-sm">
            {currentLabel}
          </span>
        </div>
      )}
    </div>
  );

  if (isInsideReactFlow) {
    return <Panel position="bottom-center" className="mb-8">{controls}</Panel>;
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      {controls}
    </div>
  );
}

export function PresentationControls() {
  // Try to detect if we're inside ReactFlow
  const activeStory = useStoryStore((s) => s.getActiveStory());
  // Default to workflow for legacy stories without a type
  const isWorkflow = activeStory?.type === 'workflow' || activeStory?.type === undefined;

  return <PresentationControlsInner isInsideReactFlow={isWorkflow} />;
}
