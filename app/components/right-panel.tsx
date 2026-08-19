'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { KeyMeasureData, MeasurementData, AssignmentData } from '@/types/takeoff';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  EyeOff,
  Square,
  Minus,
  Circle,
  Sparkles,
  Pencil,
  Trash2,
  GitCompareArrows,
  FolderPlus,
  FolderOpen,
  Copy,
  ArrowRightLeft,
  X,
  GripVertical,
  Layers,
  Plus,
  Eye,
  Flag,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

type FilterType = 'all' | 'area' | 'linear' | 'count';
type GroupByType = 'none' | 'type' | 'object' | 'assignment' | 'source' | 'visibility' | 'group';

const GROUP_BY_LABELS: Record<GroupByType, string> = {
  none: 'No Grouping',
  type: 'Measurement Type',
  object: 'Component Type',
  assignment: 'Assigned / Unassigned',
  source: 'Auto-Takeoff / Manual',
  visibility: 'Visibility',
  group: 'Custom Group',
};

function unitForType(type: string): string {
  switch (type) {
    case 'linear': return 'LF';
    case 'count': return 'EA';
    default: return 'SQ FT';
  }
}

/* ============== Derived QM Properties (shared by panel, filter & grouping) ============== */
// Ordered semantic object-type groups used for grouping & filtering.
const OBJECT_GROUP_ORDER = ['Walls', 'Doors', 'Windows', 'Floors', 'Roofs', 'Structural', 'Other'] as const;
const OBJECT_TYPE_OPTIONS = ['Wall', 'Door', 'Window', 'Floor', 'Roof', 'Header/Beam'] as const;
const LEVEL_OPTIONS = ['Basement', '1st Floor', '2nd Floor', '3rd Floor', 'Roof Level'] as const;

function objectTypeToGroup(objectType: string): string {
  switch (objectType) {
    case 'Wall': return 'Walls';
    case 'Door': return 'Doors';
    case 'Window': return 'Windows';
    case 'Floor': return 'Floors';
    case 'Roof': return 'Roofs';
    case 'Header/Beam': return 'Structural';
    default: return 'Other';
  }
}

export interface DerivedQMProps {
  objectType: string;
  group: string;
  wallType: 'Interior' | 'Exterior' | null;
  level: string;
  width: string | null;
  heightFt: number | null;
  renamedTo: string;
  confidence: number;
  // Keys of properties whose value the AI could not detect confidently and
  // therefore fell back to a default value. Possible keys: 'level', 'wallType',
  // 'width', 'height'.
  defaults: Set<string>;
}

