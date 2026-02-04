import { useState, useRef, useCallback } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps, type Node } from '@xyflow/react';
import { useStoryStore, type StoryNode } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

/** Render description text with **bold** and *italic* markdown syntax. */
function FormattedText({ text, className }: { text: string; className?: string }) {
  // Split on **bold** and *italic* markers, preserving delimiters
  const parts: React.ReactNode[] = [];
  // Process bold first, then italic within each segment
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const processItalic = (segment: string, key: string) => {
    const italicRegex = /\*(.+?)\*/g;
    const result: React.ReactNode[] = [];
    let iLastIndex = 0;
    let iMatch: RegExpExecArray | null;

    while ((iMatch = italicRegex.exec(segment)) !== null) {
      if (iMatch.index > iLastIndex) {
        result.push(segment.slice(iLastIndex, iMatch.index));
      }
      result.push(<em key={`${key}-i-${iMatch.index}`}>{iMatch[1]}</em>);
      iLastIndex = iMatch.index + iMatch[0].length;
    }
    if (iLastIndex < segment.length) {
      result.push(segment.slice(iLastIndex));
    }
    return result;
  };

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...processItalic(text.slice(lastIndex, match.index), `t-${lastIndex}`));
    }
    parts.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(...processItalic(text.slice(lastIndex), `t-${lastIndex}`));
  }

  return <span className={className}>{parts}</span>;
}

export function AnnotationNode({ data, id, selected }: NodeProps<Node<StoryNode>>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(data);
  const [orderInput, setOrderInput] = useState(String(data.order));
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const { updateNode, deleteNode, duplicateNode, isPresentationMode, currentStepIndex, presentationOrder } = useStoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const currentGroup = presentationOrder[currentStepIndex] || [];
  const nodeStepIndex = presentationOrder.findIndex((group) => group.includes(id));
  const isActive = currentGroup.includes(id);
  const hasBeenShown = nodeStepIndex !== -1 && nodeStepIndex < currentStepIndex;
  const isVisible = !isPresentationMode || isActive || hasBeenShown;
  const isDimmed = isPresentationMode && !isActive && hasBeenShown;

  const startEditing = () => {
    setEditData(data);
    setOrderInput(String(data.order));
    setIsEditing(true);
  };

  const wrapSelection = useCallback((wrapper: string) => {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    if (!selected) return;

    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const newValue = `${before}${wrapper}${selected}${wrapper}${after}`;
    setEditData((prev) => ({ ...prev, description: newValue }));

    // Restore cursor position after the wrapped text
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = selectionEnd + wrapper.length * 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, []);

  const handleSave = () => {
    updateNode(id, {
      title: editData.title,
      description: editData.description,
      order: parseInt(orderInput, 10) || 1,
    });
    setIsEditing(false);
    showToast('Annotation updated');
  };

  const handleCancel = () => {
    setEditData(data);
    setOrderInput(String(data.order));
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Annotation',
      message: `Are you sure you want to delete "${data.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      deleteNode(id);
      showToast(`Deleted "${data.title}"`);
    }
  };

  const handles = (
    <>
      <Handle type="target" position={Position.Top} id="top-target" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="source" position={Position.Top} id="top-source" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="target" position={Position.Left} id="left-target" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="source" position={Position.Left} id="left-source" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="target" position={Position.Right} id="right-target" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="source" position={Position.Right} id="right-source" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" isConnectable={true}
        className="!bg-[var(--color-primary-muted)] !w-2 !h-2 !border !border-white" />
    </>
  );

  if (isPresentationMode && !isVisible) {
    return null;
  }

  if (isEditing && !isPresentationMode) {
    return (
      <div className="w-72 p-4 bg-[var(--color-primary-faded)] rounded-lg border-2 border-dashed border-[var(--color-primary-muted)] shadow-md">
        {handles}
        <div className="space-y-3">
          <div>
            <label className="block text-slate-500 text-xs mb-1">Title</label>
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="w-full px-2 py-1 bg-white/80 rounded text-slate-700 text-sm font-medium border border-slate-300 focus:border-[var(--color-primary-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-muted)]/30"
              placeholder="Annotation title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-500 text-xs mb-1">Description</label>
            <div className="flex items-center gap-1 mb-1">
              <button
                type="button"
                onClick={() => wrapSelection('**')}
                className="px-1.5 py-0.5 bg-white/60 hover:bg-white/90 rounded text-slate-600 text-xs font-bold border border-slate-200 transition-colors"
                title="Bold (select text first)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('*')}
                className="px-1.5 py-0.5 bg-white/60 hover:bg-white/90 rounded text-slate-600 text-xs italic border border-slate-200 transition-colors"
                title="Italic (select text first)"
              >
                I
              </button>
              <span className="text-slate-400 text-[10px] ml-1">Select text, then click</span>
            </div>
            <textarea
              ref={descriptionRef}
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full px-2 py-1 bg-white/80 rounded text-slate-700 text-xs border border-slate-300 focus:border-[var(--color-primary-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-muted)]/30 resize-none"
              rows={3}
              placeholder="Annotation text... use **bold** or *italic*"
            />
          </div>

          <div>
            <label className="block text-slate-500 text-xs mb-1">Presentation Order</label>
            <input
              type="text"
              inputMode="numeric"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-20 px-2 py-1 bg-white/80 rounded text-slate-700 text-sm text-center border border-slate-300 focus:border-[var(--color-primary-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-muted)]/30"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-1 bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary-light)] rounded text-white text-xs font-medium transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isPresentationMode && (
        <NodeToolbar
          position={Position.Top}
          className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg shadow-lg border border-slate-200"
        >
          <button
            onClick={startEditing}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => {
              duplicateNode(id);
              showToast(`Duplicated "${data.title}"`);
            }}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Duplicate"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            onClick={handleDelete}
            className="p-1.5 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </NodeToolbar>
      )}

      <div
        className={`p-3 rounded-lg border-2 border-dashed shadow-md transition-all duration-300 bg-[var(--color-primary-faded)] border-[var(--color-primary-muted)] ${
          isPresentationMode && isActive
            ? 'ring-4 ring-[var(--color-primary)]/30 scale-105 shadow-xl w-72'
            : isPresentationMode
            ? 'w-64'
            : 'w-60'
        } ${isDimmed ? 'opacity-40' : ''} ${selected && !isPresentationMode ? 'w-64' : ''}`}
      >
        {handles}

        <div className="mb-2">
          <h3 className="font-medium text-slate-700 text-sm leading-tight">{data.title}</h3>
        </div>

        {data.description && (
          <div className={`text-slate-600 text-xs mb-2 ${
            selected || isPresentationMode ? '' : 'line-clamp-3'
          }`}>
            <FormattedText text={data.description} />
          </div>
        )}

      </div>
    </>
  );
}
