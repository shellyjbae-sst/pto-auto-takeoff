'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Pencil,
  Ruler,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { SheetData } from '@/types/takeoff';

/* ==================== TYPES ==================== */

export interface DetectedSheet {
  pageIndex: number;
  aiName: string;        // AI-suggested name
  name: string;          // user-editable name
  aiScale: string;       // AI-detected scale
  scale: string;         // user-editable scale
  category: string;      // AI-inferred category
  confidence: number;    // 0-1 confidence in name/scale detection
  thumbnail?: string;    // base64 thumbnail (simulated)
}

interface PlanImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sheets: DetectedSheet[]) => void;
  existingSheets: SheetData[];
}

/* ==================== SCALE OPTIONS ==================== */
const COMMON_SCALES = [
  '1/8" = 1\'',
  '3/16" = 1\'',
  '1/4" = 1\'',
  '3/8" = 1\'',
  '1/2" = 1\'',
  '3/4" = 1\'',
  '1" = 1\'',
  '1-1/2" = 1\'',
  '3" = 1\'',
];

const SHEET_CATEGORIES = [
  'Floor Plans',
  'Elevations',
  'Sections',
  'Structural',
  'Foundation',
  'Roof Plans',
  'Framing Plans',
  'Details',
  'Electrical',
  'Mechanical',
  'Cover Sheet',
  'Other',
];

/* ==================== SIMULATED AI DETECTION ==================== */
function simulateSheetDetection(pageCount: number): DetectedSheet[] {
  const templates: { name: string; category: string; scale: string; conf: number }[] = [
    { name: 'A1.0 - Cover Sheet', category: 'Cover Sheet', scale: 'N/A', conf: 0.95 },
    { name: 'A1.1 - First Floor Plan', category: 'Floor Plans', scale: '1/4" = 1\'', conf: 0.97 },
    { name: 'A1.2 - Second Floor Plan', category: 'Floor Plans', scale: '1/4" = 1\'', conf: 0.96 },
    { name: 'A2.0 - Exterior Elevations', category: 'Elevations', scale: '1/4" = 1\'', conf: 0.93 },
    { name: 'A2.1 - Interior Elevations', category: 'Elevations', scale: '3/8" = 1\'', conf: 0.88 },
    { name: 'A3.0 - Building Sections', category: 'Sections', scale: '1/4" = 1\'', conf: 0.91 },
    { name: 'S1.0 - Foundation Plan', category: 'Foundation', scale: '1/4" = 1\'', conf: 0.94 },
    { name: 'S1.1 - Floor Framing Plan', category: 'Framing Plans', scale: '1/4" = 1\'', conf: 0.92 },
    { name: 'S2.0 - Roof Framing Plan', category: 'Roof Plans', scale: '1/4" = 1\'', conf: 0.89 },
    { name: 'S3.0 - Structural Details', category: 'Details', scale: '3/4" = 1\'', conf: 0.85 },
    { name: 'E1.0 - Electrical Plan', category: 'Electrical', scale: '1/4" = 1\'', conf: 0.90 },
    { name: 'M1.0 - Mechanical Plan', category: 'Mechanical', scale: '1/4" = 1\'', conf: 0.87 },
  ];

  const sheets: DetectedSheet[] = [];
  for (let i = 0; i < pageCount; i++) {
    const t = templates[i % templates.length];
    const confJitter = (Math.random() * 0.1 - 0.05);
    sheets.push({
      pageIndex: i,
      aiName: t.name,
      name: t.name,
      aiScale: t.scale,
      scale: t.scale,
      category: t.category,
      confidence: Math.min(0.99, Math.max(0.7, t.conf + confJitter)),
    });
  }
  return sheets;
}

