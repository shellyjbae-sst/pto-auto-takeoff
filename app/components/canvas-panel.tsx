'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { MeasurementData, MarkupData, SectionData, UseData } from '@/types/takeoff';
import { ChevronDown, Sparkles, Pen, Settings2, Square, Minus, Circle } from 'lucide-react';
import CanvasFilterBar, { CanvasFilters } from './canvas-filter-bar';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const STRUCTURAL_TOOLS = ['Joist/Rafter Tool', 'Beam/Header Tool'];
const ANNOTATION_TOOLS = ['Dimension Tool', 'Annotation Tool'];

interface CanvasPanelProps {
  measurements: MeasurementData[];
  hoveredId: string | null;
  assignHighlightId?: string | null;
  canvasFilters: CanvasFilters;
  onFiltersChange: (filters: CanvasFilters) => void;
  sections: SectionData[];
  uses: UseData[];
  filteredVisibleCount: number;
  totalVisibleCount: number;
  allMeasurements: MeasurementData[];
  keyMeasureIds: Set<string>;
  aiMeasurementIds: Set<string>;
  sectionMeasurementCounts: Map<string, number>;
  useMeasurementCounts: Map<string, number>;
  quickMeasureMode: boolean;
  onToggleQuickMeasureMode: () => void;
  activeKMName: string | null;
  activeScale: string;
  onAutoTakeoffClick: () => void;
  regionSelectMode?: boolean;
  onRegionDrawn?: (bounds: { x: number; y: number; w: number; h: number }) => void;
  onRegionCancel?: () => void;
}

