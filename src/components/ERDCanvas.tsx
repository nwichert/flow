import { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { CameraIcon, TrashIcon, PencilIcon, LightBulbIcon } from '@heroicons/react/24/solid';
import { useStoryStore, type ERDEntity, type ERDAttribute, type ERDRelationship, type DiagramType } from '../store/useStoryStore';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useTheme } from './ThemeProvider';
import { classifyDiagramType, type DiagramClassification } from '../utils/classifyDiagram';
import { DiagramSuggestionModal } from './DiagramSuggestionModal';

const ENTITY_WIDTH = 200;
const ENTITY_MIN_HEIGHT = 120;
const PADDING = 60;
const GAP_X = 280;
const GAP_Y = 200;

type ERDCanvasProps = {
  isSidebarOpen: boolean;
};

export function ERDCanvas({ isSidebarOpen }: ERDCanvasProps) {
  const {
    entities,
    relationships,
    addEntity,
    updateEntity,
    deleteEntity,
    addRelationship,
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

  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isAddingRelationship, setIsAddingRelationship] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [classification, setClassification] = useState<DiagramClassification | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  const [newEntityName, setNewEntityName] = useState('');
  const [newAttributes, setNewAttributes] = useState<Omit<ERDAttribute, 'id'>[]>([
    { name: 'id', type: 'INT', isPrimaryKey: true, isForeignKey: false, isRequired: true },
  ]);

  const [newRelationship, setNewRelationship] = useState({
    fromEntityId: '',
    toEntityId: '',
    fromCardinality: '1' as ERDRelationship['fromCardinality'],
    toCardinality: 'N' as ERDRelationship['toCardinality'],
    label: '',
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleScreenshot = useCallback(async () => {
    if (!canvasRef.current || entities.length === 0) return;

    try {
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: '#f8fafc',
        pixelRatio: 4,
      });

      const link = document.createElement('a');
      link.download = 'erd-diagram.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    }
  }, [entities.length]);

  const handleReEvaluate = useCallback(async () => {
    // Build description from diagram content if none exists
    let descriptionToEvaluate = activeStory?.description || '';

    if (!descriptionToEvaluate && (entities.length > 0 || relationships.length > 0)) {
      // Generate description from entities and relationships
      const entityDescriptions = entities.map(e => {
        const attrs = e.attributes.map(a => `${a.name}${a.isPrimaryKey ? ' (PK)' : ''}${a.isForeignKey ? ' (FK)' : ''}`).join(', ');
        return `${e.name}[${attrs}]`;
      }).join('; ');
      const relationshipDescriptions = relationships.map(r => {
        const fromEntity = entities.find(e => e.id === r.fromEntityId)?.name || 'Unknown';
        const toEntity = entities.find(e => e.id === r.toEntityId)?.name || 'Unknown';
        return `${fromEntity} (${r.fromCardinality}) -> (${r.toCardinality}) ${toEntity}${r.label ? `: ${r.label}` : ''}`;
      }).join('; ');
      descriptionToEvaluate = `ERD with entities: ${entityDescriptions}. Relationships: ${relationshipDescriptions}`;
    }

    if (!descriptionToEvaluate) {
      showToast('Add some entities or relationships to the diagram first', 'warning');
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await classifyDiagramType(descriptionToEvaluate, 'erd');

      if (result.recommendedType !== 'erd') {
        setClassification(result);
        setShowSuggestionModal(true);
      } else {
        showToast('This ERD type is the best fit for your content');
      }
    } catch (err) {
      showToast('Failed to evaluate diagram type', 'error');
    } finally {
      setIsEvaluating(false);
    }
  }, [activeStory, entities, relationships, showToast]);

  const handleAcceptSuggestion = async (suggestedType: DiagramType) => {
    setShowSuggestionModal(false);

    if (!activeProjectId || !activeStory) return;

    const confirmed = await confirm({
      title: 'Switch Diagram Type',
      message: `This will create a new ${suggestedType} diagram and delete the current ERD. Continue?`,
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
    showToast('Keeping current ERD');
  };

  const sortedEntities = [...entities].sort((a, b) => a.order - b.order);

  // Calculate positions for entities in a grid layout
  const getEntityPosition = (index: number) => {
    const cols = Math.ceil(Math.sqrt(entities.length));
    const row = Math.floor(index / cols);
    const col = index % cols;

    return {
      x: PADDING + col * GAP_X,
      y: PADDING + row * GAP_Y,
    };
  };

  // Canvas dimensions
  const cols = Math.ceil(Math.sqrt(entities.length)) || 1;
  const rows = Math.ceil(entities.length / cols) || 1;
  const canvasWidth = Math.max(800, PADDING * 2 + cols * GAP_X);
  const canvasHeight = Math.max(500, PADDING * 2 + rows * GAP_Y + 100);

  const handleAddAttribute = () => {
    setNewAttributes([
      ...newAttributes,
      { name: '', type: 'VARCHAR(255)', isPrimaryKey: false, isForeignKey: false, isRequired: false },
    ]);
  };

  const handleRemoveAttribute = (index: number) => {
    setNewAttributes(newAttributes.filter((_, i) => i !== index));
  };

  const handleUpdateAttribute = (index: number, updates: Partial<Omit<ERDAttribute, 'id'>>) => {
    setNewAttributes(newAttributes.map((attr, i) => i === index ? { ...attr, ...updates } : attr));
  };

  const handleAddEntity = () => {
    if (!newEntityName.trim()) return;
    const validAttributes = newAttributes.filter(a => a.name.trim());
    addEntity({
      name: newEntityName,
      attributes: validAttributes.map(a => ({ ...a, id: Math.random().toString(36).substring(2, 11) })),
    });
    showToast(`Added entity "${newEntityName}"`);
    resetEntityForm();
  };

  const resetEntityForm = () => {
    setNewEntityName('');
    setNewAttributes([
      { name: 'id', type: 'INT', isPrimaryKey: true, isForeignKey: false, isRequired: true },
    ]);
    setIsAddingEntity(false);
    setEditingEntityId(null);
  };

  const handleAddRelationship = () => {
    if (!newRelationship.fromEntityId || !newRelationship.toEntityId) return;
    addRelationship({
      fromEntityId: newRelationship.fromEntityId,
      toEntityId: newRelationship.toEntityId,
      fromCardinality: newRelationship.fromCardinality,
      toCardinality: newRelationship.toCardinality,
      label: newRelationship.label,
    });
    showToast('Added relationship');
    setNewRelationship({
      fromEntityId: '',
      toEntityId: '',
      fromCardinality: '1',
      toCardinality: 'N',
      label: '',
    });
    setIsAddingRelationship(false);
  };

  const handleDeleteEntity = async (entityId: string, entityName: string) => {
    deleteEntity(entityId);
    showToast(`Deleted entity "${entityName}"`);
    setSelectedId(null);
  };

  const startEditEntity = (entity: ERDEntity) => {
    setEditingEntityId(entity.id);
    setNewEntityName(entity.name);
    setNewAttributes(entity.attributes.map(a => ({
      name: a.name,
      type: a.type,
      isPrimaryKey: a.isPrimaryKey,
      isForeignKey: a.isForeignKey,
      isRequired: a.isRequired,
    })));
    setIsAddingEntity(true);
  };

  const handleUpdateEntity = () => {
    if (!editingEntityId || !newEntityName.trim()) return;
    const validAttributes = newAttributes.filter(a => a.name.trim());
    updateEntity(editingEntityId, {
      name: newEntityName,
      attributes: validAttributes.map(a => ({ ...a, id: Math.random().toString(36).substring(2, 11) })),
    });
    showToast(`Updated entity "${newEntityName}"`);
    resetEntityForm();
  };

  const cardinalityOptions: ERDRelationship['fromCardinality'][] = ['1', 'N', '0..1', '0..N', '1..N'];

  return (
    <div className="flex-1 h-full flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Toolbar */}
      {!isPresentationMode && (
        <div className={`flex-shrink-0 flex items-center gap-2 p-3 border-b border-slate-200 bg-white ${!isSidebarOpen ? 'pl-16' : ''}`}>
          <button
            onClick={() => setIsAddingEntity(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-white font-medium shadow-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Entity
          </button>
          <button
            onClick={() => setIsAddingRelationship(true)}
            disabled={entities.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-faded)] rounded-lg text-[var(--color-primary)] font-medium shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Relationship
          </button>
          <div className="w-px h-8 bg-slate-300 mx-1" />
          <button
            onClick={handleScreenshot}
            disabled={entities.length === 0}
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
              <pattern id="erd-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.5" fill="#91919a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#erd-dots)" />

            {/* Relationship lines */}
            {relationships.map((rel) => {
              const fromIndex = sortedEntities.findIndex(e => e.id === rel.fromEntityId);
              const toIndex = sortedEntities.findIndex(e => e.id === rel.toEntityId);
              if (fromIndex === -1 || toIndex === -1) return null;

              const fromPos = getEntityPosition(fromIndex);
              const toPos = getEntityPosition(toIndex);
              const fromEntity = sortedEntities[fromIndex];
              const toEntity = sortedEntities[toIndex];

              // Calculate entity heights based on attributes
              const fromHeight = Math.max(ENTITY_MIN_HEIGHT, 44 + fromEntity.attributes.length * 28);
              const toHeight = Math.max(ENTITY_MIN_HEIGHT, 44 + toEntity.attributes.length * 28);

              // Calculate center points
              const fromCenterX = fromPos.x + ENTITY_WIDTH / 2;
              const fromCenterY = fromPos.y + fromHeight / 2;
              const toCenterX = toPos.x + ENTITY_WIDTH / 2;
              const toCenterY = toPos.y + toHeight / 2;

              // Determine connection points (left/right/top/bottom based on relative positions)
              let startX, startY, endX, endY;
              const dx = toCenterX - fromCenterX;
              const dy = toCenterY - fromCenterY;

              if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal connection
                if (dx > 0) {
                  startX = fromPos.x + ENTITY_WIDTH;
                  endX = toPos.x;
                } else {
                  startX = fromPos.x;
                  endX = toPos.x + ENTITY_WIDTH;
                }
                startY = fromCenterY;
                endY = toCenterY;
              } else {
                // Vertical connection
                startX = fromCenterX;
                endX = toCenterX;
                if (dy > 0) {
                  startY = fromPos.y + fromHeight;
                  endY = toPos.y;
                } else {
                  startY = fromPos.y;
                  endY = toPos.y + toHeight;
                }
              }

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              return (
                <g key={rel.id}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={colors.primary}
                    strokeWidth={2}
                  />
                  {/* Cardinality labels */}
                  <text
                    x={startX + (midX - startX) * 0.2}
                    y={startY + (midY - startY) * 0.2 - 8}
                    className="text-xs fill-slate-600 font-medium"
                    textAnchor="middle"
                  >
                    {rel.fromCardinality}
                  </text>
                  <text
                    x={endX - (endX - midX) * 0.2}
                    y={endY - (endY - midY) * 0.2 - 8}
                    className="text-xs fill-slate-600 font-medium"
                    textAnchor="middle"
                  >
                    {rel.toCardinality}
                  </text>
                  {/* Relationship label */}
                  {rel.label && (
                    <text
                      x={midX}
                      y={midY - 12}
                      className="text-xs fill-slate-500 font-medium"
                      textAnchor="middle"
                    >
                      {rel.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Entity cards */}
          {sortedEntities.map((entity, index) => {
            const pos = getEntityPosition(index);
            const isSelected = selectedId === `entity-${entity.id}`;

            return (
              <div
                key={entity.id}
                className={`absolute cursor-pointer transition-all group ${isSelected ? 'ring-2 ring-offset-2 ring-violet-500' : ''}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: ENTITY_WIDTH,
                }}
                onClick={() => setSelectedId(isSelected ? null : `entity-${entity.id}`)}
              >
                <div
                  className="w-full bg-white rounded-lg shadow-md overflow-hidden border-2"
                  style={{ borderColor: colors.primary }}
                >
                  {/* Entity header */}
                  <div
                    className="px-3 py-2 font-semibold text-white text-center"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {entity.name}
                  </div>
                  {/* Attributes */}
                  <div className="divide-y divide-slate-100">
                    {entity.attributes.map((attr) => (
                      <div key={attr.id} className="px-3 py-1.5 flex items-center gap-2 text-sm">
                        {attr.isPrimaryKey && (
                          <span className="text-amber-500 font-bold" title="Primary Key">PK</span>
                        )}
                        {attr.isForeignKey && (
                          <span className="text-blue-500 font-bold" title="Foreign Key">FK</span>
                        )}
                        <span className={`${attr.isRequired ? 'font-medium' : ''} text-slate-700`}>
                          {attr.name}
                        </span>
                        <span className="text-slate-400 text-xs ml-auto">{attr.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Action buttons on hover/select */}
                {!isPresentationMode && (
                  <div className={`absolute -top-2 -right-2 flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditEntity(entity); }}
                      className="p-1.5 bg-white border border-slate-200 rounded-full shadow hover:bg-slate-50"
                      title="Edit"
                    >
                      <PencilIcon className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEntity(entity.id, entity.name); }}
                      className="p-1.5 bg-white border border-slate-200 rounded-full shadow hover:bg-red-50"
                      title="Delete"
                    >
                      <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {entities.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-3xl">🗃️</span>
                </div>
                <h3 className="text-slate-700 font-semibold text-lg mb-2">No Entities Yet</h3>
                <p className="text-slate-500 text-sm">Add entities to design your database schema</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Entity Modal */}
      {isAddingEntity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[500px] max-h-[80vh] overflow-y-auto shadow-xl">
            <h3 className="text-slate-800 font-semibold text-lg mb-4">
              {editingEntityId ? 'Edit Entity' : 'Add Entity'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-600 text-sm mb-1">Entity Name</label>
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  placeholder="e.g., User, Product, Order"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-600 text-sm">Attributes</label>
                  <button
                    onClick={handleAddAttribute}
                    className="text-sm text-violet-600 hover:text-violet-500"
                  >
                    + Add Attribute
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {newAttributes.map((attr, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) => handleUpdateAttribute(index, { name: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                        placeholder="Attribute name"
                      />
                      <select
                        value={attr.type}
                        onChange={(e) => handleUpdateAttribute(index, { type: e.target.value })}
                        className="w-32 px-2 py-1 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                      >
                        <option>INT</option>
                        <option>BIGINT</option>
                        <option>VARCHAR(255)</option>
                        <option>TEXT</option>
                        <option>BOOLEAN</option>
                        <option>DATE</option>
                        <option>DATETIME</option>
                        <option>DECIMAL</option>
                        <option>FLOAT</option>
                        <option>JSON</option>
                        <option>UUID</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={attr.isPrimaryKey}
                          onChange={(e) => handleUpdateAttribute(index, { isPrimaryKey: e.target.checked })}
                          className="rounded"
                        />
                        PK
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={attr.isForeignKey}
                          onChange={(e) => handleUpdateAttribute(index, { isForeignKey: e.target.checked })}
                          className="rounded"
                        />
                        FK
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={attr.isRequired}
                          onChange={(e) => handleUpdateAttribute(index, { isRequired: e.target.checked })}
                          className="rounded"
                        />
                        Req
                      </label>
                      {newAttributes.length > 1 && (
                        <button
                          onClick={() => handleRemoveAttribute(index)}
                          className="p-1 text-red-400 hover:text-red-500"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={editingEntityId ? handleUpdateEntity : handleAddEntity}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  {editingEntityId ? 'Update Entity' : 'Add Entity'}
                </button>
                <button
                  onClick={resetEntityForm}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Relationship Modal */}
      {isAddingRelationship && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[450px] shadow-xl">
            <h3 className="text-slate-800 font-semibold text-lg mb-4">Add Relationship</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 text-sm mb-1">From Entity</label>
                  <select
                    value={newRelationship.fromEntityId}
                    onChange={(e) => setNewRelationship({ ...newRelationship, fromEntityId: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {sortedEntities.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">To Entity</label>
                  <select
                    value={newRelationship.toEntityId}
                    onChange={(e) => setNewRelationship({ ...newRelationship, toEntityId: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {sortedEntities.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 text-sm mb-1">From Cardinality</label>
                  <select
                    value={newRelationship.fromCardinality}
                    onChange={(e) => setNewRelationship({ ...newRelationship, fromCardinality: e.target.value as ERDRelationship['fromCardinality'] })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    {cardinalityOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-sm mb-1">To Cardinality</label>
                  <select
                    value={newRelationship.toCardinality}
                    onChange={(e) => setNewRelationship({ ...newRelationship, toCardinality: e.target.value as ERDRelationship['toCardinality'] })}
                    className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    {cardinalityOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 text-sm mb-1">Relationship Label (optional)</label>
                <input
                  type="text"
                  value={newRelationship.label}
                  onChange={(e) => setNewRelationship({ ...newRelationship, label: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded text-slate-800 text-sm border border-slate-300 focus:border-violet-500 focus:outline-none"
                  placeholder="e.g., has, belongs to"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddRelationship}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-white text-sm font-medium"
                >
                  Add Relationship
                </button>
                <button
                  onClick={() => { setIsAddingRelationship(false); setNewRelationship({ fromEntityId: '', toEntityId: '', fromCardinality: '1', toCardinality: 'N', label: '' }); }}
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
          requestedType="erd"
          onAcceptSuggestion={handleAcceptSuggestion}
          onKeepOriginal={handleKeepOriginal}
        />
      )}
    </div>
  );
}
