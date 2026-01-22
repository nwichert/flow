import { useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps, type Node } from '@xyflow/react';
import { useStoryStore, type StoryNode as StoryNodeType } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

const priorityBadges = {
  'low': 'bg-blue-100 text-blue-600',
  'medium': 'bg-yellow-100 text-yellow-700',
  'high': 'bg-red-100 text-red-600',
};

export function StoryNode({ data, id, selected }: NodeProps<Node<StoryNodeType>>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(data);
  const { updateNode, deleteNode, isPresentationMode, currentStepIndex, presentationOrder } = useStoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const currentNodeId = presentationOrder[currentStepIndex];
  const nodeIndex = presentationOrder.indexOf(id);
  const isActive = currentNodeId === id;
  // Node is visible if: not in presentation mode, OR it's the active node, OR it was shown in a previous step
  const hasBeenShown = nodeIndex !== -1 && nodeIndex < currentStepIndex;
  const isVisible = !isPresentationMode || isActive || hasBeenShown;
  const isDimmed = isPresentationMode && !isActive && hasBeenShown;

  const handleSave = () => {
    updateNode(id, {
      title: editData.title,
      description: editData.description,
      status: editData.status,
      priority: editData.priority,
      order: editData.order,
    });
    setIsEditing(false);
    showToast('Node updated');
  };

  const handleCancel = () => {
    setEditData(data);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Node',
      message: `Are you sure you want to delete "${data.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      deleteNode(id);
      showToast(`Deleted "${data.title}"`);
    }
  };

  // Hide nodes that haven't been shown yet in presentation mode
  if (isPresentationMode && !isVisible) {
    return null;
  }

  if (isEditing && !isPresentationMode) {
    return (
      <div className="w-72 p-4 bg-white rounded-lg border-2 border-violet-500 shadow-xl">
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white"
        />

        <div className="space-y-3">
          <div>
            <label className="block text-slate-500 text-xs mb-1">Title</label>
            <input
              type="text"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="w-full px-2 py-1 bg-slate-50 rounded text-slate-800 text-sm font-semibold border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              placeholder="Node title"
            />
          </div>

          <div>
            <label className="block text-slate-500 text-xs mb-1">Presentation Order</label>
            <input
              type="number"
              value={editData.order}
              onChange={(e) => setEditData({ ...editData, order: parseInt(e.target.value) || 1 })}
              className="w-20 px-2 py-1 bg-slate-50 rounded text-slate-800 text-sm text-center border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              min={1}
            />
          </div>

          <div>
            <label className="block text-slate-500 text-xs mb-1">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full px-2 py-1 bg-slate-50 rounded text-slate-800 text-xs border border-slate-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
              rows={3}
              placeholder="Node description"
            />
          </div>

          <div>
            <label className="block text-slate-500 text-xs mb-1">Priority</label>
            <select
              value={editData.priority}
              onChange={(e) => setEditData({ ...editData, priority: e.target.value as StoryNodeType['priority'] })}
              className="w-full px-2 py-1 bg-slate-50 rounded text-slate-800 text-xs border border-slate-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded text-white text-xs font-medium transition-colors"
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

        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white"
        />
      </div>
    );
  }

  return (
    <>
      {/* Node Toolbar - appears when node is selected */}
      {!isPresentationMode && (
        <NodeToolbar
          position={Position.Top}
          className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg shadow-lg border border-slate-200"
        >
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => useStoryStore.getState().duplicateNode(id)}
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
        className={`w-64 p-3 rounded-lg border-2 shadow-lg transition-all duration-300 bg-white border-[var(--color-primary)] ${
          isPresentationMode && isActive
            ? 'ring-4 ring-[var(--color-primary)]/40 scale-105 shadow-xl'
            : ''
        } ${isDimmed ? 'opacity-40' : ''} ${selected ? 'w-72' : ''}`}
      >
        {/* Top handle */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white hover:!w-3 hover:!h-3 transition-all"
        />

        {/* Left handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white hover:!w-3 hover:!h-3 transition-all"
        />

        {/* Right handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white hover:!w-3 hover:!h-3 transition-all"
        />

        <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-2">{data.title}</h3>

        <p className={`text-slate-600 text-xs mb-3 ${selected ? '' : 'line-clamp-2'}`}>{data.description}</p>

        <div className="flex items-center justify-end">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadges[data.priority]}`}>
            {data.priority}
          </span>
        </div>

        {/* Bottom handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          isConnectable={true}
          className="!bg-[var(--color-primary)] !w-2 !h-2 !border !border-white hover:!w-3 hover:!h-3 transition-all"
        />
      </div>
    </>
  );
}
