import { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { CameraIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { useStoryStore, type Actor, type SSDMessage } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useTheme } from './ThemeProvider';
import { AISSDGenerator } from './AISSDGenerator';

const LANE_WIDTH = 120;
const LANE_GAP = 80;
const HEADER_HEIGHT = 60;
const MESSAGE_HEIGHT = 80;
const MESSAGE_BOX_HEIGHT = 50;
const PADDING = 60;
const LIFELINE_START = HEADER_HEIGHT + 20;

type SSDCanvasProps = {
  isSidebarOpen: boolean;
};

export function SSDCanvas({ isSidebarOpen }: SSDCanvasProps) {
  const {
    actors,
    messages,
    addActor,
    updateActor,
    deleteActor,
    addMessage,
    updateMessage,
    deleteMessage,
    isPresentationMode,
    currentStepIndex,
    presentationOrder,
  } = useStoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { colors } = useTheme();

  // Actor colors based on theme
  const actorColors: Record<Actor['type'], string> = {
    user: colors.primary,
    system: colors.primaryLight,
    external: colors.primaryMuted,
  };

  const [isAddingActor, setIsAddingActor] = useState(false);
  const [isAddingMessage, setIsAddingMessage] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [editingActorId, setEditingActorId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [newActorName, setNewActorName] = useState('');
  const [newActorType, setNewActorType] = useState<Actor['type']>('system');

  const [newMessage, setNewMessage] = useState({
    fromActorId: '',
    toActorId: '',
    label: '',
    description: '',
    type: 'sync' as SSDMessage['type'],
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleScreenshot = useCallback(async () => {
    if (!canvasRef.current || actors.length === 0) return;

    try {
      // Capture at 4x resolution for crisp, high-quality image
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: '#f8fafc',
        pixelRatio: 4,
      });

      const link = document.createElement('a');
      link.download = 'sequence-diagram.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    }
  }, [actors.length]);

  const sortedActors = [...actors].sort((a, b) => a.order - b.order);
  const sortedMessages = [...messages].sort((a, b) => a.order - b.order);

  const getActorX = (actorId: string) => {
    const index = sortedActors.findIndex(a => a.id === actorId);
    return PADDING + index * (LANE_WIDTH + LANE_GAP) + LANE_WIDTH / 2;
  };

  const canvasWidth = Math.max(900, PADDING * 2 + actors.length * (LANE_WIDTH + LANE_GAP));
  const canvasHeight = Math.max(600, PADDING + HEADER_HEIGHT + 60 + messages.length * MESSAGE_HEIGHT + 150);

  const handleAddActor = () => {
    if (!newActorName.trim()) return;
    addActor({ name: newActorName, type: newActorType });
    showToast(`Added actor "${newActorName}"`);
    setNewActorName('');
    setNewActorType('system');
    setIsAddingActor(false);
  };

  const handleAddMessage = () => {
    if (!newMessage.label.trim() || !newMessage.fromActorId) return;
    // For standalone actions, toActorId can be empty or same as fromActorId
    const finalMessage = {
      ...newMessage,
      toActorId: newMessage.toActorId || newMessage.fromActorId,
    };
    addMessage(finalMessage);
    showToast(`Added message "${newMessage.label}"`);
    setNewMessage({ fromActorId: '', toActorId: '', label: '', description: '', type: 'sync' });
    setIsAddingMessage(false);
  };

  // Calculate which actors have activation bars at each message level
  const getActivationBars = () => {
    const bars: { actorId: string; startIndex: number; endIndex: number }[] = [];
    const activeActors = new Map<string, number>(); // actorId -> startIndex

    sortedMessages.forEach((msg, index) => {
      const fromId = msg.fromActorId;
      const toId = msg.toActorId;
      const isSelfMessage = fromId === toId;
      const isReturn = msg.type === 'return';

      if (!isReturn) {
        // Start activation on target actor
        if (!activeActors.has(toId)) {
          activeActors.set(toId, index);
        }
      } else {
        // End activation on source actor (the one returning)
        if (activeActors.has(fromId)) {
          bars.push({
            actorId: fromId,
            startIndex: activeActors.get(fromId)!,
            endIndex: index,
          });
          activeActors.delete(fromId);
        }
      }

      // For self-messages, create a small activation bar
      if (isSelfMessage && !isReturn) {
        bars.push({
          actorId: fromId,
          startIndex: index,
          endIndex: index,
        });
      }
    });

    // Close any remaining activations
    activeActors.forEach((startIndex, actorId) => {
      bars.push({
        actorId,
        startIndex,
        endIndex: sortedMessages.length - 1,
      });
    });

    return bars;
  };

  const activationBars = getActivationBars();

  return (
    <div className="flex-1 h-full flex flex-col bg-[#f8fafc]">
      {/* Toolbar */}
      {!isPresentationMode && (
        <div className={`flex items-center gap-2 p-3 border-b border-slate-200 bg-white ${!isSidebarOpen ? 'pl-16' : ''}`}>
          <button
            onClick={() => setIsAddingActor(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-white font-medium shadow-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Actor
          </button>
          <button
            onClick={() => setIsAddingMessage(true)}
            disabled={actors.length < 1}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-faded)] rounded-lg text-[var(--color-primary)] font-medium shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Message
          </button>
          <button
            onClick={() => setIsAIOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-faded)] rounded-lg text-[var(--color-primary)] font-medium shadow-lg transition-colors"
            title="Generate with AI"
          >
            <SparklesIcon className="w-5 h-5" />
            AI Generate
          </button>
          <div className="w-px h-8 bg-slate-300 mx-1" />
          <button
            onClick={handleScreenshot}
            disabled={actors.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download as Image"
          >
            <CameraIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-[#f8fafc]">
        <div
          ref={canvasRef}
          className="relative"
          style={{ width: canvasWidth, height: canvasHeight, minWidth: '100%', minHeight: '100%' }}
          onClick={(e) => {
            // Clear selection when clicking on canvas background
            if (e.target === e.currentTarget) {
              setSelectedId(null);
            }
          }}
        >
          {/* Dots pattern background - matching React Flow default */}
          <svg className="absolute inset-0" width="100%" height="100%">
            <defs>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.5" fill="#91919a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {/* Actor headers */}
          {sortedActors.map((actor, index) => {
            const centerX = PADDING + index * (LANE_WIDTH + LANE_GAP) + LANE_WIDTH / 2;
            const color = actorColors[actor.type];
            const isSelected = selectedId === `actor-${actor.id}`;

            return (
              <div
                key={actor.id}
                className="absolute flex flex-col items-center group cursor-pointer"
                style={{ left: centerX, top: PADDING, transform: 'translateX(-50%)' }}
                onClick={() => setSelectedId(isSelected ? null : `actor-${actor.id}`)}
              >
                {/* Colored indicator bar */}
                <div
                  className="w-12 h-1 rounded-full mb-2"
                  style={{ backgroundColor: color }}
                />
                {/* Actor name */}
                <span className="text-slate-700 font-medium text-sm text-center whitespace-nowrap">{actor.name}</span>
                {/* Edit/delete buttons - show on hover or when selected */}
                {!isPresentationMode && (
                  <div className={`flex gap-1 mt-1 transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingActorId(actor.id); }}
                      className="p-1 hover:bg-slate-200 rounded bg-white shadow-sm border border-slate-200"
                      title="Edit"
                    >
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {actors.length > 1 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmed = await confirm({
                            title: 'Delete Actor',
                            message: `Are you sure you want to delete "${actor.name}" and all related messages?`,
                            confirmText: 'Delete',
                            variant: 'danger',
                          });
                          if (confirmed) {
                            deleteActor(actor.id);
                            setSelectedId(null);
                            showToast(`Deleted actor "${actor.name}"`);
                          }
                        }}
                        className="p-1 hover:bg-slate-200 rounded bg-white shadow-sm border border-slate-200"
                        title="Delete"
                      >
                        <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* SVG for lifelines, activation bars, and arrows */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: canvasWidth, height: canvasHeight }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
              <marker id="arrowhead-left" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
                <polygon points="10 0, 0 3.5, 10 7" fill="#64748b" />
              </marker>
            </defs>

            {/* Vertical lifelines (dashed) */}
            {sortedActors.map((actor) => {
              const x = getActorX(actor.id);
              return (
                <line
                  key={`lifeline-${actor.id}`}
                  x1={x}
                  y1={PADDING + LIFELINE_START}
                  x2={x}
                  y2={canvasHeight - 40}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeDasharray="6,4"
                />
              );
            })}

            {/* Activation bars */}
            {activationBars.map((bar, idx) => {
              const x = getActorX(bar.actorId);
              const actor = sortedActors.find(a => a.id === bar.actorId);
              const color = actor ? actorColors[actor.type] : '#3b82f6';
              const startY = PADDING + LIFELINE_START + 20 + bar.startIndex * MESSAGE_HEIGHT;
              const endY = PADDING + LIFELINE_START + 20 + (bar.endIndex + 1) * MESSAGE_HEIGHT - 30;

              return (
                <rect
                  key={`activation-${idx}`}
                  x={x - 4}
                  y={startY}
                  width={8}
                  height={Math.max(endY - startY, MESSAGE_BOX_HEIGHT)}
                  fill={color}
                  rx={2}
                />
              );
            })}

            {/* Message arrows */}
            {sortedMessages.map((message, index) => {
              const isVisible = !isPresentationMode ||
                presentationOrder.indexOf(message.id) <= currentStepIndex;

              if (!isVisible) return null;

              const fromX = getActorX(message.fromActorId);
              const toX = getActorX(message.toActorId);
              const y = PADDING + LIFELINE_START + 40 + index * MESSAGE_HEIGHT;
              const isSelfMessage = message.fromActorId === message.toActorId;
              const isReturn = message.type === 'return';

              if (isSelfMessage) {
                // Self-message: loop arrow
                const loopWidth = 40;
                const loopHeight = 30;
                return (
                  <g key={`arrow-${message.id}`}>
                    <path
                      d={`M ${fromX + 4} ${y}
                          L ${fromX + loopWidth} ${y}
                          L ${fromX + loopWidth} ${y + loopHeight}
                          L ${fromX + 4} ${y + loopHeight}`}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      markerEnd="url(#arrowhead-left)"
                    />
                  </g>
                );
              }

              const isLeftToRight = fromX < toX;
              const startX = isLeftToRight ? fromX + 4 : fromX - 4;
              const endX = isLeftToRight ? toX - 4 : toX + 4;

              return (
                <g key={`arrow-${message.id}`}>
                  <line
                    x1={startX}
                    y1={y + MESSAGE_BOX_HEIGHT / 2}
                    x2={endX}
                    y2={y + MESSAGE_BOX_HEIGHT / 2}
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray={isReturn ? "6,3" : ""}
                    markerEnd={isLeftToRight ? "url(#arrowhead)" : "url(#arrowhead-left)"}
                  />
                </g>
              );
            })}
          </svg>

          {/* Message boxes */}
          {sortedMessages.map((message, index) => {
            const isVisible = !isPresentationMode ||
              presentationOrder.indexOf(message.id) <= currentStepIndex;
            const isActive = isPresentationMode &&
              presentationOrder[currentStepIndex] === message.id;
            const isDimmed = isPresentationMode &&
              presentationOrder.indexOf(message.id) < currentStepIndex;
            const isSelected = selectedId === `message-${message.id}`;

            if (!isVisible) return null;

            const fromX = getActorX(message.fromActorId);
            const toX = getActorX(message.toActorId);
            const y = PADDING + LIFELINE_START + 40 + index * MESSAGE_HEIGHT;
            const isSelfMessage = message.fromActorId === message.toActorId;

            // Calculate box position and width
            let boxLeft: number;
            let boxWidth: number;

            if (isSelfMessage) {
              // Self-message: box to the right of the lifeline
              boxLeft = fromX + 50;
              boxWidth = 100;
            } else {
              // Regular message: box between the two lifelines
              const minX = Math.min(fromX, toX);
              const maxX = Math.max(fromX, toX);
              boxLeft = minX + 20;
              boxWidth = maxX - minX - 40;
            }

            return (
              <div
                key={`box-${message.id}`}
                className={`absolute transition-all duration-300 group cursor-pointer ${isDimmed ? 'opacity-50' : ''}`}
                style={{
                  left: boxLeft,
                  top: y,
                  width: Math.max(boxWidth, 80),
                }}
                onClick={() => !isPresentationMode && setSelectedId(isSelected ? null : `message-${message.id}`)}
              >
                <div
                  className={`
                    bg-white border rounded-lg px-3 py-2 shadow-sm transition-all
                    ${isActive ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-300'}
                    ${isSelected && !isPresentationMode ? 'ring-2 ring-violet-200 border-violet-400' : ''}
                    ${!isPresentationMode ? 'hover:border-slate-400' : ''}
                  `}
                >
                  <p className="text-slate-700 text-sm text-center leading-tight">
                    {message.label}
                  </p>
                </div>

                {/* Edit/delete buttons - show on hover or when selected */}
                {!isPresentationMode && (
                  <div className={`absolute -right-7 top-1/2 -translate-y-1/2 flex flex-col gap-1 transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingMessageId(message.id); }}
                      className="p-1 bg-white hover:bg-slate-100 rounded shadow-sm border border-slate-200"
                      title="Edit"
                    >
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = await confirm({
                          title: 'Delete Message',
                          message: `Are you sure you want to delete "${message.label}"?`,
                          confirmText: 'Delete',
                          variant: 'danger',
                        });
                        if (confirmed) {
                          deleteMessage(message.id);
                          setSelectedId(null);
                          showToast(`Deleted message "${message.label}"`);
                        }
                      }}
                      className="p-1 bg-white hover:bg-slate-100 rounded shadow-sm border border-slate-200"
                      title="Delete"
                    >
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Actor Modal */}
      {isAddingActor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h3 className="text-slate-800 font-semibold text-lg mb-4">Add Actor</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-600 text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={newActorName}
                  onChange={(e) => setNewActorName(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="e.g., Client, Server, Stripe API"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Type</label>
                <div className="flex gap-2">
                  {(['user', 'system', 'external'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewActorType(type)}
                      className={`
                        flex-1 px-3 py-2 rounded text-sm font-medium border transition-all
                        ${newActorType === type
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}
                      `}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: actorColors[type] }}
                        />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddActor}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Add Actor
                </button>
                <button
                  onClick={() => { setIsAddingActor(false); setNewActorName(''); }}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Message Modal */}
      {isAddingMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[420px] shadow-xl">
            <h3 className="text-slate-800 font-semibold text-lg mb-4">Add Message</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 text-sm mb-1">From</label>
                  <select
                    value={newMessage.fromActorId}
                    onChange={(e) => setNewMessage({ ...newMessage, fromActorId: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {sortedActors.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">To (optional for self-action)</label>
                  <select
                    value={newMessage.toActorId}
                    onChange={(e) => setNewMessage({ ...newMessage, toActorId: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Same as From</option>
                    {sortedActors.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Label</label>
                <input
                  type="text"
                  value={newMessage.label}
                  onChange={(e) => setNewMessage({ ...newMessage, label: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="e.g., Create Checkout Session"
                />
              </div>
              <div>
                <label className="block text-slate-600 text-sm mb-1">Type</label>
                <div className="flex gap-2">
                  {([
                    { value: 'sync', label: 'Request', desc: 'Solid arrow' },
                    { value: 'return', label: 'Return', desc: 'Dashed arrow' },
                    { value: 'async', label: 'Async', desc: 'No response' },
                  ] as const).map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setNewMessage({ ...newMessage, type: type.value })}
                      className={`
                        flex-1 px-3 py-2 rounded text-sm border transition-all
                        ${newMessage.type === type.value
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}
                      `}
                    >
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs opacity-70">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddMessage}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Add Message
                </button>
                <button
                  onClick={() => { setIsAddingMessage(false); setNewMessage({ fromActorId: '', toActorId: '', label: '', description: '', type: 'sync' }); }}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Actor Modal */}
      {editingActorId && (() => {
        const actor = actors.find(a => a.id === editingActorId);
        if (!actor) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
              <h3 className="text-slate-800 font-semibold text-lg mb-4">Edit Actor</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-600 text-sm mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={actor.name}
                    onChange={(e) => updateActor(actor.id, { name: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">Type</label>
                  <div className="flex gap-2">
                    {(['user', 'system', 'external'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => updateActor(actor.id, { type })}
                        className={`
                          flex-1 px-3 py-2 rounded text-sm font-medium border transition-all
                          ${actor.type === type
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}
                        `}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: actorColors[type] }}
                          />
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setEditingActorId(null)}
                  className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Message Modal */}
      {editingMessageId && (() => {
        const message = messages.find(m => m.id === editingMessageId);
        if (!message) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-[420px] shadow-xl">
              <h3 className="text-slate-800 font-semibold text-lg mb-4">Edit Message</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 text-sm mb-1">From</label>
                    <select
                      defaultValue={message.fromActorId}
                      onChange={(e) => updateMessage(message.id, { fromActorId: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                    >
                      {sortedActors.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-sm mb-1">To</label>
                    <select
                      defaultValue={message.toActorId}
                      onChange={(e) => updateMessage(message.id, { toActorId: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                    >
                      {sortedActors.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">Label</label>
                  <input
                    type="text"
                    defaultValue={message.label}
                    onChange={(e) => updateMessage(message.id, { label: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">Type</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'sync', label: 'Request' },
                      { value: 'return', label: 'Return' },
                      { value: 'async', label: 'Async' },
                    ] as const).map((type) => (
                      <button
                        key={type.value}
                        onClick={() => updateMessage(message.id, { type: type.value })}
                        className={`
                          flex-1 px-3 py-2 rounded text-sm font-medium border transition-all
                          ${message.type === type.value
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}
                        `}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setEditingMessageId(null)}
                  className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <AISSDGenerator isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
}