export default function CanvasPanel({ measurements, hoveredId, assignHighlightId, canvasFilters, onFiltersChange, sections, uses, filteredVisibleCount, totalVisibleCount, allMeasurements, keyMeasureIds, aiMeasurementIds, sectionMeasurementCounts, useMeasurementCounts, quickMeasureMode, onToggleQuickMeasureMode, activeKMName, activeScale, onAutoTakeoffClick, regionSelectMode, onRegionDrawn, onRegionCancel }: CanvasPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [canvasSize, setCanvasSize] = React.useState({ w: 860, h: 560 });
  const lastPan = useRef({ x: 0, y: 0 });

  // Blueprint logical size (aspect ratio source of truth)
  const BLUEPRINT_W = 860;
  const BLUEPRINT_H = 560;

  // Resize canvas to fill container while maintaining device pixel ratio
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ w: Math.round(width), h: Math.round(height) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef?.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;

    const cw = canvasSize.w;
    const ch = canvasSize.h;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();

    // Compute uniform scale so blueprint fits in canvas
    const baseScale = Math.min(cw / BLUEPRINT_W, ch / BLUEPRINT_H);
    const scaledW = BLUEPRINT_W * baseScale;
    const scaledH = BLUEPRINT_H * baseScale;
    // Center the blueprint
    const originX = (cw - scaledW) / 2;
    const originY = (ch - scaledH) / 2;

    ctx.translate(offset.x + originX, offset.y + originY);
    ctx.scale(zoom * baseScale, zoom * baseScale);

    // Draw grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5 / baseScale;
    for (let x = 0; x <= BLUEPRINT_W; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, BLUEPRINT_H);
      ctx.stroke();
    }
    for (let y = 0; y <= BLUEPRINT_H; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BLUEPRINT_W, y);
      ctx.stroke();
    }

    // Draw blueprint-style walls
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    // Outer walls
    ctx.strokeRect(100, 80, 660, 380);
    // Interior walls
    const walls = [
      [[320, 80], [320, 460]],
      [[380, 80], [380, 460]],
      [[580, 80], [580, 460]],
      [[100, 180], [380, 180]],
      [[100, 340], [380, 340]],
      [[380, 210], [580, 210]],
      [[380, 280], [580, 280]],
      [[580, 280], [760, 280]],
    ];
    walls.forEach((wall: number[][]) => {
      ctx.beginPath();
      ctx.moveTo(wall?.[0]?.[0] ?? 0, wall?.[0]?.[1] ?? 0);
      ctx.lineTo(wall?.[1]?.[0] ?? 0, wall?.[1]?.[1] ?? 0);
      ctx.stroke();
    });

    // Door arcs
    const doors = [
      { x: 200, y: 180, r: 20, start: -Math.PI / 2, end: 0 },
      { x: 200, y: 340, r: 20, start: 0, end: Math.PI / 2 },
      { x: 440, y: 210, r: 20, start: -Math.PI / 2, end: 0 },
      { x: 440, y: 280, r: 20, start: 0, end: Math.PI / 2 },
      { x: 640, y: 280, r: 20, start: 0, end: Math.PI / 2 },
    ];
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    doors.forEach((d: any) => {
      ctx.beginPath();
      ctx.arc(d?.x ?? 0, d?.y ?? 0, d?.r ?? 0, d?.start ?? 0, d?.end ?? 0);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Room labels
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const labels = [
      { text: 'LOBBY', x: 220, y: 265 },
      { text: 'CORRIDOR', x: 480, y: 255 },
      { text: 'OFFICE 101', x: 450, y: 160 },
      { text: 'OFFICE 102', x: 460, y: 360 },
      { text: 'CONFERENCE RM', x: 660, y: 195 },
      { text: 'BREAK ROOM', x: 650, y: 355 },
      { text: 'RESTROOM', x: 180, y: 400 },
    ];
    labels.forEach((l: any) => {
      ctx.fillText(l?.text ?? '', l?.x ?? 0, l?.y ?? 0);
    });

    // Draw measurement overlays
    // Include the hovered measurement even if filtered out, so side-panel hover always shows its markup
    // Emphasized measurement: hovered row takes priority, else the pinned/hovered Assigned-icon target (green)
    const emphasisId = hoveredId ?? assignHighlightId ?? null;
    const isAssignEmphasis = !hoveredId && !!assignHighlightId;
    const visibleMeasurements = (measurements ?? []).filter((m: MeasurementData) => m?.visible || m?.id === emphasisId);
    const hasHover = !!emphasisId;

    // Draw non-emphasized (greyed-out) markups first, then the emphasized one on top
    const sortedMeasurements = hasHover
      ? [...visibleMeasurements].sort((a, b) => (a.id === emphasisId ? 1 : 0) - (b.id === emphasisId ? 1 : 0))
      : visibleMeasurements;

    sortedMeasurements.forEach((m: MeasurementData) => {
      const markup = m?.markupData as MarkupData;
      if (!markup?.points?.length) return;

      const isHovered = emphasisId === m?.id;
      // When something is emphasized, grey out all others
      const isGreyedOut = hasHover && !isHovered;
      const alpha = isHovered ? 0.5 : isGreyedOut ? 0.08 : 0.25;
      const strokeAlpha = isHovered ? 1 : isGreyedOut ? 0.15 : 0.7;
      const color = isGreyedOut ? '#9CA3AF' : (isHovered && isAssignEmphasis ? '#059669' : (m?.color ?? '#3B82F6'));

      if (markup?.type === 'polygon') {
        ctx.fillStyle = hexToRgba(color, alpha);
        ctx.strokeStyle = hexToRgba(color, strokeAlpha);
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        const pts = markup?.points ?? [];
        ctx.moveTo(pts?.[0]?.[0] ?? 0, pts?.[0]?.[1] ?? 0);
        for (let i = 1; i < (pts?.length ?? 0); i++) {
          ctx.lineTo(pts?.[i]?.[0] ?? 0, pts?.[i]?.[1] ?? 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Label
        if (isHovered) {
          const cx = (pts ?? []).reduce((s: number, p: number[]) => s + (p?.[0] ?? 0), 0) / (pts?.length ?? 1);
          const cy = (pts ?? []).reduce((s: number, p: number[]) => s + (p?.[1] ?? 0), 0) / (pts?.length ?? 1);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          const text = `${m?.name ?? ''} - ${m?.value?.toFixed?.(2) ?? '0'} ${m?.unit ?? ''}`;
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(cx - tw / 2 - 6, cy - 10, tw + 12, 20);
          ctx.fillStyle = '#fff';
          ctx.fillText(text, cx, cy + 4);
        }
      } else if (markup?.type === 'line') {
        ctx.strokeStyle = hexToRgba(color, strokeAlpha);
        ctx.lineWidth = isHovered ? 4 : 2.5;
        ctx.beginPath();
        const pts = markup?.points ?? [];
        ctx.moveTo(pts?.[0]?.[0] ?? 0, pts?.[0]?.[1] ?? 0);
        for (let i = 1; i < (pts?.length ?? 0); i++) {
          ctx.lineTo(pts?.[i]?.[0] ?? 0, pts?.[i]?.[1] ?? 0);
        }
        ctx.stroke();

        // Dots at vertices
        ctx.fillStyle = color;
        (pts ?? []).forEach((p: number[]) => {
          ctx.beginPath();
          ctx.arc(p?.[0] ?? 0, p?.[1] ?? 0, isHovered ? 5 : 3, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (markup?.type === 'points') {
        const pts = markup?.points ?? [];
        (pts ?? []).forEach((p: number[]) => {
          ctx.fillStyle = hexToRgba(color, isHovered ? 0.9 : 0.6);
          ctx.strokeStyle = color;
          ctx.lineWidth = isHovered ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(p?.[0] ?? 0, p?.[1] ?? 0, isHovered ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    });

    ctx.restore();
  }, [measurements, hoveredId, assignHighlightId, zoom, offset, canvasSize]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev: number) => Math.max(0.3, Math.min(5, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      lastPan.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset((prev: any) => ({
        x: (prev?.x ?? 0) + e.clientX - lastPan.current.x,
        y: (prev?.y ?? 0) + e.clientY - lastPan.current.y,
      }));
      lastPan.current = { x: e.clientX, y: e.clientY };
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Toolbar / status bar state
  const [activeTool, setActiveTool] = React.useState<string | null>(null);
  const [showToolbar, setShowToolbar] = React.useState(true);
  const [snapOn, setSnapOn] = React.useState(true);
  const [orthoOff, setOrthoOff] = React.useState(false);
  const [showVisSettings, setShowVisSettings] = React.useState(false);
  // Lifted position state for Visibility Settings popover — persists across show/hide
  const [visSettingsPos, setVisSettingsPos] = React.useState<{ x: number; y: number } | null>(null);

  const selectTool = (tool: string) => {
    if (activeTool === tool) {
      setActiveTool(null);
      toast.info('Tool deselected');
    } else {
      setActiveTool(tool);
      toast.info(`${tool} selected`);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col bg-neutral-50 overflow-hidden">
      {/* ===== Floating Tool Pill ===== */}
      {showToolbar && (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-1.5 py-1.5 bg-white border border-neutral-200 rounded-xl shadow-lg">
        <div className="flex flex-col gap-[3px] px-1.5 text-neutral-300" aria-hidden>
          <span className="block w-3 h-px bg-current" />
          <span className="block w-3 h-px bg-current" />
          <span className="block w-3 h-px bg-current" />
        </div>
        {/* Structural Tools */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors ${
                STRUCTURAL_TOOLS.includes(activeTool ?? '') ? 'text-white bg-teal-600 border-teal-600' : 'text-neutral-700 bg-white hover:bg-neutral-100 border-neutral-200'
              }`}
            >
              Structural Tools
              <ChevronDown className={`w-3 h-3 ${STRUCTURAL_TOOLS.includes(activeTool ?? '') ? 'text-teal-200' : 'text-gray-400'}`} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {STRUCTURAL_TOOLS.map((tool) => (
              <DropdownMenuItem
                key={tool}
                onClick={() => selectTool(tool)}
                className={`flex items-center gap-2 text-xs cursor-pointer ${activeTool === tool ? 'bg-teal-50 text-teal-700 font-medium' : ''}`}
              >
                <Minus className="w-3.5 h-3.5 text-gray-500" />
                {tool}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Annotations */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors ${
                ANNOTATION_TOOLS.includes(activeTool ?? '') ? 'text-white bg-teal-600 border-teal-600' : 'text-neutral-700 bg-white hover:bg-neutral-100 border-neutral-200'
              }`}
            >
              Annotations
              <ChevronDown className={`w-3 h-3 ${ANNOTATION_TOOLS.includes(activeTool ?? '') ? 'text-teal-200' : 'text-gray-400'}`} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {ANNOTATION_TOOLS.map((tool) => (
              <DropdownMenuItem
                key={tool}
                onClick={() => selectTool(tool)}
                className={`flex items-center gap-2 text-xs cursor-pointer ${activeTool === tool ? 'bg-teal-50 text-teal-700 font-medium' : ''}`}
              >
                <Pen className="w-3.5 h-3.5 text-gray-500" />
                {tool}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Quick Measure Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors ${
                activeTool?.startsWith('QM:') ? 'text-white bg-teal-600 border-teal-600' : 'text-neutral-700 bg-white hover:bg-neutral-100 border-neutral-200'
              }`}
            >
              Quick Measure
              <ChevronDown className={`w-3 h-3 ${activeTool?.startsWith('QM:') ? 'text-teal-200' : 'text-gray-400'}`} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem
              onClick={() => selectTool('QM: Count')}
              className={`flex items-center gap-2 text-xs cursor-pointer ${activeTool === 'QM: Count' ? 'bg-teal-50 text-teal-700 font-medium' : ''}`}
            >
              <Circle className="w-3.5 h-3.5 text-gray-500" />
              Count
              <span className="ml-auto text-[10px] text-gray-400">Points</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => selectTool('QM: Linear')}
              className={`flex items-center gap-2 text-xs cursor-pointer ${activeTool === 'QM: Linear' ? 'bg-teal-50 text-teal-700 font-medium' : ''}`}
            >
              <Minus className="w-3.5 h-3.5 text-gray-500" />
              Linear
              <span className="ml-auto text-[10px] text-gray-400">Lines</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => selectTool('QM: Area')}
              className={`flex items-center gap-2 text-xs cursor-pointer ${activeTool === 'QM: Area' ? 'bg-teal-50 text-teal-700 font-medium' : ''}`}
            >
              <Square className="w-3.5 h-3.5 text-gray-500" />
              Area
              <span className="ml-auto text-[10px] text-gray-400">Polygons</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Auto-Takeoff (last) — opens config modal */}
        <button
          onClick={onAutoTakeoffClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors text-neutral-700 bg-white hover:bg-purple-50 hover:border-purple-300 border-neutral-200"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          Auto-Takeoff
        </button>
      </div>
      )}

      {/* ===== Canvas Area ===== */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {/* Legend filter (draggable) */}
        {showVisSettings && (
          <CanvasFilterBar
            filters={canvasFilters}
            onChange={onFiltersChange}
            sections={sections}
            uses={uses}
            visibleCount={filteredVisibleCount}
            totalCount={totalVisibleCount}
            allMeasurements={allMeasurements}
            keyMeasureIds={keyMeasureIds}
            aiMeasurementIds={aiMeasurementIds}
            sectionMeasurementCounts={sectionMeasurementCounts}
            useMeasurementCounts={useMeasurementCounts}
            position={visSettingsPos}
            onPositionChange={setVisSettingsPos}
          />
        )}

        <canvas
          ref={canvasRef}
          className={regionSelectMode ? 'pointer-events-none' : 'cursor-crosshair'}
          style={{ width: canvasSize.w, height: canvasSize.h, imageRendering: 'auto' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Region Selection Overlay */}
        {regionSelectMode && (
          <RegionDrawOverlay
            containerW={canvasSize.w}
            containerH={canvasSize.h}
            onComplete={(bounds) => onRegionDrawn?.(bounds)}
            onCancel={() => onRegionCancel?.()}
          />
        )}
      </div>

      {/* ===== Bottom Status Bar ===== */}
      <div className="flex items-center gap-3 px-3 h-11 bg-white border-t border-neutral-200 flex-shrink-0 z-10 text-[11px]">
        {/* Scale */}
        <div className="flex items-center gap-1.5">
          <Pen className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-400">Scale:</span>
          <span className="text-neutral-900 font-medium">{activeScale || 'Not Set'}</span>
        </div>

        <div className="w-px h-4 bg-neutral-200" />

        {/* Tool label */}
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-400">Tool:</span>
          <span className="text-neutral-900 font-medium">{activeTool || 'No Tool Selected'}</span>
        </div>

        <div className="flex-1" />

        {/* Segmented toggles */}
        <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {([
            { label: 'Toolbar', on: showToolbar, toggle: () => setShowToolbar(!showToolbar) },
            { label: 'Snap', on: snapOn, toggle: () => setSnapOn(!snapOn) },
            { label: 'Ortho', on: orthoOff, toggle: () => setOrthoOff(!orthoOff) },
          ]).map(({ label, on, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                on ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <span className="font-medium">{label}</span>
              <span className={`text-[9px] font-semibold tracking-wide ${on ? 'text-teal-600' : 'text-neutral-400'}`}>
                {on ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>

        {/* Active KM indicator */}
        {activeKMName && (
          <>
            <div className="w-px h-4 bg-neutral-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">KM:</span>
              <span className="text-sky-700 font-medium font-mono">{activeKMName}</span>
            </div>
          </>
        )}

        {/* Visibility Settings toggle */}
        <button
          onClick={() => setShowVisSettings(!showVisSettings)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <Settings2 className="w-3 h-3 text-neutral-500" />
          <span className="text-neutral-700 font-medium">Visibility Settings</span>
          <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${showVisSettings ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = (hex ?? '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ===== Region Draw Overlay ===== */
function RegionDrawOverlay({
  containerW,
  containerH,
  onComplete,
  onCancel,
}: {
  containerW: number;
  containerH: number;
  onComplete: (bounds: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
}) {
  const [drawing, setDrawing] = React.useState(false);
  const [start, setStart] = React.useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = React.useState<{ x: number; y: number } | null>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const getRelPos = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const rect = start && current
    ? {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        w: Math.abs(current.x - start.x),
        h: Math.abs(current.y - start.y),
      }
    : null;

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getRelPos(e);
    setStart(pos);
    setCurrent(pos);
    setDrawing(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    setCurrent(getRelPos(e));
  };

  const onMouseUp = () => {
    if (!drawing || !start || !current) { setDrawing(false); return; }
    const bounds = {
      x: Math.round(Math.min(start.x, current.x)),
      y: Math.round(Math.min(start.y, current.y)),
      w: Math.round(Math.abs(current.x - start.x)),
      h: Math.round(Math.abs(current.y - start.y)),
    };
    setDrawing(false);
    if (bounds.w > 15 && bounds.h > 15) {
      onComplete(bounds);
    } else {
      // Too small, reset
      setStart(null);
      setCurrent(null);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30"
      style={{ cursor: 'crosshair' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { if (drawing) onMouseUp(); }}
    >
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      {/* Instruction banner */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white/95 backdrop-blur-sm border border-purple-200 rounded-lg shadow-lg px-4 py-2">
        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800">Draw a region on the plan</p>
          <p className="text-[10px] text-gray-500">Click and drag to select the area for Auto-Takeoff</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="ml-2 text-[10px] font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Selection rectangle */}
      {rect && rect.w > 2 && rect.h > 2 && (
        <>
          {/* Purple filled region */}
          <div
            className="absolute border-2 border-dashed border-purple-500 pointer-events-none"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              background: 'rgba(139, 92, 246, 0.12)',
            }}
          />
          {/* Corner dots */}
          {[
            { left: rect.x - 4, top: rect.y - 4 },
            { left: rect.x + rect.w - 4, top: rect.y - 4 },
            { left: rect.x - 4, top: rect.y + rect.h - 4 },
            { left: rect.x + rect.w - 4, top: rect.y + rect.h - 4 },
          ].map((pos, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-purple-600 border border-white pointer-events-none"
              style={{ left: pos.left, top: pos.top }}
            />
          ))}
          {/* Dimension label */}
          <div
            className="absolute pointer-events-none text-[10px] font-bold text-purple-700 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-purple-200"
            style={{
              left: rect.x + rect.w / 2 - 30,
              top: rect.y - 22,
            }}
          >
            {Math.round(rect.w)} × {Math.round(rect.h)} px
          </div>
        </>
      )}
    </div>
  );
}