// Derive synthetic construction properties from a measurement's name/type.
// Deterministic so the same measurement always yields the same values.
function deriveQMProps(m: MeasurementData): DerivedQMProps {
  const nameStr = m?.name ?? '';
  const typeStr = m?.type ?? 'area';
  const nameUp = nameStr.toUpperCase();

  let hash = 0;
  for (let i = 0; i < nameStr.length; i++) hash = (hash * 31 + nameStr.charCodeAt(i)) >>> 0;

  let objectType = 'General';
  let wallType: 'Interior' | 'Exterior' | null = null;
  let width: string | null = null;
  let heightFt: number | null = null;
  // Track properties where the value was not explicitly detectable from the plan
  // and the AI fell back to a default value.
  const defaults = new Set<string>();

  if (nameUp.includes('WALL') || nameUp.includes('WL') || (typeStr === 'linear' && !nameUp.includes('HEADER') && !nameUp.includes('BEAM'))) {
    objectType = 'Wall';
    wallType = nameUp.includes('EXT') ? 'Exterior' : 'Interior';
    if (!nameUp.includes('EXT') && !nameUp.includes('INT')) defaults.add('wallType');
    width = nameUp.includes('2X6') ? '2x6' : '2x4';
    if (!nameUp.includes('2X6') && !nameUp.includes('2X4')) defaults.add('width');
    heightFt = 8 + (hash % 3); // 8-10 ft (estimated)
    defaults.add('height');
  } else if (nameUp.includes('FLOOR') || nameUp.includes('FLR')) {
    objectType = 'Floor';
  } else if (nameUp.includes('ROOF') || nameUp.includes('RF')) {
    objectType = 'Roof';
  } else if (nameUp.includes('DOOR') || nameUp.includes('DR')) {
    objectType = 'Door';
    wallType = nameUp.includes('EXT') ? 'Exterior' : 'Interior';
    if (!nameUp.includes('EXT') && !nameUp.includes('INT')) defaults.add('wallType');
    heightFt = nameUp.includes('EXT') ? 8 : 6 + (hash % 2); // ~6-8 ft (estimated)
    defaults.add('height');
  } else if (nameUp.includes('WIN') || nameUp.includes('WN')) {
    objectType = 'Window';
    heightFt = 3 + (hash % 4); // 3-6 ft (estimated)
    defaults.add('height');
  } else if (nameUp.includes('HEADER') || nameUp.includes('HDR') || nameUp.includes('BEAM')) {
    objectType = 'Header/Beam';
  } else if (typeStr === 'area') {
    objectType = 'Area';
  } else if (typeStr === 'count') {
    objectType = 'Count Item';
  }

  let level = '1st Floor';
  let levelDetected = true;
  if (nameUp.includes('1F') || nameUp.includes('1ST')) level = '1st Floor';
  else if (nameUp.includes('2F') || nameUp.includes('2ND')) level = '2nd Floor';
  else if (nameUp.includes('3F') || nameUp.includes('3RD')) level = '3rd Floor';
  else if (nameUp.includes('BSMT') || nameUp.includes('BASE')) level = 'Basement';
  else if (objectType === 'Roof') level = 'Roof Level';
  else levelDetected = false;
  if (!levelDetected) defaults.add('level');

  const parts = nameStr.split('_').filter(Boolean);
  let renamedTo = '';
  if (parts.length >= 2) {
    renamedTo = parts.map(p => (p.match(/^\d/) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join('_');
    if (objectType === 'Wall') renamedTo = parts[0] + '_WI_' + parts.slice(1).join('_');
  }

  let conf = 0;
  for (let i = 0; i < nameStr.length; i++) conf += nameStr.charCodeAt(i);
  const confidence = 70 + (conf % 25);

  return { objectType, group: objectTypeToGroup(objectType), wallType, level, width, heightFt, renamedTo, confidence, defaults };
}

interface RightPanelProps {
  keyMeasures: KeyMeasureData[];
  activeKeyMeasureId: string | null;
  onSelectKeyMeasure: (id: string | null) => void;
  onRefreshKeyMeasures: () => Promise<void>;
  measurements: MeasurementData[];
  assignments: AssignmentData[];
  hoveredId: string | null;
  selectedIds: Set<string>;
  onHover: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectMany: (ids: string[], select: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAssign: (ids: string[], anchorRect?: DOMRect) => void;
  onDelete: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUpdateMeasurement: (id: string, updates: Partial<MeasurementData>) => void;
  onNewClick: () => void;
  assignHighlightId?: string | null;
  onAssignIconHover?: (id: string | null) => void;
  onAssignIconPin?: (id: string) => void;
}

export default function RightPanel({
  keyMeasures,
  activeKeyMeasureId,
  onSelectKeyMeasure,
  onRefreshKeyMeasures,
  measurements,
  assignments,
  hoveredId,
  selectedIds,
  assignHighlightId,
  onAssignIconHover,
  onAssignIconPin,
  onHover,
  onToggleVisibility,
  onToggleSelect,
  onToggleSelectMany,
  onSelectAll,
  onDeselectAll,
  onAssign,
  onDelete,
  onDuplicate,
  onRename,
  onUpdateMeasurement,
  onNewClick,
}: RightPanelProps) {
  return (
    <div data-right-panel className="w-[340px] min-w-[340px] bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 h-11 flex-shrink-0 border-b border-neutral-200 flex items-center gap-2">
        <span className="relative text-sm font-semibold text-neutral-900 flex-1 after:absolute after:-bottom-[13px] after:left-0 after:h-0.5 after:w-14 after:bg-neutral-900">
          Measures
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-neutral-900">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="text-xs cursor-pointer">Expand All</DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer">Collapse All</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer">Sort by Name</DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer">Sort by Category</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs using shadcn */}
      <Tabs defaultValue="km" className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 py-2 flex-shrink-0">
          <TabsList className="w-full h-9 p-1 bg-neutral-100 rounded-lg justify-stretch">
            <TabsTrigger
              value="km"
              className="flex-1 rounded-md text-xs font-medium text-neutral-500 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm"
            >
              Key Measures
            </TabsTrigger>
            <TabsTrigger
              value="qm"
              className="flex-1 rounded-md text-xs font-medium text-neutral-500 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm"
            >
              Quick Measures
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="km" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          <KMTab
            keyMeasures={keyMeasures}
            activeKeyMeasureId={activeKeyMeasureId}
            onSelectKeyMeasure={onSelectKeyMeasure}
            onRefreshKeyMeasures={onRefreshKeyMeasures}
          />
        </TabsContent>

        <TabsContent value="qm" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          <QMTab
            measurements={measurements}
            assignments={assignments}
            hoveredId={hoveredId}
            selectedIds={selectedIds}
            assignHighlightId={assignHighlightId}
            onAssignIconHover={onAssignIconHover}
            onAssignIconPin={onAssignIconPin}
            onHover={onHover}
            onToggleVisibility={onToggleVisibility}
            onToggleSelect={onToggleSelect}
            onToggleSelectMany={onToggleSelectMany}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
            onAssign={onAssign}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onRename={onRename}
            onUpdateMeasurement={onUpdateMeasurement}
            onNewClick={onNewClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== KM Tab ============== */
type DragInfo = { type: 'km'; id: string; cat: string; sub: string | null }
  | { type: 'subcategory'; name: string; cat: string }
  | { type: 'category'; name: string };

function KMTab({
  keyMeasures,
  activeKeyMeasureId,
  onSelectKeyMeasure,
  onRefreshKeyMeasures,
}: {
  keyMeasures: KeyMeasureData[];
  activeKeyMeasureId: string | null;
  onSelectKeyMeasure: (id: string | null) => void;
  onRefreshKeyMeasures: () => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    const cats = new Set<string>();
    (keyMeasures ?? []).forEach(km => cats.add(km.category || 'GENERAL'));
    return cats;
  });
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set());
  const [addSubModal, setAddSubModal] = useState<{ category: string } | null>(null);
  const [addSubName, setAddSubName] = useState('');
  const [moveKmModal, setMoveKmModal] = useState<{ km: KeyMeasureData; mode: 'move' | 'copy' } | null>(null);

  // DnD state
  const dragRef = useRef<DragInfo | null>(null);
  const [dropInfo, setDropInfo] = useState<{ key: string; pos: 'before' | 'after' | 'into' } | null>(null);
  const isSearching = searchQuery.trim().length > 0;

  // Ordered data from sortOrder
  const orderedData = useMemo(() => {
    const sorted = [...(keyMeasures ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const categories: string[] = [];
    const catSet = new Set<string>();
    const subcategories: Record<string, string[]> = {};
    const subSet: Record<string, Set<string>> = {};
    for (const km of sorted) {
      const cat = km.category || 'GENERAL';
      if (!catSet.has(cat)) { catSet.add(cat); categories.push(cat); subcategories[cat] = []; subSet[cat] = new Set(); }
      if (km.subcategory && !subSet[cat].has(km.subcategory)) { subSet[cat].add(km.subcategory); subcategories[cat].push(km.subcategory); }
    }
    return { categories, subcategories, sorted };
  }, [keyMeasures]);

  // Display data (filtered + ordered)
  const displayData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? orderedData.sorted.filter(km => km.name.toLowerCase().includes(q) || km.category.toLowerCase().includes(q) || (km.subcategory || '').toLowerCase().includes(q))
      : orderedData.sorted;
    const result: { category: string; subs: { name: string; items: KeyMeasureData[] }[]; loose: KeyMeasureData[] }[] = [];
    const catMap = new Map<string, typeof result[0]>();
    for (const cat of orderedData.categories) {
      const entry = { category: cat, subs: (orderedData.subcategories[cat] || []).map(s => ({ name: s, items: [] as KeyMeasureData[] })), loose: [] as KeyMeasureData[] };
      catMap.set(cat, entry);
    }
    for (const km of filtered) {
      const cat = km.category || 'GENERAL';
      let entry = catMap.get(cat);
      if (!entry) { entry = { category: cat, subs: [], loose: [] }; catMap.set(cat, entry); }
      if (km.subcategory) {
        let sub = entry.subs.find(s => s.name === km.subcategory);
        if (!sub) { sub = { name: km.subcategory, items: [] }; entry.subs.push(sub); }
        sub.items.push(km);
      } else { entry.loose.push(km); }
    }
    for (const cat of orderedData.categories) {
      const entry = catMap.get(cat);
      if (!entry) continue;
      entry.subs = entry.subs.filter(s => s.items.length > 0);
      if (entry.subs.length > 0 || entry.loose.length > 0) result.push(entry);
    }
    return result;
  }, [orderedData, searchQuery]);

  const allCategories = orderedData.categories;
  const subcategoriesFor = useCallback((cat: string) => orderedData.subcategories[cat] || [], [orderedData]);
  const toggleCategory = (cat: string) => setCollapsedCategories(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  const toggleSub = (key: string) => setCollapsedSubs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // API helpers
  const apiCall = async (method: string, body?: any, query?: string) => {
    const url = '/api/key-measures' + (query ? `?${query}` : '');
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    await onRefreshKeyMeasures();
  };
  const batchReorder = async (updates: { id: string; sortOrder: number; category?: string; subcategory?: string | null }[]) => {
    await fetch('/api/key-measures', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
    await onRefreshKeyMeasures();
  };

  // ─── DnD Handlers ───
  const startDrag = (e: React.DragEvent, info: DragInfo) => {
    if (isSearching) { e.preventDefault(); return; }
    dragRef.current = info;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };
  const endDrag = (e: React.DragEvent) => {
    dragRef.current = null;
    setDropInfo(null);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };
  const clearDrop = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropInfo(null);
  };
  const onDragOverCat = (e: React.DragEvent, catName: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = dragRef.current;
    if (!d) return;
    if (d.type === 'category' && d.name === catName) return;
    e.dataTransfer.dropEffect = 'move';
    if (d.type === 'category') {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropInfo({ key: `cat-${catName}`, pos: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
    } else {
      setDropInfo({ key: `cat-${catName}`, pos: 'into' });
    }
  };
  const onDragOverSub = (e: React.DragEvent, catName: string, subName: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = dragRef.current;
    if (!d) return;
    if (d.type === 'subcategory' && d.name === subName && d.cat === catName) return;
    e.dataTransfer.dropEffect = 'move';
    if (d.type === 'subcategory') {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropInfo({ key: `sub-${catName}::${subName}`, pos: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
    } else {
      setDropInfo({ key: `sub-${catName}::${subName}`, pos: 'into' });
    }
  };
  const onDragOverKm = (e: React.DragEvent, kmId: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = dragRef.current;
    if (!d || d.type !== 'km' || d.id === kmId) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropInfo({ key: `km-${kmId}`, pos: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
  };

  // ─── Drop Handlers ───
  const handleDropOnCat = async (e: React.DragEvent, targetCat: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = dragRef.current;
    const curDropInfo = dropInfo;
    dragRef.current = null; setDropInfo(null);
    if (!d) return;
    if (d.type === 'km') {
      await apiCall('PUT', { id: d.id, category: targetCat, subcategory: null });
    } else if (d.type === 'subcategory') {
      if (d.cat === targetCat) return;
      const subKms = (keyMeasures ?? []).filter(km => (km.category || 'GENERAL') === d.cat && km.subcategory === d.name);
      await batchReorder(subKms.map((km, i) => ({ id: km.id, sortOrder: km.sortOrder ?? i, category: targetCat })));
    } else if (d.type === 'category' && d.name !== targetCat) {
      const cats = orderedData.categories.filter(c => c !== d.name);
      const idx = cats.indexOf(targetCat);
      const pos = curDropInfo?.pos === 'before' ? idx : idx + 1;
      cats.splice(pos >= 0 ? pos : cats.length, 0, d.name);
      const updates: { id: string; sortOrder: number }[] = [];
      let order = 0;
      for (const cat of cats) {
        const catKms = (keyMeasures ?? []).filter(km => (km.category || 'GENERAL') === cat).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        for (const km of catKms) updates.push({ id: km.id, sortOrder: order++ });
      }
      await batchReorder(updates);
    }
  };
  const handleDropOnSub = async (e: React.DragEvent, targetCat: string, targetSub: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = dragRef.current;
    const curDropInfo = dropInfo;
    dragRef.current = null; setDropInfo(null);
    if (!d) return;
    if (d.type === 'km') {
      await apiCall('PUT', { id: d.id, category: targetCat, subcategory: targetSub });
    } else if (d.type === 'subcategory') {
      if (d.name === targetSub && d.cat === targetCat) return;
      if (d.cat === targetCat) {
        // Reorder subcategories within category
        const subs = [...(orderedData.subcategories[targetCat] || [])].filter(s => s !== d.name);
        const idx = subs.indexOf(targetSub);
        const pos = curDropInfo?.pos === 'before' ? idx : idx + 1;
        subs.splice(pos >= 0 ? pos : subs.length, 0, d.name);
        const updates: { id: string; sortOrder: number }[] = [];
        let order = Math.min(...(keyMeasures ?? []).filter(km => (km.category || 'GENERAL') === targetCat).map(km => km.sortOrder ?? 0));
        if (!isFinite(order)) order = 0;
        for (const sub of subs) {
          const subKms = (keyMeasures ?? []).filter(km => (km.category || 'GENERAL') === targetCat && km.subcategory === sub).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          for (const km of subKms) updates.push({ id: km.id, sortOrder: order++ });
        }
        const loose = (keyMeasures ?? []).filter(km => (km.category || 'GENERAL') === targetCat && !km.subcategory).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        for (const km of loose) updates.push({ id: km.id, sortOrder: order++ });
        await batchReorder(updates);
      } else {
        // Move subcategory to different category
        const subKms = (keyMeasures ?? []).filter(km => (km.category || 'GENERAL') === d.cat && km.subcategory === d.name);
        await batchReorder(subKms.map((km, i) => ({ id: km.id, sortOrder: km.sortOrder ?? i, category: targetCat })));
      }
    }
  };
  const handleDropOnKm = async (e: React.DragEvent, targetKm: KeyMeasureData) => {
    e.preventDefault(); e.stopPropagation();
    const d = dragRef.current;
    const curDropInfo = dropInfo;
    if (!d || d.type !== 'km' || d.id === targetKm.id) { dragRef.current = null; setDropInfo(null); return; }
    dragRef.current = null; setDropInfo(null);
    const targetCat = targetKm.category || 'GENERAL';
    const targetSub = targetKm.subcategory || null;
    const groupKms = (keyMeasures ?? [])
      .filter(km => (km.category || 'GENERAL') === targetCat && (km.subcategory || null) === targetSub && km.id !== d.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const targetIdx = groupKms.findIndex(km => km.id === targetKm.id);
    const insertIdx = curDropInfo?.pos === 'before' ? targetIdx : targetIdx + 1;
    const dragKm = (keyMeasures ?? []).find(km => km.id === d.id);
    if (!dragKm) return;
    groupKms.splice(insertIdx < 0 ? 0 : insertIdx, 0, dragKm);
    const base = Math.min(...groupKms.map(km => km.sortOrder ?? 0));
    const updates = groupKms.map((km, i) => ({
      id: km.id, sortOrder: (isFinite(base) ? base : 0) + i,
      ...(km.id === d.id ? { category: targetCat, subcategory: targetSub } : {}),
    }));
    await batchReorder(updates);
  };

  // Drop indicator classes
  const dropCls = (key: string) => {
    if (!dropInfo || dropInfo.key !== key) return '';
    if (dropInfo.pos === 'into') return 'bg-blue-50 ring-1 ring-inset ring-blue-300';
    if (dropInfo.pos === 'before') return 'border-t-2 border-blue-500';
    return 'border-b-2 border-blue-500';
  };

  // Render KM row
  const renderKMRow = (km: KeyMeasureData, indent: number) => {
    const isActive = activeKeyMeasureId === km.id;
    return (
      <div
        key={km.id}
        draggable={!isSearching}
        onDragStart={e => startDrag(e, { type: 'km', id: km.id, cat: km.category || 'GENERAL', sub: km.subcategory || null })}
        onDragEnd={endDrag}
        onDragOver={e => onDragOverKm(e, km.id)}
        onDragLeave={clearDrop}
        onDrop={e => handleDropOnKm(e, km)}
        className={`group flex items-center gap-1 pr-1 py-1 text-xs transition-colors cursor-default ${
          isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
        } ${dropCls(`km-${km.id}`)}`}
        style={{ paddingLeft: `${indent}px` }}
      >
        <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-60 flex-shrink-0 cursor-grab" />
        <button onClick={() => onSelectKeyMeasure(isActive ? null : km.id)} className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ backgroundColor: km.color }} />
          {km.type === 'area' && <Square className="w-3 h-3 flex-shrink-0 text-gray-400" />}
          {km.type === 'linear' && <Minus className="w-3 h-3 flex-shrink-0 text-gray-400" />}
          {km.type === 'count' && <Circle className="w-3 h-3 flex-shrink-0 text-gray-400" />}
          <span className="truncate font-mono text-[11px]">{km.name}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 flex-shrink-0"><MoreHorizontal className="w-3.5 h-3.5 text-gray-400" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={() => setMoveKmModal({ km, mode: 'move' })}><ArrowRightLeft className="w-3.5 h-3.5" /> Move to…</DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={() => setMoveKmModal({ km, mode: 'copy' })}><Copy className="w-3.5 h-3.5" /> Copy to…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer gap-2 text-red-600" onClick={() => apiCall('DELETE', undefined, `id=${km.id}`)}><Trash2 className="w-3.5 h-3.5" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <Input type="text" placeholder="Search ..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 pl-8 text-xs" />
        </div>
      </div>

      {/* Accordion */}
      <div className="flex-1 overflow-y-auto">
        {displayData.length === 0 ? (
          <div className="px-3 py-8 text-center"><p className="text-xs text-gray-400">No key measures found.</p></div>
        ) : displayData.map(({ category, subs, loose }) => {
          const isCatCollapsed = collapsedCategories.has(category);
          const totalCount = loose.length + subs.reduce((s, sub) => s + sub.items.length, 0);
          return (
            <div key={category} className="border-b border-gray-100">
              {/* Category header */}
              <div
                draggable={!isSearching}
                onDragStart={e => startDrag(e, { type: 'category', name: category })}
                onDragEnd={endDrag}
                onDragOver={e => onDragOverCat(e, category)}
                onDragLeave={clearDrop}
                onDrop={e => handleDropOnCat(e, category)}
                className={`group flex items-center hover:bg-gray-50 transition-colors ${dropCls(`cat-${category}`)}`}
              >
                <GripVertical className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-60 flex-shrink-0 cursor-grab" />
                <button onClick={() => toggleCategory(category)} className="flex-1 flex items-center gap-1.5 px-1 py-2 text-xs">
                  {isCatCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="font-semibold text-gray-600 uppercase tracking-wider text-[11px]">{category}</span>
                  <span className="ml-auto text-[10px] text-gray-400 font-mono">{totalCount}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-0 group-hover:opacity-100 p-0.5 mr-2 rounded hover:bg-gray-200 flex-shrink-0"><MoreHorizontal className="w-3.5 h-3.5 text-gray-400" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={() => { setAddSubModal({ category }); setAddSubName(''); }}><FolderPlus className="w-3.5 h-3.5" /> Add Subcategory</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {!isCatCollapsed && (
                <div className="pb-0.5">
                  {/* Subcategory folders */}
                  {subs.map(({ name: subName, items: subItems }) => {
                    const subKey = `${category}::${subName}`;
                    const isSubCollapsed = collapsedSubs.has(subKey);
                    return (
                      <div key={subKey}>
                        <div
                          draggable={!isSearching}
                          onDragStart={e => startDrag(e, { type: 'subcategory', name: subName, cat: category })}
                          onDragEnd={endDrag}
                          onDragOver={e => onDragOverSub(e, category, subName)}
                          onDragLeave={clearDrop}
                          onDrop={e => handleDropOnSub(e, category, subName)}
                          className={`group flex items-center hover:bg-gray-50/80 transition-colors ${dropCls(`sub-${subKey}`)}`}
                        >
                          <GripVertical className="w-3 h-3 ml-4 text-gray-300 opacity-0 group-hover:opacity-60 flex-shrink-0 cursor-grab" />
                          <button onClick={() => toggleSub(subKey)} className="flex-1 flex items-center gap-1.5 pl-1 pr-3 py-1.5 text-xs">
                            {isSubCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                            <FolderOpen className="w-3 h-3 text-amber-500" />
                            <span className="font-medium text-gray-500 text-[11px]">{subName}</span>
                            <span className="ml-auto text-[10px] text-gray-400 font-mono">{subItems.length}</span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="opacity-0 group-hover:opacity-100 p-0.5 mr-2 rounded hover:bg-gray-200 flex-shrink-0"><MoreHorizontal className="w-3 h-3 text-gray-400" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs gap-2"><ArrowRightLeft className="w-3.5 h-3.5" /> Move to Category</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-44">
                                  {allCategories.filter(c => c !== category).map(c => (
                                    <DropdownMenuItem key={c} className="text-xs cursor-pointer" onClick={async () => {
                                      for (const km of subItems) await fetch('/api/key-measures', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: km.id, category: c }) });
                                      await onRefreshKeyMeasures();
                                    }}>{c}</DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {!isSubCollapsed && subItems.map(km => renderKMRow(km, 40))}
                      </div>
                    );
                  })}
                  {/* Loose KMs */}
                  {loose.map(km => renderKMRow(km, 24))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Subcategory Modal */}
      {addSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAddSubModal(null)}>
          <div className="bg-white rounded-lg shadow-xl p-4 w-72" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-700">Add Subcategory to {addSubModal.category}</h4>
              <button onClick={() => setAddSubModal(null)} className="p-0.5 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5 text-gray-400" /></button>
            </div>
            <Input autoFocus placeholder="Subcategory name" value={addSubName} onChange={e => setAddSubName(e.target.value)} className="h-8 text-xs mb-3" onKeyDown={e => {
              if (e.key === 'Enter' && addSubName.trim()) {
                apiCall('POST', { name: `New ${addSubName.trim()} Item`, category: addSubModal.category, subcategory: addSubName.trim(), type: 'count', color: '#94a3b8' });
                setAddSubModal(null);
              }
            }} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddSubModal(null)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" disabled={!addSubName.trim()} onClick={() => {
                apiCall('POST', { name: `New ${addSubName.trim()} Item`, category: addSubModal.category, subcategory: addSubName.trim(), type: 'count', color: '#94a3b8' });
                setAddSubModal(null);
              }}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Move/Copy KM Modal */}
      {moveKmModal && (
        <KMPickerModal
          title={moveKmModal.mode === 'move' ? `Move "${moveKmModal.km.name}"` : `Copy "${moveKmModal.km.name}"`}
          allCategories={allCategories}
          subcategoriesFor={subcategoriesFor}
          onClose={() => setMoveKmModal(null)}
          onSelect={async (targetCat, targetSub) => {
            if (moveKmModal.mode === 'move') {
              await apiCall('PUT', { id: moveKmModal.km.id, category: targetCat, subcategory: targetSub || null });
            } else {
              await apiCall('POST', { copyFromId: moveKmModal.km.id, category: targetCat, subcategory: targetSub || null });
            }
            setMoveKmModal(null);
          }}
        />
      )}
    </div>
  );
}

/* ===== Category/Subcategory Picker Modal ===== */
function KMPickerModal({ title, allCategories, subcategoriesFor, onClose, onSelect }: {
  title: string;
  allCategories: string[];
  subcategoriesFor: (cat: string) => string[];
  onClose: () => void;
  onSelect: (category: string, subcategory: string | null) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-4 w-72 max-h-80 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-700 truncate">{title}</h4>
          <button onClick={onClose} className="p-0.5 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {!selectedCat ? (
            // Step 1: pick category
            <>
              <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Select Category</p>
              {allCategories.map(cat => (
                <button key={cat} onClick={() => {
                  const subs = subcategoriesFor(cat);
                  if (subs.length > 0) { setSelectedCat(cat); } else { onSelect(cat, null); }
                }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <span className="font-mono text-[11px]">{cat}</span>
                </button>
              ))}
            </>
          ) : (
            // Step 2: pick subcategory or root
            <>
              <button onClick={() => setSelectedCat(null)} className="text-[10px] text-blue-600 hover:underline mb-1">← Back</button>
              <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{selectedCat}</p>
              <button onClick={() => onSelect(selectedCat, null)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded transition-colors font-mono text-[11px]">
                (Root — no subcategory)
              </button>
              {subcategoriesFor(selectedCat).map(sub => (
                <button key={sub} onClick={() => onSelect(selectedCat, sub)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded transition-colors flex items-center gap-2">
                  <FolderOpen className="w-3 h-3 text-amber-500" />
                  <span className="font-mono text-[11px]">{sub}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== QM Tab ============== */
function QMTab({
  measurements,
  assignments,
  hoveredId,
  selectedIds,
  onHover,
  onToggleVisibility,
  onToggleSelect,
  onToggleSelectMany,
  onSelectAll,
  onDeselectAll,
  onAssign,
  onDelete,
  onDuplicate,
  onRename,
  onUpdateMeasurement,
  onNewClick,
  assignHighlightId,
  onAssignIconHover,
  onAssignIconPin,
}: {
  measurements: MeasurementData[];
  assignments: AssignmentData[];
  hoveredId: string | null;
  selectedIds: Set<string>;
  assignHighlightId?: string | null;
  onAssignIconHover?: (id: string | null) => void;
  onAssignIconPin?: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectMany: (ids: string[], select: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAssign: (ids: string[], anchorRect?: DOMRect) => void;
  onDelete: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUpdateMeasurement: (id: string, updates: Partial<MeasurementData>) => void;
  onNewClick: () => void;
}) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedQMId, setInspectedQMId] = useState<string | null>(null);

  /* ---------- Grouping state ---------- */
  const [groupBy, setGroupBy] = useState<GroupByType>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [customGroups, setCustomGroups] = useState<{ id: string; name: string }[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  /* ---------- Advanced property filter state ---------- */
  const [filterOpen, setFilterOpen] = useState(false);
  const [objTypeFilter, setObjTypeFilter] = useState<Set<string>>(new Set());
  const [wallTypeFilter, setWallTypeFilter] = useState<'any' | 'Interior' | 'Exterior'>('any');
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set());
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');

  const toggleSetValue = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const clearAdvancedFilters = () => {
    setObjTypeFilter(new Set());
    setWallTypeFilter('any');
    setLevelFilter(new Set());
    setMinHeight('');
    setMaxHeight('');
  };

  const minH = minHeight.trim() === '' ? null : parseFloat(minHeight);
  const maxH = maxHeight.trim() === '' ? null : parseFloat(maxHeight);
  const advancedActive = objTypeFilter.size > 0 || wallTypeFilter !== 'any' || levelFilter.size > 0 || minH != null || maxH != null;
  const activeFilterCount =
    (filter !== 'all' ? 1 : 0) +
    objTypeFilter.size +
    (wallTypeFilter !== 'any' ? 1 : 0) +
    levelFilter.size +
    (minH != null || maxH != null ? 1 : 0);

  // Persist custom groups in localStorage (prototype-friendly)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('qm-custom-groups');
      if (raw) setCustomGroups(JSON.parse(raw));
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem('qm-custom-groups', JSON.stringify(customGroups));
    } catch {}
  }, [customGroups]);

  const safeSelectedIds = selectedIds ?? new Set<string>();

  /* Build map: measurementId → list of assigned KM names */
  const assignedKMMap: Record<string, { assignmentId: string; kmName: string }[]> = {};
  (assignments ?? []).forEach((a: AssignmentData) => {
    const mId = a?.measurementId ?? '';
    if (!assignedKMMap[mId]) assignedKMMap[mId] = [];
    assignedKMMap[mId].push({ assignmentId: a?.id ?? '', kmName: a?.keyMeasure?.name ?? 'Unknown' });
  });

  /* Set of measurementIds that have at least one assignment (for grouping) */
  const assignedMeasIds = useMemo(() => {
    const s = new Set<string>();
    (assignments ?? []).forEach((a: AssignmentData) => {
      if (a?.measurementId) s.add(a.measurementId);
    });
    return s;
  }, [assignments]);

  const filtered = useMemo(() => {
    return (measurements ?? []).filter((m: MeasurementData) => {
      if (filter !== 'all' && m?.type !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!m?.name?.toLowerCase()?.includes(q)) return false;
      }
      // Advanced property filters
      if (advancedActive) {
        const p = deriveQMProps(m);
        if (objTypeFilter.size > 0 && !objTypeFilter.has(p.objectType)) return false;
        if (wallTypeFilter !== 'any' && p.wallType !== wallTypeFilter) return false;
        if (levelFilter.size > 0 && !levelFilter.has(p.level)) return false;
        if (minH != null || maxH != null) {
          if (p.heightFt == null) return false;
          if (minH != null && p.heightFt < minH) return false;
          if (maxH != null && p.heightFt > maxH) return false;
        }
      }
      return true;
    });
  }, [measurements, filter, searchQuery, advancedActive, objTypeFilter, wallTypeFilter, levelFilter, minH, maxH]);

  const hasSelected = safeSelectedIds?.size > 0;

  /* ---------- Grouping computation ---------- */
  // Determine which group key an item belongs to for the active groupBy
  const itemGroupKey = useCallback((m: MeasurementData): string => {
    if (groupBy === 'type') return m?.type ?? 'area';
    if (groupBy === 'object') return deriveQMProps(m).group;
    if (groupBy === 'assignment') return assignedMeasIds.has(m?.id ?? '') ? 'assigned' : 'unassigned';
    if (groupBy === 'source') return m?.isAI ? 'auto' : 'manual';
    if (groupBy === 'visibility') return m?.visible !== false ? 'visible' : 'hidden';
    if (groupBy === 'group') {
      const gid = m?.groupId ?? null;
      if (gid && customGroups.some((g) => g.id === gid)) return gid;
      return 'ungrouped';
    }
    return 'all';
  }, [groupBy, customGroups, assignedMeasIds]);

  // Ordered list of groups to render: { key, label }
  const groupDefs = useMemo<{ key: string; label: string }[]>(() => {
    if (groupBy === 'type') {
      return [
        { key: 'area', label: 'Area' },
        { key: 'linear', label: 'Linear' },
        { key: 'count', label: 'Count' },
      ];
    }
    if (groupBy === 'object') {
      // Only show object groups that actually contain items, in canonical order
      const present = new Set((filtered ?? []).map((m) => deriveQMProps(m).group));
      return OBJECT_GROUP_ORDER.filter((g) => present.has(g)).map((g) => ({ key: g, label: g }));
    }
    if (groupBy === 'assignment') {
      return [
        { key: 'assigned', label: 'Assigned' },
        { key: 'unassigned', label: 'Unassigned' },
      ];
    }
    if (groupBy === 'source') {
      return [
        { key: 'auto', label: 'Auto-Takeoff' },
        { key: 'manual', label: 'Manual' },
      ];
    }
    if (groupBy === 'visibility') {
      return [
        { key: 'visible', label: 'Shown' },
        { key: 'hidden', label: 'Hidden' },
      ];
    }
    if (groupBy === 'group') {
      return [
        ...customGroups.map((g) => ({ key: g.id, label: g.name })),
        { key: 'ungrouped', label: 'Ungrouped' },
      ];
    }
    return [];
  }, [groupBy, customGroups, filtered]);

  // Map: groupKey -> measurements
  const grouped = useMemo(() => {
    const map: Record<string, MeasurementData[]> = {};
    groupDefs.forEach((g) => { map[g.key] = []; });
    (filtered ?? []).forEach((m) => {
      const k = itemGroupKey(m);
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    return map;
  }, [filtered, groupDefs, itemGroupKey]);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addCustomGroup = () => {
    const name = newGroupName.trim();
    if (!name) { setAddingGroup(false); setNewGroupName(''); return; }
    setCustomGroups((prev) => [...prev, { id: `grp_${Date.now()}`, name }]);
    setNewGroupName('');
    setAddingGroup(false);
  };

  // Apply the drop: move dragged measurement into the target group
  const handleDropOnGroup = (groupKey: string) => {
    const id = dragId;
    setDragId(null);
    setDragOverKey(null);
    if (!id) return;
    const m = (measurements ?? []).find((x) => x?.id === id);
    if (!m) return;
    if (groupBy === 'type') {
      if (m.type !== groupKey) {
        onUpdateMeasurement?.(id, { type: groupKey as MeasurementData['type'], unit: unitForType(groupKey) });
      }
    } else if (groupBy === 'visibility') {
      const wantVisible = groupKey === 'visible';
      if ((m.visible !== false) !== wantVisible) {
        onUpdateMeasurement?.(id, { visible: wantVisible });
      }
    } else if (groupBy === 'group') {
      const newGroupId = groupKey === 'ungrouped' ? null : groupKey;
      if ((m.groupId ?? null) !== newGroupId) {
        onUpdateMeasurement?.(id, { groupId: newGroupId });
      }
    }
  };

  const typeIcon = (type: string, color: string) => {
    const iconClass = 'w-3.5 h-3.5 flex-shrink-0';
    switch (type) {
      case 'area': return <Square className={iconClass} style={{ color }} />;
      case 'linear': return <Minus className={iconClass} style={{ color }} />;
      case 'count': return <Circle className={iconClass} style={{ color }} />;
      default: return <Square className={iconClass} style={{ color }} />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'area': return 'AREA';
      case 'linear': return 'LINEAR';
      case 'count': return 'COUNT';
      default: return 'AREA';
    }
  };

  // Render a single QM row, wrapped in a draggable container when grouping is active
  const renderRow = (m: MeasurementData) => {
    const isSelected = safeSelectedIds?.has?.(m?.id ?? '');
    const isHovered = hoveredId === m?.id;
    const assignedKMs = assignedKMMap[m?.id ?? ''] ?? [];
    const hasAssign = assignedKMs.length > 0;
    const isAssignActive = !!assignHighlightId && assignHighlightId === m?.id;
    // Only type / visibility / custom-group can be reassigned via drag-and-drop
    const draggable = groupBy === 'type' || groupBy === 'visibility' || groupBy === 'group';

    const row = (
      <QMRow
        m={m}
        isSelected={isSelected}
        isHovered={isHovered}
        isInspected={inspectedQMId === m?.id}
        hasAssign={hasAssign}
        assignedKMs={assignedKMs}
        isAssignActive={isAssignActive}
        typeIcon={typeIcon}
        typeLabel={typeLabel}
        onHover={onHover}
        onToggleSelect={onToggleSelect}
        onToggleVisibility={onToggleVisibility}
        onAssign={onAssign}
        onDelete={onDelete}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onAssignIconClick={(id) => onAssignIconPin?.(id)}
        onAssignIconHover={onAssignIconHover}
        onInspect={(id) => setInspectedQMId(inspectedQMId === id ? null : id)}
        onUpdateMeasurement={onUpdateMeasurement}
        draggable={draggable}
      />
    );

    if (!draggable) return <div key={m?.id}>{row}</div>;

    return (
      <div
        key={m?.id}
        draggable
        onDragStart={(e) => { setDragId(m?.id ?? null); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => { setDragId(null); setDragOverKey(null); }}
        className={dragId === m?.id ? 'opacity-40' : ''}
      >
        {row}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search bar + filter icon */}
      <div className="px-2 py-1.5 border-b border-gray-100 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterOpen((o) => !o)}
          className={`h-7 px-1.5 flex-shrink-0 relative ${activeFilterCount > 0 || filterOpen ? 'border-blue-400 bg-blue-50 text-blue-600' : ''}`}
          title="Filter measurements"
        >
          <Filter className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span className="ml-1 text-[10px] font-bold min-w-[14px] h-[14px] px-1 rounded-full bg-blue-600 text-white flex items-center justify-center">{activeFilterCount}</span>
          )}
        </Button>

        {/* Group-by selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 w-7 p-0 flex-shrink-0 ${groupBy !== 'none' ? 'border-blue-400 bg-blue-50 text-blue-600' : ''}`}
              title={`Group by: ${GROUP_BY_LABELS[groupBy]}`}
            >
              <Layers className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Group By</div>
            {(['none', 'type', 'object', 'assignment', 'source', 'group'] as GroupByType[]).map((g) => (
              <DropdownMenuItem
                key={g}
                onClick={() => setGroupBy(g)}
                className={`text-xs cursor-pointer ${groupBy === g ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
              >
                {GROUP_BY_LABELS[g]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Multi-select Actions Bar */}
      {hasSelected && (
        <div className="px-2 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <button
            onClick={onDeselectAll}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
          >
            Clear Selection ({safeSelectedIds?.size ?? 0})
          </button>
          <div className="flex-1" />
          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onAssign?.([...safeSelectedIds], rect);
            }}
            className="text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded transition-colors"
          >
            Assign Selected
          </button>
        </div>
      )}

      {/* Measurement List */}
      <div className="flex-1 overflow-y-auto">
        {(filtered ?? []).length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-gray-400">No quick measures found.</p>
          </div>
        ) : groupBy === 'none' ? (
          (filtered ?? []).map((m: MeasurementData) => renderRow(m))
        ) : (
          <>
            {groupDefs.map((g) => {
              const items = grouped[g.key] ?? [];
              const isCollapsed = collapsedGroups.has(g.key);
              const isDropTarget = dragOverKey === g.key;
              const groupItemIds = items.map((m) => m?.id ?? '').filter(Boolean);
              const allGroupSelected = groupItemIds.length > 0 && groupItemIds.every((id) => safeSelectedIds.has(id));
              const someGroupSelected = !allGroupSelected && groupItemIds.some((id) => safeSelectedIds.has(id));
              return (
                <div
                  key={g.key}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverKey !== g.key) setDragOverKey(g.key); }}
                  onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOverKey((k) => (k === g.key ? null : k)); }}
                  onDrop={(e) => { e.preventDefault(); handleDropOnGroup(g.key); }}
                  className={`border-b border-gray-100 ${isDropTarget ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-300' : ''}`}
                >
                  {/* Group header */}
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 sticky top-0 z-10 cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    onClick={() => toggleGroupCollapse(g.key)}
                  >
                    {groupItemIds.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allGroupSelected}
                        ref={(el) => { if (el) el.indeterminate = someGroupSelected; }}
                        onChange={(e) => { e.stopPropagation(); onToggleSelectMany(groupItemIds, !allGroupSelected); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                        title={allGroupSelected ? 'Deselect all in group' : 'Select all in group'}
                      />
                    )}
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    {groupBy === 'type' && typeIcon(g.key, '#6b7280')}
                    {groupBy === 'visibility' && (g.key === 'visible' ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />)}
                    {groupBy === 'group' && <FolderOpen className="w-3.5 h-3.5 text-gray-500" />}
                    <span className="text-[11px] font-semibold text-gray-700 truncate">{g.label}</span>
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-200/70 rounded-full px-1.5 py-px">{items.length}</span>
                    {isDropTarget && <span className="ml-auto text-[10px] font-semibold text-blue-600">Drop here</span>}
                  </div>
                  {/* Group body */}
                  {!isCollapsed && (
                    <div className="min-h-[4px]">
                      {items.length === 0 ? (
                        <div className="px-3 py-3 text-center">
                          <p className="text-[10px] text-gray-300">Drag items here</p>
                        </div>
                      ) : (
                        items.map((m) => renderRow(m))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add custom group */}
            {groupBy === 'group' && (
              <div className="px-2 py-2">
                {addingGroup ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onBlur={addCustomGroup}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCustomGroup(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName(''); } }}
                      placeholder="Group name..."
                      className="h-6 text-[11px] px-1.5"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingGroup(true)}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Group
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Measure Properties Panel */}
      {inspectedQMId && (() => {
        const inspected = (measurements ?? []).find((m) => m?.id === inspectedQMId);
        if (!inspected || !inspected.isAI) return null;
        return (
          <QMPropertiesPanel
            key={inspected.id}
            m={inspected}
            onClose={() => setInspectedQMId(null)}
            onUpdateMeasurement={onUpdateMeasurement}
          />
        );
      })()}
    </div>
  );
}

/* ============== Editable Property Row ============== */
function EditableProp({
  label,
  initial,
  options,
  mono = false,
  underline = false,
  isDefault = false,
  hideLabel = false,
  size = 'sm',
  onCommit,
}: {
  label: string;
  initial: string;
  options?: string[];
  mono?: boolean;
  underline?: boolean;
  isDefault?: boolean;
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  onCommit?: (value: string) => void;
}) {
  const [original] = useState(initial);
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const edited = value.trim() !== original.trim();

  const commit = () => {
    const v = draft.trim();
    if (v) {
      if (v !== value) onCommit?.(v);
      setValue(v);
    } else {
      setDraft(value);
    }
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };
  const beginEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const md = size === 'md';
  const valueSize = md ? 'text-[13px]' : 'text-[11px]';
  const inputSize = md ? 'h-7 w-full text-[13px]' : 'h-6 w-32 text-[11px]';

  return (
    <div className={`flex items-center gap-2 group ${md ? 'w-full min-w-0' : ''}`}>
      {!hideLabel && (
        <span className="text-[10px] text-gray-400 font-medium w-24 flex-shrink-0">{label}</span>
      )}
      {editing ? (
        options ? (
          <select
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
            className="h-6 text-[11px] border border-blue-300 rounded px-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            className={`${inputSize} border border-blue-300 rounded px-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 ${mono ? 'font-mono' : ''}`}
          />
        )
      ) : (
        <div className={`flex items-center gap-1.5 min-w-0 ${md ? 'flex-1' : ''}`}>
          {edited && (
            <span className={`text-[11px] text-gray-400 line-through ${mono ? 'font-mono' : ''} truncate`}>{original}</span>
          )}
          {/* The value itself is the primary click target for editing. */}
          <button
            type="button"
            onClick={beginEdit}
            title={`Click to edit ${label}`}
            className={`text-left ${valueSize} truncate cursor-text ${mono ? 'font-mono' : ''} ${
              edited
                ? 'text-emerald-600 font-semibold'
                : `${md ? 'text-gray-900 font-semibold' : 'text-gray-700 font-medium'} ${underline ? 'group-hover:underline group-hover:underline-offset-2 group-hover:decoration-dotted' : ''}`
            }`}
          >
            {value}
          </button>
          {isDefault && !edited && (
            <span
              title="Default value — the AI could not detect this with enough confidence, so a default was applied"
              className="flex-shrink-0 text-[8px] font-semibold uppercase tracking-wide leading-none px-1 py-[2px] rounded-sm bg-amber-50 text-amber-600 border border-amber-200"
            >
              Default
            </span>
          )}
          <button
            onClick={beginEdit}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 transition-opacity flex-shrink-0"
            title={`Edit ${label}`}
          >
            <Pencil className="w-2.5 h-2.5 text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
}

/* Measurement color palette (shared with the New Measurement modal). */
const QM_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1'];

/* ============== QM Properties Panel ============== */
function QMPropertiesPanel({ m, onClose, onUpdateMeasurement }: { m: MeasurementData; onClose: () => void; onUpdateMeasurement?: (id: string, updates: Partial<MeasurementData>) => void }) {
  // Generate synthetic construction properties from measurement data (shared helper)
  const props = useMemo(() => deriveQMProps(m), [m]);

  const typeStr = m?.type ?? 'area';
  const valueLabel = typeStr === 'linear' ? 'Length' : typeStr === 'area' ? 'Area' : 'Count';
  // Prefer the stored confidence value (falls back to the derived estimate).
  const confidence = typeof m?.confidence === 'number' ? m.confidence : props.confidence;
  // Mark this Quick Measure as edited (used to turn its AI star green in the list).
  const markEdited = (extra: Partial<MeasurementData> = {}) => onUpdateMeasurement?.(m?.id ?? '', { edited: true, ...extra });
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <Sparkles className={`w-3.5 h-3.5 ${m?.edited ? 'text-emerald-500' : 'text-gray-900'}`} />
          <span className="text-xs font-semibold text-gray-800">Quick Measure Properties</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-gray-200 transition-colors"
          title="Close properties"
        >
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Properties Grid */}
      <div className="px-3 py-2 space-y-1.5 max-h-[260px] overflow-y-auto">
        {/* Name */}
        <EditableProp
          label="Name"
          initial={m?.name ?? ''}
          underline
          onCommit={(v) => markEdited({ name: v })}
        />

        {/* Measurement Type */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-medium w-24 flex-shrink-0">Measurement</span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-700 font-medium capitalize">{typeStr}</span>
            {typeStr === 'linear' && <Minus className="w-3 h-3 text-gray-500" />}
            {typeStr === 'area' && <Square className="w-3 h-3 text-gray-500" />}
            {typeStr === 'count' && <Circle className="w-3 h-3 text-gray-500" />}
          </div>
        </div>

        {/* Value */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-medium w-24 flex-shrink-0">{valueLabel}</span>
          <span className="text-[11px] text-gray-700 font-medium">{formatValue(m?.value ?? 0, typeStr)} {m?.unit ?? ''}</span>
        </div>

        {/* Color — click the swatch to pick a new measurement color */}
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] text-gray-400 font-medium w-24 flex-shrink-0">Color</span>
          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setColorOpen((o) => !o)}
              title="Click to change color"
              className="w-4 h-4 rounded border border-black/10 hover:ring-2 hover:ring-blue-300 transition-shadow flex-shrink-0"
              style={{ backgroundColor: m?.color ?? '#999' }}
            />
            <button
              type="button"
              onClick={() => setColorOpen((o) => !o)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 transition-opacity flex-shrink-0"
              title="Edit Color"
            >
              <Pencil className="w-2.5 h-2.5 text-gray-400" />
            </button>
            {colorOpen && (
              <div className="absolute left-0 top-5 z-50 p-1.5 bg-white border border-gray-200 rounded-md shadow-lg grid grid-cols-5 gap-1">
                {QM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setColorOpen(false); if (c !== m?.color) markEdited({ color: c }); }}
                    title={c}
                    className={`w-4 h-4 rounded border transition-transform hover:scale-110 ${
                      m?.color === c ? 'border-gray-800 ring-1 ring-gray-800' : 'border-black/10'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Object Type */}
        <EditableProp
          label="Object Type"
          initial={props.objectType}
          underline
          options={['General', 'Wall', 'Floor', 'Roof', 'Door', 'Window', 'Header/Beam', 'Area', 'Count Item']}
          onCommit={() => markEdited()}
        />

        {/* Level */}
        <EditableProp
          label="Wall Area by/Level"
          initial={props.level}
          underline
          isDefault={props.defaults.has('level')}
          options={[...LEVEL_OPTIONS]}
          onCommit={() => markEdited()}
        />

        {/* Interior / Exterior placement */}
        {props.wallType && (
          <EditableProp
            label={props.objectType === 'Wall' ? 'Wall Type' : 'Location'}
            initial={props.wallType}
            underline
            isDefault={props.defaults.has('wallType')}
            options={['Interior', 'Exterior']}
            onCommit={() => markEdited()}
          />
        )}

        {/* Width (only for walls) */}
        {props.width && (
          <EditableProp
            label="Width"
            initial={props.width}
            underline
            isDefault={props.defaults.has('width')}
            options={['2x4', '2x6', '2x8', '2x10', '2x12']}
            onCommit={() => markEdited()}
          />
        )}

        {/* Height (walls / doors / windows) */}
        {props.heightFt != null && (
          <EditableProp
            label="Height"
            initial={`${props.heightFt} ft`}
            underline
            isDefault={props.defaults.has('height')}
            onCommit={() => markEdited()}
          />
        )}
      </div>

      {/* Confidence Rating */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-700">Confidence Rating:</span>
          <span className={`text-[11px] font-bold ${
            confidence >= 85 ? 'text-emerald-600' : confidence >= 70 ? 'text-amber-600' : 'text-red-500'
          }`}>{confidence}%</span>
        </div>
      </div>
    </div>
  );
}

/* ============== Synthetic Segments ============== */
function generateSegments(m: MeasurementData): { index: number; value: number; unit: string }[] {
  const count = m?.segmentCount ?? 1;
  if (count <= 1) return [];
  const total = m?.value ?? 0;
  const unit = m?.unit ?? '';
  const segments: { index: number; value: number; unit: string }[] = [];
  // Distribute total across segments with slight variation
  let remaining = total;
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      segments.push({ index: i + 1, value: Math.max(0, remaining), unit });
    } else {
      const avg = remaining / (count - i);
      // Vary by ±20% around the average
      const variation = 0.8 + (((i * 7 + 3) % 10) / 10) * 0.4;
      const segVal = Math.max(0.01, avg * variation);
      segments.push({ index: i + 1, value: segVal, unit });
      remaining -= segVal;
    }
  }
  return segments;
}

/* ============== QM Row ============== */
function QMRow({
  m,
  isSelected,
  isHovered,
  isInspected,
  hasAssign,
  assignedKMs,
  isAssignActive,
  typeIcon,
  typeLabel,
  onHover,
  onToggleSelect,
  onToggleVisibility,
  onAssign,
  onDelete,
  onRename,
  onDuplicate,
  onAssignIconClick,
  onAssignIconHover,
  onInspect,
  onUpdateMeasurement,
  draggable = false,
}: {
  m: MeasurementData;
  isSelected: boolean;
  isHovered: boolean;
  isInspected: boolean;
  hasAssign: boolean;
  assignedKMs: { assignmentId: string; kmName: string }[];
  isAssignActive: boolean;
  typeIcon: (type: string, color: string) => React.ReactNode;
  typeLabel: (type: string) => string;
  onHover: (id: string | null) => void;
  onToggleSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onAssign: (ids: string[], anchorRect?: DOMRect) => void;
  onDelete: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onAssignIconClick: (id: string) => void;
  onAssignIconHover?: (id: string | null) => void;
  onInspect: (id: string) => void;
  onUpdateMeasurement?: (id: string, updates: Partial<MeasurementData>) => void;
  draggable?: boolean;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [segmentsExpanded, setSegmentsExpanded] = useState(false);
  const [aiTipOpen, setAiTipOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const hasSegments = (m?.segmentCount ?? 0) > 1;
  const segments = useMemo(() => hasSegments ? generateSegments(m) : [], [m, hasSegments]);
  // Confidence rating shown in the AI-star tooltip (prefer the stored value).
  const confidence = useMemo(
    () => (typeof m?.confidence === 'number' ? m.confidence : deriveQMProps(m).confidence),
    [m],
  );

  const finishEdit = () => {
    if (editName?.trim?.()) onRename?.(m?.id ?? '', editName.trim());
    setEditingName(false);
    setEditName('');
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-1.5 py-[5px] border-b border-gray-50 cursor-default transition-colors duration-100 ${
          m?.flagged ? 'bg-amber-50 border-l-2 border-l-amber-500' : isInspected ? 'bg-sky-50 border-l-2 border-l-sky-400' : isAssignActive ? 'bg-emerald-50' : isHovered ? 'bg-blue-50/60' : isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50/70'
        }`}
        onMouseEnter={() => onHover?.(m?.id ?? null)}
        onMouseLeave={() => onHover?.(null)}
        onClick={() => { if (m?.isAI) onInspect(m?.id ?? ''); }}
      >
        {/* Drag handle (only when grouping is active) */}
        {draggable && (
          <GripVertical className="w-3 h-3 text-gray-300 group-hover:text-gray-400 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        )}

        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(m?.id ?? ''); }}
          className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-300 hover:border-neutral-500'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Visibility chip (tinted with the measurement colour) */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(m?.id ?? ''); }}
          title={m?.visible !== false ? 'Hide on canvas' : 'Show on canvas'}
          className={`flex-shrink-0 w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
            m?.visible !== false ? '' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
          }`}
          style={
            m?.visible !== false
              ? { backgroundColor: `${m?.color ?? '#7c3aed'}22`, color: m?.color ?? '#7c3aed' }
              : undefined
          }
        >
          {m?.visible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>

        {/* Type Icon */}
        {typeIcon(m?.type ?? 'area', m?.color ?? '#999')}

        {/* Name */}
        {editingName ? (
          <Input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e?.target?.value ?? '')}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e?.key === 'Enter') finishEdit();
              if (e?.key === 'Escape') { setEditingName(false); setEditName(''); }
            }}
            autoFocus
            className="h-5 text-[11px] px-1 flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-[11px] font-semibold text-gray-700 truncate min-w-0" title={m?.name ?? ''}>
            {m?.name ?? typeLabel(m?.type ?? 'area')}
          </span>
        )}

        {/* Segment count — clickable to expand */}
        {!editingName && hasSegments && (
          <button
            onClick={(e) => { e.stopPropagation(); setSegmentsExpanded(!segmentsExpanded); }}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
            title={`${m?.segmentCount} segments — click to ${segmentsExpanded ? 'collapse' : 'expand'}`}
          >
            {segmentsExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
            <span className="text-[9px] font-bold text-gray-500">{m?.segmentCount}</span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Low-confidence review chip — click opens review modal */}
        {m?.flagged && (
          <button
            type="button"
            title={m?.flagReason ?? 'Low confidence — click to review'}
            onClick={(e) => { e.stopPropagation(); setReviewOpen(true); }}
            className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0 mr-0.5 hover:bg-amber-200 transition-colors"
          >
            <Flag className="w-2.5 h-2.5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">Review</span>
          </button>
        )}

        {/* Value (hidden on hover, replaced by actions) */}
        <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap flex-shrink-0 group-hover:hidden">
          {formatValue(m?.value ?? 0, m?.type ?? 'area')} {m?.unit ?? ''}
        </span>

        {/* Hover actions: Assign button + Ellipsis menu */}
        <div className={`${menuOpen ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5 flex-shrink-0`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onAssign?.([m?.id ?? ''], rect);
            }}
            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors"
          >
            Assign
          </button>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              collisionPadding={8}
              avoidCollisions
              className="w-40 z-[100]"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); setEditingName(true); setEditName(m?.name ?? ''); }}
                className="text-xs cursor-pointer gap-2"
              >
                <Pencil className="w-3 h-3" /> Edit Properties
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete?.([m?.id ?? '']); }}
                className="text-xs cursor-pointer gap-2 text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status icons: always render both fixed-width slots so the AI-star column,
            the KM-Assign column, and the Quantity all stay vertically aligned across rows.
            Order: AI-star (left) then KM-Assign (right). */}
        {!editingName && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* AI-star slot */}
            <span className="w-3.5 flex items-center justify-center">
              {m?.isAI && (
                <span
                  className="relative flex items-center cursor-default"
                  onMouseEnter={() => setAiTipOpen(true)}
                  onMouseLeave={() => setAiTipOpen(false)}
                >
                  <Sparkles className={`w-3 h-3 ${m?.edited ? 'text-emerald-500' : 'text-gray-900'}`} />
                  {aiTipOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg px-2 py-1.5 min-w-[140px] whitespace-nowrap">
                      <p className="text-[10px] text-gray-400 font-medium mb-0.5">{m?.edited ? 'Auto-Takeoff (Edited)' : 'Auto-Takeoff'}</p>
                      <p className="text-[11px] font-semibold">
                        <span className="text-gray-500">Confidence: </span>
                        <span className={confidence >= 85 ? 'text-emerald-700' : confidence >= 70 ? 'text-amber-700' : 'text-red-600'}>{confidence}%</span>
                      </p>
                    </div>
                  )}
                </span>
              )}
            </span>
            {/* KM-Assign slot */}
            <span className="w-3.5 flex items-center justify-center">
              {hasAssign && (
                <span
                  className={`linked-icon relative flex items-center cursor-pointer transition-colors ${
                    isAssignActive ? 'text-emerald-600' : 'text-gray-900 hover:text-gray-600'
                  }`}
                  title={isAssignActive ? undefined : `Assigned to: ${assignedKMs.map(a => a.kmName).join(', ')}`}
                  onMouseEnter={() => onAssignIconHover?.(m?.id ?? '')}
                  onMouseLeave={() => onAssignIconHover?.(null)}
                  onClick={(e) => { e.stopPropagation(); onAssignIconClick(m?.id ?? ''); }}
                >
                  <GitCompareArrows className="w-3 h-3" />
                  {isAssignActive && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg px-2 py-1.5 min-w-[140px] whitespace-nowrap">
                      <p className="text-[10px] text-gray-400 font-medium mb-0.5">Assigned to:</p>
                      {assignedKMs.map((a, i) => (
                        <p key={i} className="text-[11px] text-emerald-700 font-semibold">{a.kmName}</p>
                      ))}
                    </div>
                  )}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Collapsible segment list */}
      {segmentsExpanded && hasSegments && (
        <div className="bg-gray-50/80 border-b border-gray-100">
          <div className="pl-9 pr-3 py-1">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              Segments ({segments.length})
            </div>
            {segments.map((seg) => (
              <div
                key={seg.index}
                className="flex items-center gap-2 py-[3px] text-[10px]"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-60"
                  style={{ backgroundColor: m?.color ?? '#999' }}
                />
                <span className="text-gray-500 font-medium">Seg {seg.index}</span>
                <div className="flex-1" />
                <span className="font-mono text-gray-500">
                  {formatValue(seg.value, m?.type ?? 'area')} {seg.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review modal (view AI-generated data + edit properties inline) */}
      {reviewOpen && (
        <QMReviewModal
          m={m}
          onClose={() => setReviewOpen(false)}
          onAccept={() => { onUpdateMeasurement?.(m?.id ?? '', { flagged: false }); setReviewOpen(false); toast.success('Measurement accepted'); }}
          onUpdateMeasurement={onUpdateMeasurement}
        />
      )}
    </div>
  );
}

/* ============== QM Review Modal ============== */
interface ReviewRowData {
  key: string;
  label: string;
  value: string;
  confidence: number;
  isDefault: boolean;
  options?: string[];
  mono?: boolean;
}

function QMReviewModal({ m, onClose, onAccept, onUpdateMeasurement }: {
  m: MeasurementData;
  onClose: () => void;
  onAccept: () => void;
  onUpdateMeasurement?: (id: string, updates: Partial<MeasurementData>) => void;
}) {
  const rows = useMemo(() => deriveReviewRows(m), [m]);
  const overall = typeof m?.confidence === 'number' ? m.confidence : deriveQMProps(m).confidence;
  const [dirty, setDirty] = useState(false);
  const confColor = (c: number) => (c >= 85 ? 'text-emerald-600' : c >= 70 ? 'text-amber-600' : 'text-red-500');
  const barColor = (c: number) => (c >= 85 ? 'bg-emerald-500' : c >= 70 ? 'bg-amber-500' : 'bg-red-500');

  // Persist edits. Only Name maps to a stored field; the other properties are
  // synthetic, so editing them just marks the measure as edited (green star).
  const commitField = (key: string, value: string) => {
    setDirty(true);
    if (key === 'name') onUpdateMeasurement?.(m?.id ?? '', { name: value, edited: true });
    else onUpdateMeasurement?.(m?.id ?? '', { edited: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[460px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-gray-800">Review Auto-Takeoff</h2>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[320px]" title={m?.name ?? ''}>{m?.name ?? 'Measurement'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Overall confidence + reason */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Overall confidence</span>
            <span className={`text-xs font-semibold ${confColor(overall)}`}>{overall}%</span>
            <span className={`h-1.5 w-1.5 rounded-full ${barColor(overall)}`} />
          </div>
          {m?.flagReason && (
            <p className="text-[11px] text-gray-500 leading-snug mt-1.5">{m.flagReason}</p>
          )}
        </div>

        {/* Per-field breakdown (editable) */}
        <div className="px-5 py-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AI-Generated Data</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><Pencil className="w-2.5 h-2.5" /> Click a value to edit</span>
          </div>
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {rows.map((r) => (
              <ReviewRow key={r.key} row={r} onCommit={commitField} confColor={confColor} />
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors"
          >
            Close
          </button>
          <button
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 px-3 py-1.5 rounded transition-colors"
          >
            <Check className="w-3 h-3" /> {dirty ? 'Save & Accept' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* A single editable review row: label + inline-editable value + quiet confidence readout. */
function ReviewRow({ row, onCommit, confColor }: {
  row: ReviewRowData;
  onCommit: (key: string, value: string) => void;
  confColor: (c: number) => string;
}) {
  const [original] = useState(row.value);
  const [value, setValue] = useState(row.value);
  const [draft, setDraft] = useState(row.value);
  const [editing, setEditing] = useState(false);
  const edited = value.trim() !== original.trim();

  const commit = () => {
    const v = draft.trim();
    if (v) {
      if (v !== value) { setValue(v); onCommit(row.key, v); }
    } else {
      setDraft(value);
    }
    setEditing(false);
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  return (
    <div className="group grid grid-cols-[110px_1fr_auto] items-center gap-2 py-1.5">
      {/* Label */}
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[11px] text-gray-500 truncate">{row.label}</span>
        {row.isDefault && !edited && (
          <span
            title="Default value — the AI could not detect this with enough confidence, so a default was applied"
            className="flex-shrink-0 text-[8px] font-semibold uppercase tracking-wide leading-none px-1 py-[2px] rounded-sm bg-amber-50 text-amber-600 border border-amber-200"
          >
            Default
          </span>
        )}
      </div>

      {/* Value */}
      {editing ? (
        row.options ? (
          <select
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
            className="h-7 w-full text-[11px] border border-blue-400 rounded px-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {row.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            className={`h-7 w-full text-[11px] border border-blue-400 rounded px-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 ${row.mono ? 'font-mono' : ''}`}
          />
        )
      ) : (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          title={`Edit ${row.label}`}
          className={`h-7 w-full flex items-center gap-1.5 text-left text-[11px] rounded px-1.5 border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-colors ${row.mono ? 'font-mono' : ''} ${edited ? 'text-emerald-700 font-medium' : 'text-gray-800'}`}
        >
          <span className="truncate flex-1">{value}</span>
          <Pencil className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
        </button>
      )}

      {/* Confidence readout */}
      <span className={`text-[10px] tabular-nums w-14 text-right ${edited ? 'text-emerald-600 font-medium' : confColor(row.confidence)}`}>
        {edited ? 'Verified' : `${row.confidence}%`}
      </span>
    </div>
  );
}

// Build per-field review rows with a deterministic per-field confidence.
// Default (fallback) values get a low confidence; explicitly detected values get a high one.
function deriveReviewRows(m: MeasurementData): ReviewRowData[] {
  const props = deriveQMProps(m);
  const nameStr = m?.name ?? '';
  const fieldConf = (key: string, isDefault: boolean) => {
    let h = 0;
    const s = nameStr + '|' + key;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return isDefault ? 40 + (h % 25) : 82 + (h % 16); // 40-64 vs 82-97
  };
  const rows: ReviewRowData[] = [];
  rows.push({ key: 'name', label: 'Name', value: nameStr || '—', confidence: fieldConf('name', false), isDefault: false, mono: true });
  rows.push({ key: 'objectType', label: 'Object Type', value: props.objectType, confidence: fieldConf('objectType', false), isDefault: false, options: ['General', 'Wall', 'Floor', 'Roof', 'Door', 'Window', 'Header/Beam', 'Area', 'Count Item'] });
  rows.push({ key: 'level', label: 'Level', value: props.level, confidence: fieldConf('level', props.defaults.has('level')), isDefault: props.defaults.has('level'), options: [...LEVEL_OPTIONS] });
  if (props.wallType) {
    rows.push({ key: 'wallType', label: props.objectType === 'Wall' ? 'Wall Type' : 'Location', value: props.wallType, confidence: fieldConf('wallType', props.defaults.has('wallType')), isDefault: props.defaults.has('wallType'), options: ['Interior', 'Exterior'] });
  }
  if (props.width) {
    rows.push({ key: 'width', label: 'Width', value: props.width, confidence: fieldConf('width', props.defaults.has('width')), isDefault: props.defaults.has('width'), options: ['2x4', '2x6', '2x8', '2x10', '2x12'] });
  }
  if (props.heightFt != null) {
    rows.push({ key: 'height', label: 'Height', value: `${props.heightFt} ft`, confidence: fieldConf('height', props.defaults.has('height')), isDefault: props.defaults.has('height') });
  }
  return rows;
}

function formatValue(value: number, type: string): string {
  if (type === 'count') return String(Math.round(value ?? 0));
  return (value ?? 0)?.toFixed?.(2) ?? '0.00';
}