/* ==================== STEP INDICATOR ==================== */
function StepIndicator({ step }: { step: number }) {
  const steps = ['Upload Plan', 'Review Sheets'];
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {i < step ? '\u2713' : i + 1}
            </div>
            <span className={`text-[11px] font-medium ${
              i <= step ? 'text-gray-800' : 'text-gray-400'
            }`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ==================== MAIN COMPONENT ==================== */
export default function PlanImportModal({ isOpen, onClose, onComplete, existingSheets }: PlanImportModalProps) {
  const [step, setStep] = useState(0); // 0=Upload, 1=Review
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [detectedSheets, setDetectedSheets] = useState<DetectedSheet[]>([]);
  const [expandedSheet, setExpandedSheet] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(0);
    setFileName('');
    setProcessing(false);
    setProcessingProgress(0);
    setDetectedSheets([]);
    setExpandedSheet(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  /* ---------- Upload & Simulate AI ---------- */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setProcessing(true);
    setProcessingProgress(0);

    // Simulate AI processing with progress
    const totalSteps = 8;
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
      setProcessingProgress(Math.round((i / totalSteps) * 100));
    }

    // Generate simulated detected sheets (5-10 pages)
    const pageCount = 5 + Math.floor(Math.random() * 6);
    const sheets = simulateSheetDetection(pageCount);
    setDetectedSheets(sheets);
    setProcessing(false);
    setStep(1);
  }, []);

  /* ---------- Sheet Editing ---------- */
  const updateSheet = useCallback((pageIndex: number, updates: Partial<DetectedSheet>) => {
    setDetectedSheets(prev => prev.map(s =>
      s.pageIndex === pageIndex ? { ...s, ...updates } : s
    ));
  }, []);

  /* ---------- Confirm Import ---------- */
  const handleConfirm = useCallback(() => {
    onComplete(detectedSheets);
    reset();
  }, [detectedSheets, onComplete, reset]);

  if (!isOpen) return null;

  const allNamed = detectedSheets.every(s => s.name.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Import Plan</h2>
              <p className="text-[10px] text-gray-400">Upload PDF plans and configure sheet names & scales</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 0 && (
            <StepUpload
              fileName={fileName}
              processing={processing}
              progress={processingProgress}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
            />
          )}
          {step === 1 && (
            <StepReview
              sheets={detectedSheets}
              expandedSheet={expandedSheet}
              onExpandSheet={setExpandedSheet}
              onUpdateSheet={updateSheet}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50/50">
          <div className="text-[10px] text-gray-400">
            {step === 1 && `${detectedSheets.length} sheets detected from ${fileName}`}
          </div>
          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                onClick={() => setStep(0)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {step === 1 && (
              <button
                onClick={handleConfirm}
                disabled={!allNamed}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 rounded-lg transition-colors"
              >
                Import {detectedSheets.length} Sheets
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== STEP: UPLOAD ==================== */
function StepUpload({
  fileName,
  processing,
  progress,
  fileInputRef,
  onFileSelect,
}: {
  fileName: string;
  processing: boolean;
  progress: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="px-5 py-8 flex flex-col items-center">
      {processing ? (
        // Processing state
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">Analyzing Plan</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{fileName}</p>
          </div>
          <div className="w-full">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span>Detecting sheets, names & scales...</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 w-full mt-2">
            {[
              { label: 'Parsing PDF pages', done: progress > 20 },
              { label: 'Detecting title blocks', done: progress > 40 },
              { label: 'Reading sheet names', done: progress > 60 },
              { label: 'Measuring scales', done: progress > 80 },
              { label: 'Classifying sheet types', done: progress > 95 },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                {item.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : progress > (i * 20) ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />
                )}
                <span className={item.done ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Upload state
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-sm border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">Upload Plan PDF</p>
              <p className="text-[11px] text-gray-400 mt-1">Click to browse or drag & drop</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <FileText className="w-3 h-3" />
              <span>PDF files only</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={onFileSelect}
          />
          <div className="mt-6 flex flex-col items-center gap-1.5 text-[10px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>AI will auto-detect sheet names, scales, and categories</span>
            </div>
            <span>You can review and edit everything before importing</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ==================== SHEET PREVIEW (Simulated Blueprint) ==================== */
function SheetPreview({ sheet }: { sheet: DetectedSheet }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#e2e6ea';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = 0; x <= w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Drawing border
    const margin = 30;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // Simulate floor plan based on category
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    const cat = sheet.category.toLowerCase();
    if (cat.includes('floor') || cat.includes('framing')) {
      // Outer walls
      const ox = margin + 15, oy = margin + 15;
      const ow = w - margin * 2 - 30, oh = h - margin * 2 - 50;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, ow, oh);

      // Interior walls
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      const wallX1 = ox + ow * 0.4;
      ctx.beginPath(); ctx.moveTo(wallX1, oy); ctx.lineTo(wallX1, oy + oh * 0.65); ctx.stroke();
      const wallY1 = oy + oh * 0.45;
      ctx.beginPath(); ctx.moveTo(ox, wallY1); ctx.lineTo(wallX1, wallY1); ctx.stroke();
      const wallX2 = ox + ow * 0.7;
      ctx.beginPath(); ctx.moveTo(wallX2, oy + oh * 0.3); ctx.lineTo(wallX2, oy + oh); ctx.stroke();

      // Doors (arcs)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 0.8;
      const drawDoor = (dx: number, dy: number, size: number, angle: number) => {
        ctx.beginPath();
        ctx.arc(dx, dy, size, angle, angle + Math.PI / 2);
        ctx.stroke();
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(dx, dy);
        ctx.lineTo(dx + Math.cos(angle + Math.PI / 2) * size, dy + Math.sin(angle + Math.PI / 2) * size);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      drawDoor(wallX1, wallY1 - 20, 16, 0);
      drawDoor(wallX2, oy + oh * 0.55, 16, Math.PI);

      // Windows (double lines)
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1;
      const winW = 25;
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(ox + 20, oy - 2, winW, 4);
      ctx.strokeRect(ox + 20, oy - 2, winW, 4);
      ctx.fillRect(ox + ow - 45, oy - 2, winW, 4);
      ctx.strokeRect(ox + ow - 45, oy - 2, winW, 4);

      // Room labels
      ctx.fillStyle = '#64748b';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LIVING', ox + ow * 0.2, oy + oh * 0.25);
      ctx.fillText('KITCHEN', ox + ow * 0.2, oy + oh * 0.7);
      ctx.fillText('BEDROOM', ox + ow * 0.55, oy + oh * 0.15);
      ctx.fillText('BATH', ox + ow * 0.55, oy + oh * 0.55);
      ctx.fillText('GARAGE', ox + ow * 0.85, oy + oh * 0.65);
    } else if (cat.includes('elevation')) {
      // Simple elevation
      const bx = margin + 40, by = h - margin - 40;
      const bw = w - margin * 2 - 80, bh = h - margin * 2 - 80;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by - bh, bw, bh);
      // Roof triangle
      ctx.beginPath();
      ctx.moveTo(bx - 10, by - bh);
      ctx.lineTo(bx + bw / 2, by - bh - 50);
      ctx.lineTo(bx + bw + 10, by - bh);
      ctx.closePath();
      ctx.stroke();
      // Windows
      ctx.strokeStyle = '#93c5fd';
      ctx.fillStyle = '#dbeafe';
      for (let i = 0; i < 3; i++) {
        const wx = bx + 25 + i * (bw / 3);
        ctx.fillRect(wx, by - bh + 30, 25, 35);
        ctx.strokeRect(wx, by - bh + 30, 25, 35);
      }
      // Door
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(bx + bw / 2 - 12, by - 50, 24, 50);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(bx + bw / 2 - 12, by - 50, 24, 50);
    } else {
      // Generic structural/detail page
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const bx = margin + 20 + i * ((w - margin * 2 - 40) / 3);
        const by = margin + 20;
        const bw2 = (w - margin * 2 - 60) / 3;
        const bh2 = (h - margin * 2 - 60) / 2;
        ctx.strokeRect(bx, by, bw2, bh2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(bx + 5, by + 5, bw2 - 10, 6);
        ctx.fillRect(bx + 5, by + 15, bw2 * 0.6, 3);
      }
    }

    // Title block (bottom right)
    const tbW = 120, tbH = 35;
    const tbX = w - margin - tbW, tbY = h - margin - tbH;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(tbX, tbY, tbW, tbH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(tbX, tbY, tbW, tbH);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sheet.name.substring(0, 20), tbX + 4, tbY + 12);
    ctx.fillStyle = '#64748b';
    ctx.font = '6px sans-serif';
    ctx.fillText(`Scale: ${sheet.scale}`, tbX + 4, tbY + 22);
    ctx.fillText(`Page ${sheet.pageIndex + 1}`, tbX + 4, tbY + 30);

    // Scale bar indicator
    if (sheet.scale !== 'N/A') {
      const sbY = h - margin - tbH - 15;
      const sbX = w - margin - 100;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + 60, sbY); ctx.stroke();
      // Ticks
      ctx.beginPath(); ctx.moveTo(sbX, sbY - 4); ctx.lineTo(sbX, sbY + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sbX + 60, sbY - 4); ctx.lineTo(sbX + 60, sbY + 4); ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sheet.scale, sbX + 30, sbY - 6);

      // AI scale detection overlay box
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(sbX - 10, sbY - 18, 80, 28);
      ctx.setLineDash([]);
      ctx.fillStyle = '#8b5cf6';
      ctx.font = '5px sans-serif';
      ctx.fillText('AI DETECTED', sbX + 30, sbY + 17);
    }
  }, [sheet]);

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-200/60 border-b border-gray-200">
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
          Page {sheet.pageIndex + 1} Preview
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-gray-400">{sheet.category}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="rounded shadow-sm bg-white"
          style={{ imageRendering: 'auto' }}
        />
      </div>
    </div>
  );
}

/* ==================== STEP: REVIEW SHEETS ==================== */
function StepReview({
  sheets,
  expandedSheet,
  onExpandSheet,
  onUpdateSheet,
}: {
  sheets: DetectedSheet[];
  expandedSheet: number | null;
  onExpandSheet: (idx: number | null) => void;
  onUpdateSheet: (pageIndex: number, updates: Partial<DetectedSheet>) => void;
}) {
  const activeSheet = expandedSheet !== null ? sheets[expandedSheet] : null;

  return (
    <div className="flex h-[420px]">
      {/* Left: Sheet list */}
      <div className="w-[300px] min-w-[300px] border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold text-gray-700">Detected Sheets</span>
          <span className="text-[10px] text-gray-400 ml-auto">{sheets.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sheets.map((sheet, idx) => {
            const isSelected = expandedSheet === idx;
            const nameEdited = sheet.name !== sheet.aiName;
            const confBadge = sheet.confidence >= 0.9 ? 'text-emerald-600 bg-emerald-50' : sheet.confidence >= 0.8 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

            return (
              <button
                key={sheet.pageIndex}
                onClick={() => onExpandSheet(isSelected ? null : idx)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <span className="text-[9px] font-mono text-gray-400 w-5 flex-shrink-0">P{sheet.pageIndex + 1}</span>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-gray-700 truncate">
                    {sheet.name}
                    {nameEdited && <span className="text-[9px] text-blue-500 ml-1">*</span>}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-mono text-gray-400">{sheet.scale}</span>
                    <span className="text-[9px] text-gray-300">·</span>
                    <span className="text-[9px] text-gray-400">{sheet.category}</span>
                  </div>
                </div>
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${confBadge} flex-shrink-0`}>
                  {Math.round(sheet.confidence * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Preview + Edit */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSheet ? (
          <>
            {/* Preview area */}
            <div className="flex-1 p-3 overflow-hidden">
              <SheetPreview sheet={activeSheet} />
            </div>

            {/* Edit controls */}
            <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Sheet Name */}
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 mb-1">
                    <Pencil className="w-3 h-3" /> Sheet Name
                  </label>
                  <input
                    type="text"
                    value={activeSheet.name}
                    onChange={(e) => onUpdateSheet(activeSheet.pageIndex, { name: e.target.value })}
                    className="w-full h-8 px-2.5 text-[11px] border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {activeSheet.name !== activeSheet.aiName && (
                    <button
                      onClick={() => onUpdateSheet(activeSheet.pageIndex, { name: activeSheet.aiName })}
                      className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5"
                    >
                      Reset to AI: {activeSheet.aiName}
                    </button>
                  )}
                </div>

                {/* Scale */}
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 mb-1">
                    <Ruler className="w-3 h-3" /> Scale
                    <span className="ml-auto text-[8px] text-purple-500 font-normal flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> AI: {activeSheet.aiScale}
                    </span>
                  </label>
                  <select
                    value={COMMON_SCALES.includes(activeSheet.scale) ? activeSheet.scale : '__custom'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom') {
                        onUpdateSheet(activeSheet.pageIndex, { scale: e.target.value });
                      }
                    }}
                    className="w-full h-8 px-2 text-[11px] border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {COMMON_SCALES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    {!COMMON_SCALES.includes(activeSheet.scale) && activeSheet.scale !== 'N/A' && (
                      <option value="__custom">{activeSheet.scale} (custom)</option>
                    )}
                    <option value="N/A">N/A</option>
                  </select>
                  {activeSheet.scale !== activeSheet.aiScale && (
                    <button
                      onClick={() => onUpdateSheet(activeSheet.pageIndex, { scale: activeSheet.aiScale })}
                      className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5"
                    >
                      Reset to AI detected: {activeSheet.aiScale}
                    </button>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Category</label>
                  <select
                    value={activeSheet.category}
                    onChange={(e) => onUpdateSheet(activeSheet.pageIndex, { category: e.target.value })}
                    className="w-full h-8 px-2 text-[11px] border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {SHEET_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Confidence */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">AI Confidence</label>
                  <div className="flex items-center gap-2 h-8">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          activeSheet.confidence >= 0.9 ? 'bg-emerald-500' : activeSheet.confidence >= 0.8 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${activeSheet.confidence * 100}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${confColor(activeSheet.confidence)}`}>
                      {Math.round(activeSheet.confidence * 100)}%
                    </span>
                  </div>
                  {activeSheet.confidence < 0.85 && (
                    <div className="flex items-center gap-1 mt-0.5 text-[9px] text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>Low confidence — verify name and scale</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Select a sheet to preview</p>
              <p className="text-[10px] text-gray-300 mt-0.5">Click any sheet on the left to see the blueprint preview and edit details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function confColor(c: number): string {
  if (c >= 0.9) return 'text-emerald-600';
  if (c >= 0.8) return 'text-amber-600';
  return 'text-red-600';
}
