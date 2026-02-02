import { useState } from 'react';
import { useStoryStore, type DiagramType, type Project } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useTheme, type ThemeColor } from './ThemeProvider';
import { PaintBrushIcon, CheckIcon, FolderIcon, FolderOpenIcon, ChevronRightIcon, ShareIcon } from '@heroicons/react/24/solid';

interface UserStorySidebarProps {
  onClose?: () => void;
}

export function UserStorySidebar({ onClose }: UserStorySidebarProps) {
  const {
    projects,
    activeProjectId,
    userStories,
    activeStoryId,
    setActiveProject,
    setActiveStory,
    createProject,
    updateProject,
    deleteProject,
    createUserStory,
    updateUserStory,
    deleteUserStory,
    duplicateUserStory,
    getProjectDiagrams,
  } = useStoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { theme, setTheme, colors } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set([activeProjectId || '']));

  const themeOptions: { value: ThemeColor; label: string; color: string }[] = [
    { value: 'pink', label: 'Pink', color: '#ff0071' },
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'green', label: 'Green', color: '#10b981' },
  ];

  // Project creation state
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');

  // Diagram creation state
  const [creationStep, setCreationStep] = useState<'closed' | 'select-type' | 'enter-details'>('closed');
  const [selectedType, setSelectedType] = useState<DiagramType>('workflow');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const id = await createProject(newProjectName);
    setExpandedProjects((prev) => new Set(prev).add(id));
    setNewProjectName('');
    setIsCreatingProject(false);
    showToast(`Created project "${newProjectName}"`);
  };

  const handleStartEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name);
  };

  const handleSaveEditProject = async () => {
    if (!editingProjectId || !editProjectName.trim()) return;
    await updateProject(editingProjectId, { name: editProjectName });
    setEditingProjectId(null);
    showToast('Project updated');
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) {
      showToast('Cannot delete the last project', 'warning');
      return;
    }
    const project = projects.find(p => p.id === id);
    const diagrams = getProjectDiagrams(id);
    const confirmed = await confirm({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${project?.name || 'this project'}" and its ${diagrams.length} diagram(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteProject(id);
      showToast(`Deleted "${project?.name || 'project'}"`);
    }
  };

  const handleSelectType = (type: DiagramType) => {
    setSelectedType(type);
    setCreationStep('enter-details');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createUserStory(newName, selectedType, newDescription);
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

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateUserStory(editingId, { name: editName, description: editDescription });
    setEditingId(null);
    showToast('Diagram updated');
  };

  const handleDelete = async (id: string) => {
    const story = userStories.find(s => s.id === id);
    const confirmed = await confirm({
      title: 'Delete Diagram',
      message: `Are you sure you want to delete "${story?.name || 'this diagram'}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteUserStory(id);
      showToast(`Deleted "${story?.name || 'diagram'}"`);
    }
  };

  const getTypeIcon = (type: DiagramType | undefined) => {
    switch (type) {
      case 'ssd':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
          </svg>
        );
      case 'state-diagram':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'erd':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  const getTypeIconStyle = (type: DiagramType | undefined) => {
    switch (type) {
      case 'ssd':
        return { color: colors.primaryLight };
      case 'state-diagram':
        return { color: '#10b981' }; // Green for state diagrams
      case 'erd':
        return { color: '#f59e0b' }; // Amber for ERD
      default:
        return { color: colors.primary };
    }
  };

  const getTypeName = (type: DiagramType | undefined) => {
    switch (type) {
      case 'ssd':
        return 'Sequence Diagram';
      case 'state-diagram':
        return 'State Diagram';
      case 'erd':
        return 'Entity Relationship Diagram';
      default:
        return 'Workflow';
    }
  };

  return (
    <div className="w-full h-full bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShareIcon className="w-5 h-5" style={{ color: colors.primary }} />
            <h2 className="text-white font-semibold text-lg">Flow</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="Theme"
            >
              <PaintBrushIcon className="w-5 h-5 text-slate-400" />
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
        <p className="text-slate-400 text-xs mt-1">Organize your diagrams</p>

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

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projects.map((project) => {
          const isExpanded = expandedProjects.has(project.id);
          const projectDiagrams = getProjectDiagrams(project.id);
          const isActiveProject = activeProjectId === project.id;

          return (
            <div key={project.id} className="space-y-1">
              {/* Project Header */}
              {editingProjectId === project.id ? (
                <div className="px-2 py-1 space-y-2">
                  <input
                    type="text"
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-600 rounded text-white text-sm border border-slate-500 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEditProject();
                      if (e.key === 'Escape') setEditingProjectId(null);
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEditProject}
                      className="flex-1 px-2 py-1 rounded text-white text-xs font-medium"
                      style={{ backgroundColor: colors.primary }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingProjectId(null)}
                      className="flex-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                    isActiveProject ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                  }`}
                  onClick={() => {
                    toggleProjectExpanded(project.id);
                    if (!isActiveProject) {
                      setActiveProject(project.id);
                    }
                  }}
                >
                  <ChevronRightIcon
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  {isExpanded ? (
                    <FolderOpenIcon className="w-4 h-4 text-amber-400" />
                  ) : (
                    <FolderIcon className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-white text-sm font-medium flex-1 truncate">{project.name}</span>
                  <span className="text-slate-500 text-xs">{projectDiagrams.length}</span>

                  {/* Project actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditProject(project);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                      title="Rename"
                    >
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
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
              )}

              {/* Diagrams List (collapsed/expanded) */}
              {isExpanded && (
                <div className="ml-4 space-y-1">
                  {projectDiagrams.length === 0 ? (
                    <p className="text-slate-500 text-xs px-2 py-1 italic">No diagrams yet</p>
                  ) : (
                    projectDiagrams.map((story) => (
                      <div
                        key={story.id}
                        className={`px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
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
                              autoFocus
                            />
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              className="w-full px-2 py-1 bg-slate-600 rounded text-white text-xs border border-slate-500 focus:outline-none resize-none"
                              rows={2}
                              placeholder="Description (optional)"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="flex-1 px-2 py-1 rounded text-white text-xs font-medium"
                                style={{ backgroundColor: colors.primary }}
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
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await duplicateUserStory(story.id);
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
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* New Project Input */}
        {isCreatingProject && (
          <div className="px-2 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-amber-400" />
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 px-2 py-1 bg-slate-600 rounded text-white text-sm border border-slate-500 focus:outline-none"
                placeholder="Project name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject();
                  if (e.key === 'Escape') {
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-2 py-1 rounded text-white text-xs font-medium"
                style={{ backgroundColor: colors.primary }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreatingProject(false);
                  setNewProjectName('');
                }}
                className="flex-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-700 space-y-2">
        {/* New Project Button */}
        {!isCreatingProject && creationStep === 'closed' && (
          <button
            onClick={() => setIsCreatingProject(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <FolderIcon className="w-4 h-4 text-amber-400" />
            New Project
          </button>
        )}

        {/* New Diagram Flow */}
        {creationStep === 'closed' && !isCreatingProject && (
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
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <button
                onClick={() => handleSelectType('workflow')}
                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors border border-slate-600"
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

              <button
                onClick={() => handleSelectType('state-diagram')}
                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors border border-slate-600"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm">State Diagram</h4>
                    <p className="text-slate-400 text-xs">States and transitions for object lifecycle</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelectType('erd')}
                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors border border-slate-600"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm">Entity Relationship Diagram</h4>
                    <p className="text-slate-400 text-xs">Database entities and relationships</p>
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
                New {getTypeName(selectedType)}
              </h3>
            </div>

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 rounded text-white text-sm border border-slate-600 focus:outline-none"
              placeholder="Diagram name"
              autoFocus
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 rounded text-white text-xs border border-slate-600 focus:outline-none resize-none"
              rows={2}
              placeholder="Description (optional)"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 rounded text-white text-sm font-medium transition-colors"
                style={{ backgroundColor: colors.primary }}
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
