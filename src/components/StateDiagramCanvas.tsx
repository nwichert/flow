import { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { CameraIcon, LightBulbIcon } from '@heroicons/react/24/solid';
import { useStoryStore, type DiagramState, type DiagramType } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useTheme } from './ThemeProvider';
import { classifyDiagramType, type DiagramClassification } from '../utils/classifyDiagram';
import { DiagramSuggestionModal } from './DiagramSuggestionModal';

const STATE_WIDTH = 140;
const STATE_HEIGHT = 80;
const INITIAL_SIZE = 30;
const FINAL_SIZE = 40;
const PADDING = 60;
const GAP = 180;

type StateDiagramCanvasProps = {
  isSidebarOpen: boolean;
};

export function StateDiagramCanvas({ isSidebarOpen }: StateDiagramCanvasProps) {
  const {
    states,
    transitions,
    isPresentationMode,
    getActiveStory,
    activeProjectId,
    createUserStory,
    setActiveStory,
    deleteUserStory,
  } = useStoryStore();
  const activeStory = getActiveStory();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { colors } = useTheme();

  const [isAddingState, setIsAddingState] = useState(false);
  const [isAddingTransition, setIsAddingTransition] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [classification, setClassification] = useState<DiagramClassification | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  const [newStateName, setNewStateName] = useState('');
  const [newStateType, setNewStateType] = useState<DiagramState['type']>('normal');
  const [newStateDescription, setNewStateDescription] = useState('');

  const [newTransition, setNewTransition] = useState({
    fromStateId: '',
    toStateId: '',
    trigger: '',
    guard: '',
    action: '',
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleScreenshot = useCallback(async () => {
    if (!canvasRef.current || states.length === 0) return;

    try {
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: '#f8fafc',
        pixelRatio: 4,
      });

      const link = document.createElement('a');
      link.download = 'state-diagram.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    }
  }, [states.length]);

  const handleReEvaluate = useCallback(async () => {
    // Build description from diagram content if none exists
    let descriptionToEvaluate = activeStory?.description || '';

    if (!descriptionToEvaluate && (states.length > 0 || transitions.length > 0)) {
      // Generate description from states and transitions
      const stateNames = states.map(s => `${s.name}${s.type !== 'normal' ? ` (${s.type})` : ''}`).join(', ');
      const transitionDescriptions = transitions.map(t => {
        const fromState = states.find(s => s.id === t.fromStateId)?.name || 'Unknown';
        const toState = states.find(s => s.id === t.toStateId)?.name || 'Unknown';
        return `${fromState} -> ${toState}${t.trigger ? ` [${t.trigger}]` : ''}`;
      }).join('; ');
      descriptionToEvaluate = `State diagram with states: ${stateNames}. Transitions: ${transitionDescriptions}`;
    }

    if (!descriptionToEvaluate) {
      showToast('Add some states or transitions to the diagram first', 'warning');
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await classifyDiagramType(descriptionToEvaluate, 'state-diagram');

      if (result.recommendedType !== 'state-diagram') {
        setClassification(result);
        setShowSuggestionModal(true);
      } else {
        showToast('This state diagram type is the best fit for your content');
      }
    } catch (err) {
      showToast('Failed to evaluate diagram type', 'error');
    } finally {
      setIsEvaluating(false);
    }
  }, [activeStory, states, transitions, showToast]);

  const handleAcceptSuggestion = async (suggestedType: DiagramType) => {
    setShowSuggestionModal(false);

    if (!activeProjectId || !activeStory) return;

    const confirmed = await confirm({
      title: 'Switch Diagram Type',
      message: `This will create a new ${suggestedType} diagram and delete the current state diagram. Continue?`,
      confirmText: 'Switch',
      variant: 'danger',
    });

    if (confirmed) {
      const newId = await createUserStory(activeStory.name, suggestedType, activeStory.description);
      const oldId = activeStory.id;
      setActiveStory(newId);
      await deleteUserStory(oldId);
      showToast(`Switched to ${suggestedType} diagram`);
    }
  };

  const handleKeepOriginal = () => {
    setShowSuggestionModal(false);
    showToast('Keeping current state diagram');
  };

  const sortedStates = [...states].sort((a, b) => a.order - b.order);

  // Calculate positions for states in a flow layout
  const getStatePosition = (index: number) => {
    const cols = Math.ceil(Math.sqrt(states.length));
    const row = Math.floor(index / cols);
    const col = index % cols;

    return {
      x: PADDING + col * GAP,
      y: PADDING + row * (STATE_HEIGHT + 100),
    };
  };

  // Canvas dimensions
  const cols = Math.ceil(Math.sqrt(states.length)) || 1;
  const rows = Math.ceil(states.length / cols) || 1;
  const canvasWidth = Math.max(800, PADDING * 2 + cols * GAP);
  const canvasHeight = Math.max(500, PADDING * 2 + rows * (STATE_HEIGHT + 100));

  const handleAddState = () => {
    if (!newStateName.trim()) return;
    useStoryStore.getState().addState?.({
      name: newStateName,
      description: newStateDescription,
      type: newStateType,
    });
    showToast(`Added state "${newStateName}"`);
    setNewStateName('');
    setNewStateDescription('');
    setNewStateType('normal');
    setIsAddingState(false);
  };

  const handleAddTransition = () => {
    if (!newTransition.fromStateId || !newTransition.toStateId || !newTransition.trigger.trim()) return;
    useStoryStore.getState().addTransition?.({
      fromStateId: newTransition.fromStateId,
      toStateId: newTransition.toStateId,
      trigger: newTransition.trigger,
      guard: newTransition.guard || undefined,
      action: newTransition.action || undefined,
    });
    showToast(`Added transition "${newTransition.trigger}"`);
    setNewTransition({ fromStateId: '', toStateId: '', trigger: '', guard: '', action: '' });
    setIsAddingTransition(false);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Toolbar */}
      {!isPresentationMode && (
        <div className={`flex-shrink-0 flex items-center gap-2 p-3 border-b border-slate-200 bg-white ${!isSidebarOpen ? 'pl-16' : ''}`}>
          <button
            onClick={() => setIsAddingState(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-white font-medium shadow-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add State
          </button>
          <button
            onClick={() => setIsAddingTransition(true)}
            disabled={states.length < 1}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-faded)] rounded-lg text-[var(--color-primary)] font-medium shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Transition
          </button>
          <div className="w-px h-8 bg-slate-300 mx-1" />
          <button
            onClick={handleScreenshot}
            disabled={states.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download as Image"
          >
            <CameraIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleReEvaluate}
            disabled={isEvaluating}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-yellow-500 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Re-evaluate diagram type"
          >
            {isEvaluating ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <LightBulbIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-[#f8fafc]">
        <div
          ref={canvasRef}
          className="relative"
          style={{ width: canvasWidth, height: canvasHeight, minWidth: '100%', minHeight: '100%' }}
        >
          {/* Dots background */}
          <svg className="absolute inset-0" width="100%" height="100%">
            <defs>
              <pattern id="state-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.5" fill="#91919a" />
              </pattern>
              <marker
                id="state-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.primary} />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#state-dots)" />

            {/* Transition arrows */}
            {transitions.map((transition) => {
              const fromIndex = sortedStates.findIndex(s => s.id === transition.fromStateId);
              const toIndex = sortedStates.findIndex(s => s.id === transition.toStateId);
              if (fromIndex === -1 || toIndex === -1) return null;

              const fromPos = getStatePosition(fromIndex);
              const toPos = getStatePosition(toIndex);

              const fromState = sortedStates[fromIndex];
              const toState = sortedStates[toIndex];

              // Calculate center points
              const fromCenterX = fromPos.x + (fromState.type === 'initial' ? INITIAL_SIZE / 2 : STATE_WIDTH / 2);
              const fromCenterY = fromPos.y + (fromState.type === 'initial' ? INITIAL_SIZE / 2 : STATE_HEIGHT / 2);
              const toCenterX = toPos.x + (toState.type === 'initial' ? INITIAL_SIZE / 2 : STATE_WIDTH / 2);
              const toCenterY = toPos.y + (toState.type === 'initial' ? INITIAL_SIZE / 2 : STATE_HEIGHT / 2);

              // Calculate control point for curved line
              const midX = (fromCenterX + toCenterX) / 2;
              const midY = (fromCenterY + toCenterY) / 2;
              const dx = toCenterX - fromCenterX;
              const dy = toCenterY - fromCenterY;
              const curvature = 30;
              const controlX = midX - dy * curvature / Math.sqrt(dx * dx + dy * dy || 1);
              const controlY = midY + dx * curvature / Math.sqrt(dx * dx + dy * dy || 1);

              return (
                <g key={transition.id}>
                  <path
                    d={`M ${fromCenterX} ${fromCenterY} Q ${controlX} ${controlY} ${toCenterX} ${toCenterY}`}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth={2}
                    markerEnd="url(#state-arrow)"
                  />
                  {/* Transition label */}
                  <text
                    x={controlX}
                    y={controlY - 10}
                    textAnchor="middle"
                    className="text-xs fill-slate-600 font-medium"
                  >
                    {transition.trigger}
                    {transition.guard && ` [${transition.guard}]`}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* State nodes */}
          {sortedStates.map((state, index) => {
            const pos = getStatePosition(index);
            const isSelected = selectedId === `state-${state.id}`;

            if (state.type === 'initial') {
              return (
                <div
                  key={state.id}
                  className={`absolute cursor-pointer transition-all ${isSelected ? 'ring-2 ring-violet-400' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: INITIAL_SIZE,
                    height: INITIAL_SIZE,
                  }}
                  onClick={() => setSelectedId(isSelected ? null : `state-${state.id}`)}
                >
                  <div
                    className="w-full h-full rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-600 whitespace-nowrap">
                    {state.name}
                  </span>
                </div>
              );
            }

            if (state.type === 'final') {
              return (
                <div
                  key={state.id}
                  className={`absolute cursor-pointer transition-all ${isSelected ? 'ring-2 ring-violet-400' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: FINAL_SIZE,
                    height: FINAL_SIZE,
                  }}
                  onClick={() => setSelectedId(isSelected ? null : `state-${state.id}`)}
                >
                  <div
                    className="w-full h-full rounded-full border-4 flex items-center justify-center"
                    style={{ borderColor: colors.primary }}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-600 whitespace-nowrap">
                    {state.name}
                  </span>
                </div>
              );
            }

            // Normal state - rounded rectangle
            return (
              <div
                key={state.id}
                className={`absolute cursor-pointer transition-all group ${isSelected ? 'ring-2 ring-violet-400' : ''}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: STATE_WIDTH,
                  height: STATE_HEIGHT,
                }}
                onClick={() => setSelectedId(isSelected ? null : `state-${state.id}`)}
              >
                <div
                  className="w-full h-full rounded-xl border-2 bg-white shadow-sm flex flex-col items-center justify-center p-2"
                  style={{ borderColor: colors.primary }}
                >
                  <span className="font-semibold text-slate-800 text-sm text-center">{state.name}</span>
                  {state.description && (
                    <span className="text-xs text-slate-500 text-center mt-1 line-clamp-2">{state.description}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {states.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-3xl">🔄</span>
                </div>
                <h3 className="text-slate-700 font-semibold text-lg mb-2">No States Yet</h3>
                <p className="text-slate-500 text-sm">Add states to visualize your state machine</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add State Modal */}
      {isAddingState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[400px] shadow-xl">
            <h3 className="text-slate-800 font-semibold text-lg mb-4">Add State</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-600 text-sm mb-1">State Name</label>
                <input
                  type="text"
                  value={newStateName}
                  onChange={(e) => setNewStateName(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  placeholder="e.g., Pending"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Type</label>
                <div className="flex gap-2">
                  {(['initial', 'normal', 'final'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewStateType(type)}
                      className={`
                        flex-1 px-3 py-2 rounded text-sm font-medium border transition-all
                        ${newStateType === type
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}
                      `}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newStateDescription}
                  onChange={(e) => setNewStateDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  placeholder="e.g., Awaiting approval"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddState}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Add State
                </button>
                <button
                  onClick={() => { setIsAddingState(false); setNewStateName(''); setNewStateDescription(''); }}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Transition Modal */}
      {isAddingTransition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[420px] shadow-xl">
            <h3 className="text-slate-800 font-semibold text-lg mb-4">Add Transition</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 text-sm mb-1">From State</label>
                  <select
                    value={newTransition.fromStateId}
                    onChange={(e) => setNewTransition({ ...newTransition, fromStateId: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {sortedStates.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">To State</label>
                  <select
                    value={newTransition.toStateId}
                    onChange={(e) => setNewTransition({ ...newTransition, toStateId: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {sortedStates.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Trigger Event</label>
                <input
                  type="text"
                  value={newTransition.trigger}
                  onChange={(e) => setNewTransition({ ...newTransition, trigger: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  placeholder="e.g., submit, approve, cancel"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Guard Condition (optional)</label>
                <input
                  type="text"
                  value={newTransition.guard}
                  onChange={(e) => setNewTransition({ ...newTransition, guard: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  placeholder="e.g., isValid, amount > 0"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddTransition}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Add Transition
                </button>
                <button
                  onClick={() => { setIsAddingTransition(false); setNewTransition({ fromStateId: '', toStateId: '', trigger: '', guard: '', action: '' }); }}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Re-evaluate Suggestion Modal */}
      {classification && (
        <DiagramSuggestionModal
          isOpen={showSuggestionModal}
          onClose={() => setShowSuggestionModal(false)}
          classification={classification}
          requestedType="state-diagram"
          onAcceptSuggestion={handleAcceptSuggestion}
          onKeepOriginal={handleKeepOriginal}
        />
      )}
    </div>
  );
}
