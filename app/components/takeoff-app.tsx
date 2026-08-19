'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MeasurementData, SheetData, AssignmentData, SectionData, UseData, KeyMeasureData, AssignmentPayload, ActivityData } from '@/types/takeoff';
import LeftPanel from './left-panel';
import RightPanel from './right-panel';
import CanvasPanel from './canvas-panel';
import AssignModal from './assign-modal';
import NewMeasurementModal from './new-measurement-modal';
import AutoTakeoffModal, { AutoTakeoffConfig } from './auto-takeoff-modal';
import PlanImportModal, { DetectedSheet } from './plan-import-modal';
import ScaleDetectModal from './scale-detect-modal';
import ActivityLog from './activity-log';
import { CanvasFilters, hasActiveFilters } from './canvas-filter-bar';
import { logActivity, ActivityInput } from '@/lib/activity';
import {
  Activity as ActivityIcon,
  PanelLeft,
  Settings,
  MoreHorizontal,
  RefreshCw,
  ChevronDown,
  Layers,
  Upload,
  Sparkles,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

// Name-based classification for component-type visibility filters (Joist/Rafter, Beam/Header)
function matchesComponentType(m: MeasurementData, key: string): boolean {
  const up = (m?.name ?? '').toUpperCase();
  if (key === 'joist_rafter') return /JOIST|RAFTER|\bJST\b|\bRAFT\b/.test(up);
  if (key === 'beam_header') return /BEAM|HEADER|\bHDR\b/.test(up);
  return false;
}
const MEAS_TYPE_KEYS = ['area', 'linear', 'count'];

export default function TakeoffApp() {
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [keyMeasures, setKeyMeasures] = useState<KeyMeasureData[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Assign-link highlight: hovering the green Assigned icon (transient) or clicking it (pinned until click elsewhere)
  const [assignHoverId, setAssignHoverId] = useState<string | null>(null);
  const [assignPinnedId, setAssignPinnedId] = useState<string | null>(null);
  const assignHighlightId = assignHoverId ?? assignPinnedId;
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetIds, setAssignTargetIds] = useState<string[]>([]);
  const [assignAnchorRect, setAssignAnchorRect] = useState<DOMRect | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [uses, setUses] = useState<UseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Active Key Measure (selected from right panel for drawing)
  const [activeKeyMeasureId, setActiveKeyMeasureId] = useState<string | null>(null);
  // Active Sheet (selected/highlighted in left panel)
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  // Quick Measure Mode
  const [quickMeasureMode, setQuickMeasureMode] = useState(false);

  // Activity Log
  const [activityOpen, setActivityOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Plan Import modal
  const [planImportOpen, setPlanImportOpen] = useState(false);

  // Scale Detect modal
  const [scaleDetectSheet, setScaleDetectSheet] = useState<SheetData | null>(null);

  // Auto-Takeoff modal
  const [autoTakeoffOpen, setAutoTakeoffOpen] = useState(false);
  const [autoTakeoffRunning, setAutoTakeoffRunning] = useState(false);
  // Region selection: modal hides, user draws on canvas, then modal returns
  const [regionSelectMode, setRegionSelectMode] = useState(false);
  const [pendingRegionBounds, setPendingRegionBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Canvas markup filters
  const [canvasFilters, setCanvasFilters] = useState<CanvasFilters>({
    showKeyMeasures: true,
    showQuickMeasures: true,
    showAutoTakeoff: true,
    types: new Set(),
    sectionIds: new Set(),
    useIds: new Set(),
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    // Abort if the server does not answer — otherwise a hung request leaves the app on the spinner forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const opts = { signal: controller.signal, cache: 'no-store' as RequestCache };
    try {
      const [measRes, sheetsRes, assignRes, secRes, useRes, kmRes] = await Promise.all([
        fetch('/api/measurements', opts),
        fetch('/api/sheets', opts),
        fetch('/api/assignments', opts),
        fetch('/api/sections', opts),
        fetch('/api/uses', opts),
        fetch('/api/key-measures', opts),
      ]);
      const measData = await measRes?.json?.().catch(() => []);
      const sheetsData = await sheetsRes?.json?.().catch(() => []);
      const assignData = await assignRes?.json?.().catch(() => []);
      const secData = await secRes?.json?.().catch(() => []);
      const useData = await useRes?.json?.().catch(() => []);
      const kmData = await kmRes?.json?.().catch(() => []);
      setMeasurements(Array.isArray(measData) ? measData : []);
      setSheets(Array.isArray(sheetsData) ? sheetsData : []);
      setAssignments(Array.isArray(assignData) ? assignData : []);
      setSections(Array.isArray(secData) ? secData : []);
      setUses(Array.isArray(useData) ? useData : []);
      setKeyMeasures(Array.isArray(kmData) ? kmData : []);
      // Auto-select first sheet if none selected
      if (!activeSheetId && Array.isArray(sheetsData) && sheetsData.length > 0) {
        setActiveSheetId(sheetsData[0].id);
      }
      setLoadError(false);
    } catch (e: any) {
      console.error('Failed to fetch data:', e);
      setLoadError(true);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [activeSheetId]);

  // Fetch activity log entries (newest first)
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch('/api/activity');
      const data = await res?.json?.().catch(() => []);
      setActivities(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to fetch activity:', e);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Record an activity entry then refresh the log so it stays current.
  const log = useCallback(async (input: ActivityInput) => {
    await logActivity(input);
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    fetchData();
    fetchActivity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the pinned Assigned highlight when the user clicks anywhere outside the green Assigned icon / its tooltip
  useEffect(() => {
    if (!assignPinnedId) return;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest && el.closest('.linked-icon')) return;
      setAssignPinnedId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assignPinnedId]);

  // Toggle visibility
  const handleToggleVisibility = useCallback(async (id: string) => {
    const m = (measurements ?? []).find((item: MeasurementData) => item?.id === id);
    if (!m) return;
    const newVisible = !m.visible;
    setMeasurements((prev: MeasurementData[]) =>
      (prev ?? []).map((item: MeasurementData) =>
        item?.id === id ? { ...(item ?? {}), visible: newVisible } : item
      )
    );
    try {
      await fetch(`/api/measurements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: newVisible }),
      });
      log({
        action: 'visibility',
        entityId: id,
        entityName: m.name,
        description: `${newVisible ? 'Showed' : 'Hid'} Quick Measure “${m.name}”`,
        metadata: { visible: newVisible },
      });
    } catch (e: any) {
      console.error('Toggle visibility error:', e);
    }
  }, [measurements, log]);

  // Generic measurement attribute update (used by QM grouping drag-and-drop)
  const handleUpdateMeasurement = useCallback(async (id: string, updates: Partial<MeasurementData>) => {
    const existing = (measurements ?? []).find((item: MeasurementData) => item?.id === id);
    setMeasurements((prev: MeasurementData[]) =>
      (prev ?? []).map((item: MeasurementData) =>
        item?.id === id ? { ...(item ?? {}), ...updates } : item
      )
    );
    try {
      await fetch(`/api/measurements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const name = existing?.name ?? 'measurement';
      const changedKeys = Object.keys(updates ?? {}).filter((k) => k !== 'visible');
      // Visibility-only changes are logged by handleToggleVisibility.
      if (changedKeys.length > 0) {
        const desc =
          'groupId' in (updates ?? {})
            ? `${updates.groupId ? 'Grouped' : 'Ungrouped'} Quick Measure “${name}”`
            : `Updated Quick Measure “${name}”`;
        log({ action: 'update', entityId: id, entityName: name, description: desc, metadata: updates });
      }
    } catch (e: any) {
      console.error('Update measurement error:', e);
    }
  }, [measurements, log]);

  // Toggle selection
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectMany = useCallback((ids: string[], select: boolean) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev ?? []);
      for (const id of (ids ?? [])) {
        if (select) next.add(id); else next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set((measurements ?? []).map((m: MeasurementData) => m?.id ?? '')));
  }, [measurements]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Open assign modal
  const handleAssign = useCallback((ids: string[], anchorRect?: DOMRect) => {
    setAssignTargetIds(ids ?? []);
    setAssignAnchorRect(anchorRect ?? null);
    setAssignModalOpen(true);
  }, []);

  // Apply assignment
  const handleApplyAssignment = useCallback(async (payload: AssignmentPayload) => {
    try {
      await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurementIds: assignTargetIds,
          ...payload,
        }),
      });
      toast?.success?.('Measurements assigned successfully');
      // Activity log: describe the assignment target (Key Measure name when applicable)
      const ids = assignTargetIds ?? [];
      const names = ids.map(
        (id) => (measurements ?? []).find((m: MeasurementData) => m?.id === id)?.name ?? 'measurement'
      );
      const km = payload?.keyMeasureId
        ? (keyMeasures ?? []).find((k: KeyMeasureData) => k?.id === payload.keyMeasureId)
        : null;
      const target =
        payload?.targetType === 'keyMeasure' && km
          ? `Key Measure “${km.name}”`
          : payload?.targetType === 'materialGroup'
          ? 'a Material Group'
          : 'Products';
      const subject =
        ids.length === 1 ? `Quick Measure “${names[0]}”` : `${ids.length} Quick Measures`;
      log({
        action: 'assign',
        entityId: ids.length === 1 ? ids[0] : null,
        entityName: ids.length === 1 ? names[0] : null,
        description: `Assigned ${subject} to ${target}`,
        metadata: { measurementIds: ids, keyMeasureId: payload?.keyMeasureId ?? null, targetType: payload?.targetType },
      });
      setAssignModalOpen(false);
      setAssignTargetIds([]);
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      console.error('Assignment error:', e);
      toast?.error?.('Failed to assign measurements');
    }
  }, [assignTargetIds, fetchData, measurements, keyMeasures, log]);

  // Delete measurements
  const handleDelete = useCallback(async (ids: string[]) => {
    if (!(ids ?? [])?.length) return;
    const names = (ids ?? []).map(
      (id) => (measurements ?? []).find((m: MeasurementData) => m?.id === id)?.name ?? 'measurement'
    );
    try {
      await fetch('/api/measurements/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'delete' }),
      });
      toast?.success?.(`${(ids ?? [])?.length ?? 0} measurement(s) deleted`);
      log({
        action: 'delete',
        entityId: ids.length === 1 ? ids[0] : null,
        entityName: ids.length === 1 ? names[0] : null,
        description:
          ids.length === 1
            ? `Deleted Quick Measure “${names[0]}”`
            : `Deleted ${ids.length} Quick Measures`,
        metadata: { ids, names },
      });
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      console.error('Delete error:', e);
      toast?.error?.('Failed to delete measurements');
    }
  }, [fetchData, measurements, log]);

  // Duplicate
  const handleDuplicate = useCallback(async (id: string) => {
    try {
      await fetch('/api/measurements/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast?.success?.('Measurement duplicated');
      const name = (measurements ?? []).find((m: MeasurementData) => m?.id === id)?.name ?? 'measurement';
      log({
        action: 'duplicate',
        entityId: id,
        entityName: name,
        description: `Duplicated Quick Measure “${name}”`,
      });
      fetchData();
    } catch (e: any) {
      console.error('Duplicate error:', e);
      toast?.error?.('Failed to duplicate measurement');
    }
  }, [fetchData, measurements, log]);

  // Rename
  const handleRename = useCallback(async (id: string, name: string) => {
    const oldName = (measurements ?? []).find((m: MeasurementData) => m?.id === id)?.name ?? '';
    setMeasurements((prev: MeasurementData[]) =>
      (prev ?? []).map((item: MeasurementData) =>
        item?.id === id ? { ...(item ?? {}), name } : item
      )
    );
    try {
      await fetch(`/api/measurements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (oldName !== name) {
        log({
          action: 'rename',
          entityId: id,
          entityName: name,
          description: `Renamed Quick Measure “${oldName}” → “${name}”`,
          metadata: { from: oldName, to: name },
        });
      }
    } catch (e: any) {
      console.error('Rename error:', e);
    }
  }, [measurements, log]);

  // Create new measurement
  const handleCreateMeasurement = useCallback(async (data: { name: string; type: string; color: string; value: number; unit: string }) => {
    try {
      const markupData = data?.type === 'area'
        ? { type: 'polygon', points: [[150, 150], [250, 150], [250, 250], [150, 250]] }
        : data?.type === 'linear'
        ? { type: 'line', points: [[150, 200], [350, 200]] }
        : { type: 'points', points: [[200, 200], [250, 250], [300, 200]] };
      await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sheetId: activeSheetId,
          segmentCount: data?.type === 'count' ? Math.round(data?.value ?? 0) || 1 : 1,
          markupData,
        }),
      });
      toast?.success?.('Measurement created');
      log({
        action: 'create',
        entityName: data?.name,
        description: `Created ${data?.type ?? ''} Quick Measure “${data?.name}”`.replace('  ', ' '),
        metadata: { type: data?.type, value: data?.value, unit: data?.unit },
      });
      setNewModalOpen(false);
      fetchData();
    } catch (e: any) {
      console.error('Create error:', e);
      toast?.error?.('Failed to create measurement');
    }
  }, [fetchData, activeSheetId, log]);

  // Handle Auto-Takeoff run (simulated for prototype)
  const handleAutoTakeoffRun = useCallback(async (config: AutoTakeoffConfig) => {
    setAutoTakeoffOpen(false);
    setAutoTakeoffRunning(true);
    toast?.info?.('Auto-Takeoff started — detecting measurements...', { duration: 3000 });

    // Simulate a processing delay then generate AI measurements
    setTimeout(async () => {
      try {
        const aiColors = ['#8B5CF6', '#0EA5E9', '#F97316', '#10B981', '#EC4899', '#EAB308', '#6366F1'];
        const typeOptions: ('area' | 'linear' | 'count')[] = ['area', 'linear', 'count'];
        const modelLabels = [...config.modelCategories];
        const sheetId = activeSheetId;

        // Generate 3-6 simulated detections
        const detectionCount = 3 + Math.floor(Math.random() * 4);
        // Ensure at least one detection scores low so the threshold behavior is visible
        const lowConfIndex = detectionCount - 1;
        let flaggedCount = 0;
        const names = [
          'Wall Segment A', 'Door Opening 1', 'Window Frame W1', 'Roof Truss T1',
          'Floor Area FA-1', 'Column C1', 'Beam B1', 'Stair Run S1',
          'HVAC Duct D1', 'Pipe Run P1',
        ];

        for (let i = 0; i < detectionCount; i++) {
          const type = typeOptions[i % typeOptions.length];
          const color = aiColors[i % aiColors.length];
          const markupData = type === 'area'
            ? { type: 'polygon' as const, points: randomPolygon() }
            : type === 'linear'
            ? { type: 'line' as const, points: randomLine() }
            : { type: 'points' as const, points: randomPoints() };
          const value = type === 'count'
            ? Math.floor(Math.random() * 8) + 2
            : type === 'area'
            ? Math.round((Math.random() * 500 + 100) * 100) / 100
            : Math.round((Math.random() * 80 + 10) * 100) / 100;
          const unit = type === 'count' ? 'ea' : type === 'area' ? 'sf' : 'lf';
          // Assign a confidence score, then flag anything at or below the threshold
          const confidence = i === lowConfIndex
            ? 54 + Math.floor(Math.random() * 12)  // low: ~54-65
            : 86 + Math.floor(Math.random() * 10); // high: ~86-95
          const isFlagged = confidence <= config.confidenceThreshold;
          if (isFlagged) flaggedCount++;
          const name = isFlagged ? `AI: ${names[i % names.length]} (needs review)` : `AI: ${names[i % names.length]}`;

          await fetch('/api/measurements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              type,
              color,
              value,
              unit,
              sheetId,
              segmentCount: type === 'count' ? value : 1,
              isAI: true,
              markupData,
              flagged: isFlagged,
              confidence,
              flagReason: isFlagged
                ? 'The AI could not confidently detect this value from the drawing. Please verify it against the plan or apply a default.'
                : null,
            }),
          });
        }

        toast?.success?.(
          `Auto-Takeoff complete — ${detectionCount} detections found${flaggedCount > 0 ? `, ${flaggedCount} flagged for review` : ''}`,
          { duration: 5000 }
        );
        log({
          action: 'auto_takeoff',
          description: `Auto-Takeoff detected ${detectionCount} Quick Measure${detectionCount === 1 ? '' : 's'}`,
          metadata: { detectionCount, modelCategories: modelLabels, sheetId },
        });
        fetchData();
      } catch (e: any) {
        console.error('Auto-Takeoff error:', e);
        toast?.error?.('Auto-Takeoff failed');
      } finally {
        setAutoTakeoffRunning(false);
      }
    }, 2500);
  }, [activeSheetId, fetchData, log]);

  // Handle Plan Import completion
  const handlePlanImportComplete = useCallback(async (detectedSheets: DetectedSheet[]) => {
    setPlanImportOpen(false);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheets: detectedSheets.map((s, i) => ({
            name: s.name,
            category: s.category,
            scale: s.scale,
            pageIndex: s.pageIndex,
            sortOrder: (sheets?.length ?? 0) + i,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed to create sheets');
      const created = await res.json();
      toast?.success?.(`Imported ${created.length} sheets from plan`);
      await fetchData();
      // Select the first imported sheet
      if (created.length > 0) {
        setActiveSheetId(created[0].id);
      }
    } catch (e: any) {
      console.error('Plan import error:', e);
      toast?.error?.('Failed to import plan sheets');
    }
  }, [sheets, fetchData]);

  // Handle scale update from ScaleDetectModal
  const handleScaleUpdate = useCallback(async (sheetId: string, scale: string) => {
    try {
      const res = await fetch('/api/sheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: sheetId, scale }] }),
      });
      if (!res.ok) throw new Error('Failed to update scale');
      toast?.success?.('Scale updated successfully');
      await fetchData();
    } catch (e: any) {
      console.error('Scale update error:', e);
      toast?.error?.('Failed to update scale');
    }
  }, [fetchData]);

  const assignTargetNames = (assignTargetIds ?? []).map((id: string) =>
    (measurements ?? []).find((m: MeasurementData) => m?.id === id)?.name ?? 'Unknown'
  );

  // Build a map: measurementId -> assignment[] for filter logic
  const assignmentsByMeasId = React.useMemo(() => {
    const map = new Map<string, AssignmentData[]>();
    for (const a of assignments) {
      const list = map.get(a.measurementId) || [];
      list.push(a);
      map.set(a.measurementId, list);
    }
    return map;
  }, [assignments]);

  // Compute canvas-filtered measurements
  const filteredMeasurements = React.useMemo(() => {
    if (!hasActiveFilters(canvasFilters)) return measurements;

    return measurements.map((m) => {
      let pass = true;
      const measAssigns = assignmentsByMeasId.get(m.id) || [];

      const isKeyMeasure = measAssigns.some((a) => !a.fromQuickMeasure);
      const isQuickMeasure = !isKeyMeasure;
      if (!canvasFilters.showKeyMeasures && isKeyMeasure) pass = false;
      if (!canvasFilters.showQuickMeasures && isQuickMeasure) pass = false;
      if (!canvasFilters.showAutoTakeoff && m.isAI) pass = false;

      if (canvasFilters.types.size > 0) {
        const selected = Array.from(canvasFilters.types);
        const measTypes = selected.filter((t) => MEAS_TYPE_KEYS.includes(t));
        const compTypes = selected.filter((t) => !MEAS_TYPE_KEYS.includes(t));
        let typePass = measTypes.includes(m.type);
        if (!typePass && compTypes.some((k) => matchesComponentType(m, k))) typePass = true;
        pass = pass && typePass;
      }
      if (canvasFilters.sectionIds.size > 0) {
        pass = pass && measAssigns.some((a) => a.sectionId && canvasFilters.sectionIds.has(a.sectionId));
      }
      if (canvasFilters.useIds.size > 0) {
        pass = pass && measAssigns.some((a) => a.useId && canvasFilters.useIds.has(a.useId));
      }

      if (!pass) return { ...m, visible: false };
      return m;
    });
  }, [measurements, canvasFilters, assignmentsByMeasId]);

  const filteredVisibleCount = filteredMeasurements.filter((m) => m.visible).length;
  const totalVisibleCount = measurements.filter((m) => m.visible).length;

  const canvasHiddenIds = React.useMemo(() => {
    if (!hasActiveFilters(canvasFilters)) return new Set<string>();
    const hidden = new Set<string>();
    filteredMeasurements.forEach((m) => {
      const orig = measurements.find((o) => o.id === m.id);
      if (orig?.visible && !m.visible) hidden.add(m.id);
    });
    return hidden;
  }, [filteredMeasurements, measurements, canvasFilters]);

  const keyMeasureIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const [measId, assigns] of assignmentsByMeasId) {
      if (assigns.some((a) => !a.fromQuickMeasure)) ids.add(measId);
    }
    return ids;
  }, [assignmentsByMeasId]);

  const aiMeasurementIds = React.useMemo(() => {
    return new Set(measurements.filter((m) => m.isAI).map((m) => m.id));
  }, [measurements]);

  const sectionMeasurementCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const [, assigns] of assignmentsByMeasId) {
      for (const a of assigns) {
        if (a.sectionId) counts.set(a.sectionId, (counts.get(a.sectionId) || 0) + 1);
      }
    }
    return counts;
  }, [assignmentsByMeasId]);

  const useMeasurementCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const [, assigns] of assignmentsByMeasId) {
      for (const a of assigns) {
        if (a.useId) counts.set(a.useId, (counts.get(a.useId) || 0) + 1);
      }
    }
    return counts;
  }, [assignmentsByMeasId]);

  // Get active KM info for status bar display
  const activeKM = activeKeyMeasureId ? keyMeasures.find((km) => km.id === activeKeyMeasureId) : null;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading takeoff data...</p>
        </div>
      </div>
    );
  }

  if (loadError && sheets.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-100">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-neutral-900">Could not load takeoff data</p>
          <p className="text-xs text-neutral-500 max-w-xs">The connection timed out. This usually clears up on a retry.</p>
          <Button
            size="sm"
            onClick={() => { setLoading(true); setLoadError(false); fetchData(); }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="h-screen flex flex-col bg-neutral-100 overflow-hidden">
      {/* ===== Brand Bar ===== */}
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center px-3 gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
          <span className="text-[11px] font-bold text-white tracking-tight">PT</span>
        </div>
        <span className="text-[15px] font-semibold text-neutral-900 tracking-tight">Pipeline Takeoff</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-500 hover:text-neutral-900"
              onClick={() => setLeftPanelOpen((v) => !v)}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{leftPanelOpen ? 'Hide' : 'Show'} sheets panel</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <span className="text-xs text-neutral-400 hidden lg:inline">Commercial Office Building — Phase 1</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-neutral-900">
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => { setActivityOpen(true); fetchActivity(); }}>
              <ActivityIcon className="w-3.5 h-3.5 mr-2" /> Activity Log
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setPlanImportOpen(true)}>
              <Upload className="w-3.5 h-3.5 mr-2" /> Import Plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => fetchData()}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reload Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 text-xs font-semibold flex items-center justify-center select-none">
          J
        </div>
      </header>

      {/* ===== Job / Action Toolbar ===== */}
      <div className="h-14 bg-white border-b border-neutral-200 flex items-center px-3 gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm font-medium text-neutral-900 truncate max-w-[220px]">
            {sheets.find((s) => s.id === activeSheetId)?.name ?? 'No Job Selected'}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-neutral-900">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setPlanImportOpen(true)}>Import plan…</DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setNewModalOpen(true)}>New measurement…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => { setActivityOpen(true); fetchActivity(); }}>View activity</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1" />

        <div className="flex items-stretch rounded-lg overflow-hidden shadow-sm">
          <button
            onClick={async () => {
              setSyncing(true);
              await fetchData();
              setSyncing(false);
              toast.success('Quantities synced');
            }}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 h-9 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Quantities
          </button>
          <div className="w-px bg-white/20" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center px-2 h-9 bg-neutral-900 hover:bg-neutral-800 text-white transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => fetchData()}>Refresh measurements</DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => { setActivityOpen(true); fetchActivity(); }}>Sync history</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-2 p-2">
        {/* Icon rail */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
          {[
            { icon: Layers, label: leftPanelOpen ? 'Hide sheets' : 'Show sheets', onClick: () => setLeftPanelOpen((v) => !v), active: leftPanelOpen },
            { icon: Upload, label: 'Import plan', onClick: () => setPlanImportOpen(true), active: false },
            { icon: Sparkles, label: 'Auto-Takeoff', onClick: () => setAutoTakeoffOpen(true), active: false },
            { icon: Plus, label: 'New measurement', onClick: () => setNewModalOpen(true), active: false },
            { icon: ActivityIcon, label: 'Activity log', onClick: () => { setActivityOpen(true); fetchActivity(); }, active: activityOpen },
          ].map(({ icon: Icon, label, onClick, active }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <button
                  onClick={onClick}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
                      : 'text-neutral-500 hover:bg-white hover:text-neutral-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {leftPanelOpen && (
        <div className="flex rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <LeftPanel
          sheets={sheets}
          measurements={measurements}
          assignments={assignments}
          keyMeasures={keyMeasures}
          activeSheetId={activeSheetId}
          onSelectSheet={setActiveSheetId}
          hoveredId={hoveredId}
          assignHighlightId={assignHighlightId}
          onHover={setHoveredId}
          onToggleVisibility={handleToggleVisibility}
          onImportPlan={() => setPlanImportOpen(true)}
          onDetectScale={(sheet) => setScaleDetectSheet(sheet)}
        />
        </div>
        )}

        <div className="flex flex-1 min-w-0 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <CanvasPanel
          measurements={filteredMeasurements}
          hoveredId={hoveredId}
          assignHighlightId={assignHighlightId}
          canvasFilters={canvasFilters}
          onFiltersChange={setCanvasFilters}
          sections={sections}
          uses={uses}
          filteredVisibleCount={filteredVisibleCount}
          totalVisibleCount={totalVisibleCount}
          allMeasurements={measurements}
          keyMeasureIds={keyMeasureIds}
          aiMeasurementIds={aiMeasurementIds}
          sectionMeasurementCounts={sectionMeasurementCounts}
          useMeasurementCounts={useMeasurementCounts}
          quickMeasureMode={quickMeasureMode}
          onToggleQuickMeasureMode={() => setQuickMeasureMode(!quickMeasureMode)}
          activeKMName={activeKM?.name ?? null}
          activeScale={sheets.find(s => s.id === activeSheetId)?.scale ?? '1/4" = 1\''}
          onAutoTakeoffClick={() => setAutoTakeoffOpen(true)}
          regionSelectMode={regionSelectMode}
          onRegionDrawn={(bounds) => {
            setPendingRegionBounds(bounds);
            setRegionSelectMode(false);
            setAutoTakeoffOpen(true); // reopen modal
          }}
          onRegionCancel={() => {
            setRegionSelectMode(false);
            setAutoTakeoffOpen(true); // reopen modal without region
          }}
        />
        </div>

        <div className="flex rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <RightPanel
          keyMeasures={keyMeasures}
          activeKeyMeasureId={activeKeyMeasureId}
          onSelectKeyMeasure={setActiveKeyMeasureId}
          onRefreshKeyMeasures={async () => {
            try {
              const res = await fetch('/api/key-measures');
              const data = await res.json();
              setKeyMeasures(Array.isArray(data) ? data : []);
            } catch {}
          }}
          measurements={measurements}
          assignments={assignments}
          hoveredId={hoveredId}
          selectedIds={selectedIds}
          assignHighlightId={assignHighlightId}
          onAssignIconHover={setAssignHoverId}
          onAssignIconPin={(id) => setAssignPinnedId((prev) => (prev === id ? null : id))}
          onHover={setHoveredId}
          onToggleVisibility={handleToggleVisibility}
          onToggleSelect={handleToggleSelect}
          onToggleSelectMany={handleToggleSelectMany}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onAssign={handleAssign}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onRename={handleRename}
          onUpdateMeasurement={handleUpdateMeasurement}
          onNewClick={() => setNewModalOpen(true)}
        />
        </div>
      </div>

      {/* Activity Log Drawer */}
      <ActivityLog
        isOpen={activityOpen}
        onClose={() => setActivityOpen(false)}
        activities={activities}
        loading={activityLoading}
        onRefresh={fetchActivity}
      />

      {/* Assign Modal */}
      <AssignModal
        isOpen={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setAssignTargetIds([]); setAssignAnchorRect(null); }}
        onApply={handleApplyAssignment}
        measurementNames={assignTargetNames}
        anchorRect={assignAnchorRect}
      />

      {/* New Measurement Modal */}
      <NewMeasurementModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreate={handleCreateMeasurement}
      />

      {/* Plan Import Modal */}
      <PlanImportModal
        isOpen={planImportOpen}
        onClose={() => setPlanImportOpen(false)}
        onComplete={handlePlanImportComplete}
        existingSheets={sheets}
      />

      {/* Scale Detect Modal */}
      {scaleDetectSheet && (
        <ScaleDetectModal
          isOpen={!!scaleDetectSheet}
          onClose={() => setScaleDetectSheet(null)}
          sheet={scaleDetectSheet}
          onScaleUpdate={handleScaleUpdate}
        />
      )}

      {/* Auto-Takeoff Modal */}
      <AutoTakeoffModal
        isOpen={autoTakeoffOpen && !regionSelectMode}
        onClose={() => { setAutoTakeoffOpen(false); setPendingRegionBounds(null); }}
        onRun={handleAutoTakeoffRun}
        sheets={sheets}
        activeSheetId={activeSheetId}
        onStartRegionSelect={() => {
          setAutoTakeoffOpen(false); // hide modal
          setRegionSelectMode(true); // activate canvas drawing
        }}
        externalRegionBounds={pendingRegionBounds}
      />

      {/* Auto-Takeoff running overlay */}
      {autoTakeoffRunning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-xs">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-gray-900">Running Auto-Takeoff</h3>
              <p className="text-xs text-gray-500 mt-1">AI is analyzing the blueprint and detecting measurements...</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-purple-600 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

/* ===== Helpers for simulated AI markups ===== */
function randomPolygon(): number[][] {
  const cx = 200 + Math.random() * 400;
  const cy = 150 + Math.random() * 250;
  const r = 30 + Math.random() * 60;
  const sides = 4 + Math.floor(Math.random() * 3);
  return Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    return [Math.round(cx + r * Math.cos(angle)), Math.round(cy + r * Math.sin(angle))];
  });
}

function randomLine(): number[][] {
  const x1 = 150 + Math.random() * 400;
  const y1 = 120 + Math.random() * 300;
  const segs = 2 + Math.floor(Math.random() * 3);
  const pts = [[Math.round(x1), Math.round(y1)]];
  for (let i = 1; i < segs; i++) {
    pts.push([Math.round(x1 + i * (40 + Math.random() * 60)), Math.round(y1 + (Math.random() - 0.5) * 80)]);
  }
  return pts;
}

function randomPoints(): number[][] {
  const count = 2 + Math.floor(Math.random() * 5);
  return Array.from({ length: count }, () => [
    Math.round(150 + Math.random() * 450),
    Math.round(120 + Math.random() * 300),
  ]);
}
