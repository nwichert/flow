import { useState } from 'react';
import { useStoryStore, type DiagramType } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useTheme, type ThemeColor } from './ThemeProvider';
import { Cog6ToothIcon, CheckIcon } from '@heroicons/react/24/solid';

interface UserStorySidebarProps {
  onClose?: () => void;
}

export function UserStorySidebar({ onClose }: UserStorySidebarProps) {
  const {
    userStories,
    activeStoryId,
    setActiveStory,
    createUserStory,
    updateUserStory,
    deleteUserStory,
    duplicateUserStory,
  } = useStoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { theme, setTheme, colors } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  const themeOptions: { value: ThemeColor; label: string; color: string }[] = [
    { value: 'pink', label: 'Pink', color: '#ff0071' },
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'green', label: 'Green', color: '#10b981' },
  ];

  const [creationStep, setCreationStep] = useState<'closed' | 'select-type' | 'enter-details'>('closed');
  const [selectedType, setSelectedType] = useState<DiagramType>('workflow');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleSelectType = (type: DiagramType) => {
    setSelectedType(type);
    setCreationStep('enter-details');
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createUserStory(newName, selectedType, newDescription);
    setActiveStory(id);
    setNewName('');
    setNewDescription('');
    setCreationStep('closed');
    showToast(`Created "${newName}"`);
  };

  const handleCancelCreate = () => {
    setCreationStep('closed');
    setNewName('');
    setNewDescription('');
  };

  const handleStartEdit = (story: typeof userStories[0]) => {
    setEditingId(story.id);
    setEditName(story.name);
    setEditDescription(story.description);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateUserStory(editingId, { name: editName, description: editDescription });
    setEditingId(null);
    showToast('Diagram updated');
  };

  const handleDelete = async (id: string) => {
    if (userStories.length <= 1) {
      showToast('Cannot delete the last diagram', 'warning');
      return;
    }
    const story = userStories.find(s => s.id === id);
    const confirmed = await confirm({
      title: 'Delete Diagram',
      message: `Are you sure you want to delete "${story?.name || 'this diagram'}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      deleteUserStory(id);
      showToast(`Deleted "${story?.name || 'diagram'}"`);
    }
  };

  const getTypeIcon = (type: DiagramType | undefined) => {
    if (type === 'ssd') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  };

  // Color helper - uses theme colors
  const getTypeIconStyle = (type: DiagramType | undefined) => {
    return { color: type === 'ssd' ? colors.primaryLight : colors.primary };
  };

  return (
    <div className="w-72 h-full bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Diagrams</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="Settings"
            >
              <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
                title="Close sidebar"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-1">Select or create a diagram</p>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
            <h3 className="text-white text-sm font-medium mb-2">Theme Color</h3>
            <div className="flex gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: option.color }}
                  title={option.label}
                >
                  {theme === option.value && (
                    <CheckIcon className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Story List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {userStories.map((story) => (
          <div
            key={story.id}
            className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeStoryId === story.id
                ? 'border'
                : 'border border-transparent hover:bg-slate-700/50'
            }`}
            style={activeStoryId === story.id ? {
              backgroundColor: colors.primaryFaded,
              borderColor: colors.primary
            } : undefined}
          >
            {editingId === story.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-600 rounded text-white text-sm border border-slate-500 focus:outline-none"
                  style={{ '--tw-ring-color': colors.primary } as React.CSSProperties}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = ''}
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-600 rounded text-white text-xs border border-slate-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Description (optional)"
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = ''}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-2 py-1 rounded text-white text-xs font-medium transition-colors"
                    style={{ backgroundColor: colors.primary }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => setActiveStory(story.id)} className="group">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0" style={getTypeIconStyle(story.type)}>
                      {getTypeIcon(story.type)}
                    </span>
                    <h3 className="text-white font-medium text-sm truncate">{story.name}</h3>
                  </div>
                  {/* Action buttons - only visible on hover */}
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(story);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                      title="Edit"
                    >
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateUserStory(story.id);
                        showToast(`Duplicated "${story.name}"`);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                      title="Duplicate"
                    >
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(story.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                      title="Delete"
                    >
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create New */}
      <div className="p-3 border-t border-slate-700">
        {creationStep === 'closed' && (
          <button
            onClick={() => setCreationStep('select-type')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors"
            style={{ backgroundColor: colors.primary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Diagram
          </button>
        )}

        {creationStep === 'select-type' && (
          <div className="space-y-3">
            <h3 className="text-white font-medium text-sm">Select Diagram Type</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleSelectType('workflow')}
                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors border border-slate-600"
                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.primaryFaded }}
                  >
                    <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm">User Workflow</h4>
                    <p className="text-slate-400 text-xs">Flow-based diagram with connected nodes</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelectType('ssd')}
                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors border border-slate-600"
                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primaryLight}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${colors.primaryLight}33` }}
                  >
                    <svg className="w-5 h-5" style={{ color: colors.primaryLight }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm">System Sequence Diagram</h4>
                    <p className="text-slate-400 text-xs">Vertical lanes with horizontal messages</p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={handleCancelCreate}
              className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-white text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {creationStep === 'enter-details' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span style={getTypeIconStyle(selectedType)}>
                {getTypeIcon(selectedType)}
              </span>
              <h3 className="text-white font-medium text-sm">
                New {selectedType === 'ssd' ? 'Sequence Diagram' : 'Workflow'}
              </h3>
            </div>

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 rounded text-white text-sm border border-slate-600 focus:outline-none"
              placeholder="Diagram name"
              autoFocus
              onFocus={(e) => e.target.style.borderColor = colors.primary}
              onBlur={(e) => e.target.style.borderColor = ''}
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 rounded text-white text-xs border border-slate-600 focus:outline-none resize-none"
              rows={2}
              placeholder="Description (optional)"
              onFocus={(e) => e.target.style.borderColor = colors.primary}
              onBlur={(e) => e.target.style.borderColor = ''}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 rounded text-white text-sm font-medium transition-colors"
                style={{ backgroundColor: colors.primary }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >
                Create
              </button>
              <button
                onClick={handleCancelCreate}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-white text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
