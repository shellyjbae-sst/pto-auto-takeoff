'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Ruler, Sparkles, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { SheetData } from '@/types/takeoff';

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

interface ScaleDetectModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: SheetData;
  onScaleUpdate: (sheetId: string, scale: string) => void;
}

/* ---- Simulated Blueprint Preview (same rendering as import modal) ---- */
function SheetPreviewCanvas({ sheet }: { sheet: SheetData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = '#f8f9fc';
    ctx.fillRect(0, 0, w, h);

    // Border
    const margin = 20;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // Title block bottom-right
    const tbW = 160, tbH = 50;
    const tbX = w - margin - tbW, tbY = h - margin - tbH;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(tbX, tbY, tbW, tbH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(tbX, tbY, tbW, tbH);

    ctx.fillStyle = '#475569';
    ctx.font = '9px monospace';
    ctx.fillText(sheet.name, tbX + 6, tbY + 16);
    ctx.fillStyle = '#64748b';
    ctx.font = '8px monospace';
    ctx.fillText(`Scale: ${sheet.scale || 'N/A'}`, tbX + 6, tbY + 30);
    ctx.fillText(`Page ${(sheet.pageIndex ?? 0) + 1}`, tbX + 6, tbY + 42);

    // Simulate drawing based on category
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    const cat = (sheet.category || 'other').toLowerCase();

    if (cat.includes('floor') || cat.includes('framing')) {
      const ox = margin + 15, oy = margin + 15;
      const ow = w - margin * 2 - 30, oh = h - margin * 2 - 70;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, ow, oh);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      const wallX = ox + ow * 0.4;
      ctx.beginPath(); ctx.moveTo(wallX, oy); ctx.lineTo(wallX, oy + oh * 0.65); ctx.stroke();
      const wallY = oy + oh * 0.45;
      ctx.beginPath(); ctx.moveTo(ox, wallY); ctx.lineTo(wallX, wallY); ctx.stroke();
    } else if (cat.includes('elevation')) {
      const bx = margin + 40, by = margin + 30;
      const bw = w - margin * 2 - 80, bh = h - margin * 2 - 90;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      // Roof
      ctx.beginPath();
      ctx.moveTo(bx - 10, by);
      ctx.lineTo(bx + bw / 2, by - 30);
      ctx.lineTo(bx + bw + 10, by);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Generic details
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          const dx = margin + 25 + c * (w / 2 - 25);
          const dy = margin + 25 + r * 55;
          ctx.strokeRect(dx, dy, (w / 2 - 50), 45);
        }
      }
    }

    // Grid lines (subtle)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.3;
    for (let x = margin; x <= w - margin; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, h - margin); ctx.stroke();
    }
    for (let y = margin; y <= h - margin; y += 30) {
      ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(w - margin, y); ctx.stroke();
    }
  }, [sheet]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

/* ---- Scale Detection Modal ---- */
export default function ScaleDetectModal({ isOpen, onClose, sheet, onScaleUpdate }: ScaleDetectModalProps) {
  const [phase, setPhase] = useState<'detecting' | 'result'>('detecting');
  const [detectedScale, setDetectedScale] = useState<string>('');
  const [selectedScale, setSelectedScale] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Run simulated detection when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setPhase('detecting');
    setDetectedScale('');
    setSelectedScale('');

    // Simulate AI detection (1.5-2.5s)
    const delay = 1500 + Math.random() * 1000;
    const timer = setTimeout(() => {
      // Pick a scale from common scales (simulated AI result)
      const idx = Math.abs(sheet.name.charCodeAt(0) + (sheet.pageIndex ?? 0) * 7) % COMMON_SCALES.length;
      const detected = COMMON_SCALES[idx];
      setDetectedScale(detected);
      setSelectedScale(detected);
      setPhase('result');
    }, delay);

    return () => clearTimeout(timer);
  }, [isOpen, sheet]);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      onScaleUpdate(sheet.id, selectedScale);
    } finally {
      setSaving(false);
      onClose();
    }
  }, [sheet.id, selectedScale, onScaleUpdate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Auto Scale Detection</h3>
              <p className="text-[10px] text-gray-500">AI-powered scale analysis for {sheet.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="flex gap-4">
            {/* Preview */}
            <div className="flex-1 rounded-lg border border-gray-200 bg-white overflow-hidden" style={{ height: 280 }}>
              <SheetPreviewCanvas sheet={sheet} />
            </div>

            {/* Right side — detection result */}
            <div className="w-56 flex flex-col gap-3">
              {/* Current Scale */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Current Scale</p>
                <div className="flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-mono text-gray-700">{sheet.scale || 'Not set'}</span>
                </div>
              </div>

              {/* AI Detection status */}
              {phase === 'detecting' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-blue-50/50 rounded-lg p-4">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-medium text-blue-700">Analyzing sheet...</p>
                    <p className="text-[10px] text-blue-500 mt-1">Detecting scale from title block and drawing elements</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Detected result */}
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider">AI Detected</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-green-800">{detectedScale}</p>
                  </div>

                  {/* Scale selector */}
                  <div>
                    <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block mb-1">Use Scale</label>
                    <div className="relative">
                      <select
                        value={COMMON_SCALES.includes(selectedScale) ? selectedScale : '__custom'}
                        onChange={(e) => {
                          if (e.target.value !== '__custom') {
                            setSelectedScale(e.target.value);
                          }
                        }}
                        className="w-full h-8 px-2 pr-7 text-xs font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                      >
                        {COMMON_SCALES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="N/A">N/A</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    {selectedScale !== detectedScale && (
                      <button
                        onClick={() => setSelectedScale(detectedScale)}
                        className="text-[9px] text-blue-500 hover:text-blue-700 mt-1"
                      >
                        Reset to AI detected: {detectedScale}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={phase === 'detecting' || saving}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Apply Scale
          </button>
        </div>
      </div>
    </div>
  );
}
