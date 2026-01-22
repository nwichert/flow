import { useState } from 'react';
import { Panel } from '@xyflow/react';
import { SparklesIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useStoryStore, type StoryNode } from '../store/useStoryStore';
import { AIWorkflowGenerator } from './AIWorkflowGenerator';
import { useToast } from './Toast';

type AddNodePanelProps = {
  isSidebarOpen: boolean;
};

export function AddNodePanel({ isSidebarOpen }: AddNodePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<StoryNode, 'id' | 'order'>>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
  });
  const { addNode, activeStoryId } = useStoryStore();
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !activeStoryId) return;

    addNode(formData, {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    });

    showToast(`Created "${formData.title}"`);
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
    });
    setIsOpen(false);
  };

  if (!activeStoryId) return null;

  return (
    <>
      <Panel position="top-left" style={{ margin: 16, marginLeft: isSidebarOpen ? 16 : 64 }}>
        {!isOpen ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-white font-medium shadow-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Add Node
            </button>
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-faded)] rounded-lg text-[var(--color-primary)] font-medium shadow-lg transition-colors"
              title="Generate workflow with AI"
            >
              <SparklesIcon className="w-5 h-5" />
              AI Generate
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="w-80 p-4 bg-white rounded-lg shadow-xl border border-slate-200"
          >
            <h3 className="text-slate-800 font-semibold mb-4">New Node</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-500 text-xs mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 rounded text-slate-800 text-sm border border-slate-300 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  placeholder="Step title..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-500 text-xs mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 rounded text-slate-800 text-sm border border-slate-300 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none"
                  rows={3}
                  placeholder="Describe this step..."
                />
              </div>

              <div>
                <label className="block text-slate-500 text-xs mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as StoryNode['priority'] })}
                  className="w-full px-3 py-2 bg-slate-50 rounded text-slate-800 text-sm border border-slate-300 focus:border-[var(--color-primary)] focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded text-white text-sm font-medium transition-colors"
                >
                  Create Node
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </Panel>

      <AIWorkflowGenerator isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </>
  );
}
