'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  KeyMeasureData,
  SectionData,
  UseData,
  ProductData,
  MaterialGroupData,
  KeyMeasureProductData,
  AssignmentPayload,
  AssignmentTargetType,
} from '@/types/takeoff';
import { X, Search, Check, Plus, Package, Layers, Boxes } from 'lucide-react';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (payload: AssignmentPayload) => void;
  measurementNames: string[];
  anchorRect?: DOMRect | null;
}

const TARGET_TABS: { key: AssignmentTargetType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'keyMeasure', label: 'Key Measure', icon: Layers },
  { key: 'materialGroup', label: 'Material Group', icon: Boxes },
  { key: 'products', label: 'Products', icon: Package },
];

export default function AssignModal({ isOpen, onClose, onApply, measurementNames, anchorRect }: AssignModalProps) {
  const [keyMeasures, setKeyMeasures] = useState<KeyMeasureData[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [uses, setUses] = useState<UseData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [materialGroups, setMaterialGroups] = useState<MaterialGroupData[]>([]);

  const [targetType, setTargetType] = useState<AssignmentTargetType>('keyMeasure');
  const [selectedKM, setSelectedKM] = useState<string>('');
  const [selectedMG, setSelectedMG] = useState<string>('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [multiplier, setMultiplier] = useState<string>('1');
  const [selectedUse, setSelectedUse] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  const [kmSearch, setKmSearch] = useState('');
  const [mgSearch, setMgSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [kmDropdownOpen, setKmDropdownOpen] = useState(false);
  const [mgDropdownOpen, setMgDropdownOpen] = useState(false);
  const [addProdOpen, setAddProdOpen] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/key-measures').then((r: any) => r?.json?.()).then((d: any) => setKeyMeasures(d ?? [])).catch(() => {});
      fetch('/api/sections').then((r: any) => r?.json?.()).then((d: any) => setSections(d ?? [])).catch(() => {});
      fetch('/api/uses').then((r: any) => r?.json?.()).then((d: any) => setUses(d ?? [])).catch(() => {});
      fetch('/api/products').then((r: any) => r?.json?.()).then((d: any) => setProducts(d ?? [])).catch(() => {});
      fetch('/api/material-groups').then((r: any) => r?.json?.()).then((d: any) => setMaterialGroups(d ?? [])).catch(() => {});
      setTargetType('keyMeasure');
      setSelectedKM('');
      setSelectedMG('');
      setProductIds([]);
      setMultiplier('1');
      setSelectedUse('');
      setSelectedSection('');
      setKmSearch('');
      setMgSearch('');
      setProdSearch('');
      setKmDropdownOpen(false);
      setMgDropdownOpen(false);
      setAddProdOpen(false);
    }
  }, [isOpen]);

  // When a Key Measure is selected, load its subcomponent products into the editable list
  useEffect(() => {
    if (!selectedKM) return;
    fetch(`/api/key-measures/${selectedKM}/products`)
      .then((r: any) => r?.json?.())
      .then((d: KeyMeasureProductData[]) => {
        const ids = (d ?? []).map((kp) => kp?.productId).filter(Boolean) as string[];
        setProductIds(ids);
      })
      .catch(() => {});
  }, [selectedKM]);

  // When a Material Group is selected, load its products into the editable list
  useEffect(() => {
    if (!selectedMG) return;
    const mg = (materialGroups ?? []).find((g) => g?.id === selectedMG);
    const ids = (mg?.products ?? []).map((mp) => mp?.productId).filter(Boolean) as string[];
    setProductIds(ids);
  }, [selectedMG, materialGroups]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  const productMap = useMemo(() => {
    const m: Record<string, ProductData> = {};
    (products ?? []).forEach((p) => { if (p?.id) m[p.id] = p; });
    return m;
  }, [products]);

  if (!isOpen) return null;

  const filteredKM = (keyMeasures ?? []).filter((km: KeyMeasureData) =>
    (km?.name ?? '').toLowerCase().includes((kmSearch ?? '').toLowerCase())
  );
  const filteredMG = (materialGroups ?? []).filter((g: MaterialGroupData) =>
    (g?.name ?? '').toLowerCase().includes((mgSearch ?? '').toLowerCase())
  );
  const availableProducts = (products ?? []).filter((p: ProductData) =>
    !productIds.includes(p?.id) &&
    (p?.name ?? '').toLowerCase().includes((prodSearch ?? '').toLowerCase())
  );

  const selectedKMName = (keyMeasures ?? []).find((km) => km?.id === selectedKM)?.name ?? '';
  const selectedMGName = (materialGroups ?? []).find((g) => g?.id === selectedMG)?.name ?? '';

  const toggleProduct = (id: string) => {
    setProductIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };
  const addProduct = (id: string) => {
    setProductIds((prev) => prev.includes(id) ? prev : [...prev, id]);
    setProdSearch('');
    setAddProdOpen(false);
  };

  const canApply =
    (targetType === 'keyMeasure' && !!selectedKM) ||
    (targetType === 'materialGroup' && !!selectedMG) ||
    (targetType === 'products' && productIds.length > 0);

  const handleApply = () => {
    if (!canApply) return;
    const mult = parseFloat(multiplier);
    onApply?.({
      targetType,
      keyMeasureId: targetType === 'keyMeasure' ? (selectedKM || null) : null,
      materialGroupId: targetType === 'materialGroup' ? (selectedMG || null) : null,
      productIds,
      multiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
      useId: selectedUse || null,
      sectionId: selectedSection || null,
    });
  };

  const switchTarget = (t: AssignmentTargetType) => {
    setTargetType(t);
    setProductIds([]);
    setSelectedKM('');
    setSelectedMG('');
    setKmDropdownOpen(false);
    setMgDropdownOpen(false);
    setAddProdOpen(false);
  };

  // Popover position
  const popoverWidth = 380;
  let popoverStyle: React.CSSProperties;
  if (anchorRect) {
    // Keep the popover clear of the measures panel so the row being assigned stays visible
    const panelLeft = typeof document !== 'undefined'
      ? (document.querySelector('[data-right-panel]') as HTMLElement | null)?.getBoundingClientRect().left
      : undefined;
    const rightBoundary = Math.min(anchorRect.left, panelLeft ?? anchorRect.left);
    let left = rightBoundary - popoverWidth - 12;
    let top = anchorRect.top - 20;
    if (left < 8) left = 8;
    if (top + 520 > window.innerHeight) top = window.innerHeight - 530;
    if (top < 8) top = 8;
    popoverStyle = { position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${popoverWidth}px` };
  } else {
    popoverStyle = { position: 'fixed', right: '356px', top: '50%', transform: 'translateY(-50%)', width: `${popoverWidth}px` };
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" />

      <div
        ref={popoverRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col"
        style={{ ...popoverStyle, maxHeight: 'calc(100vh - 24px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-800">Assign Measurement</h2>
          <button onClick={onClose} className="p-0.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3 overflow-y-auto">
          {/* Selected measurements info */}
          <div className="bg-gray-50 rounded-md px-2.5 py-1.5">
            <p className="text-[11px] text-gray-500">Assigning {(measurementNames ?? [])?.length ?? 0} measurement(s):</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate">{(measurementNames ?? []).join(', ')}</p>
          </div>

          {/* Target type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-md p-1">
              {TARGET_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = targetType === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => switchTarget(tab.key)}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] font-medium transition-colors ${
                      active ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key Measure selector */}
          {targetType === 'keyMeasure' && (
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">Key Measure *</label>
              <div
                className="border border-gray-300 rounded-md px-2.5 py-1.5 flex items-center gap-2 cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => { setKmDropdownOpen(!kmDropdownOpen); }}
              >
                <Search className="w-3.5 h-3.5 text-gray-400" />
                {selectedKM ? (
                  <span className="text-xs text-gray-800">{selectedKMName}</span>
                ) : (
                  <input
                    type="text"
                    value={kmSearch}
                    onChange={(e) => { setKmSearch(e?.target?.value ?? ''); setKmDropdownOpen(true); }}
                    onClick={(e) => { e.stopPropagation(); setKmDropdownOpen(true); }}
                    placeholder="Search key measures..."
                    className="text-xs flex-1 outline-none bg-transparent"
                  />
                )}
                {selectedKM && (
                  <button onClick={(e) => { e.stopPropagation(); setSelectedKM(''); setProductIds([]); }} className="ml-auto">
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
              {kmDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-[160px] overflow-y-auto">
                  {(filteredKM ?? []).map((km) => (
                    <button
                      key={km?.id}
                      onClick={() => { setSelectedKM(km?.id ?? ''); setKmDropdownOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2 transition-colors ${
                        selectedKM === km?.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {selectedKM === km?.id && <Check className="w-3 h-3 text-blue-500" />}
                      <div>
                        <div>{km?.name ?? ''}</div>
                        <div className="text-[10px] text-gray-400">{km?.category ?? ''}</div>
                      </div>
                    </button>
                  ))}
                  {(filteredKM ?? [])?.length === 0 && (
                    <div className="px-2.5 py-1.5 text-xs text-gray-400">No matches found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Material Group selector */}
          {targetType === 'materialGroup' && (
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Group *</label>
              <div
                className="border border-gray-300 rounded-md px-2.5 py-1.5 flex items-center gap-2 cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => { setMgDropdownOpen(!mgDropdownOpen); }}
              >
                <Search className="w-3.5 h-3.5 text-gray-400" />
                {selectedMG ? (
                  <span className="text-xs text-gray-800">{selectedMGName}</span>
                ) : (
                  <input
                    type="text"
                    value={mgSearch}
                    onChange={(e) => { setMgSearch(e?.target?.value ?? ''); setMgDropdownOpen(true); }}
                    onClick={(e) => { e.stopPropagation(); setMgDropdownOpen(true); }}
                    placeholder="Search material groups..."
                    className="text-xs flex-1 outline-none bg-transparent"
                  />
                )}
                {selectedMG && (
                  <button onClick={(e) => { e.stopPropagation(); setSelectedMG(''); setProductIds([]); }} className="ml-auto">
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
              {mgDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-[160px] overflow-y-auto">
                  {(filteredMG ?? []).map((g) => (
                    <button
                      key={g?.id}
                      onClick={() => { setSelectedMG(g?.id ?? ''); setMgDropdownOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2 transition-colors ${
                        selectedMG === g?.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {selectedMG === g?.id && <Check className="w-3 h-3 text-blue-500" />}
                      <div>
                        <div>{g?.name ?? ''}</div>
                        <div className="text-[10px] text-gray-400">{g?.category ?? ''} · {(g?.products ?? []).length} products</div>
                      </div>
                    </button>
                  ))}
                  {(filteredMG ?? [])?.length === 0 && (
                    <div className="px-2.5 py-1.5 text-xs text-gray-400">No matches found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Products list — shown for all target types (editable) */}
          {(targetType === 'products' || (targetType === 'keyMeasure' && selectedKM) || (targetType === 'materialGroup' && selectedMG)) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">
                  {targetType === 'products' ? 'Products *' : 'Products / Subcomponents'}
                </label>
                <span className="text-[10px] text-gray-400">{productIds.length} selected</span>
              </div>

              {productIds.length > 0 && (
                <div className="space-y-1 mb-1.5 max-h-[150px] overflow-y-auto">
                  {productIds.map((pid) => {
                    const p = productMap[pid];
                    return (
                      <div key={pid} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <Check className="w-3 h-3 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-800 truncate">{p?.name ?? pid}</div>
                          <div className="text-[10px] text-gray-400">{p?.category ?? ''}{p?.unit ? ` · ${p.unit}` : ''}</div>
                        </div>
                        <button onClick={() => toggleProduct(pid)} className="p-0.5 hover:bg-gray-200 rounded">
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add product */}
              <div className="relative">
                <button
                  onClick={() => setAddProdOpen(!addProdOpen)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 border border-dashed border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add product
                </button>
                {addProdOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                    <div className="p-1.5 border-b border-gray-100">
                      <input
                        type="text"
                        value={prodSearch}
                        onChange={(e) => setProdSearch(e?.target?.value ?? '')}
                        placeholder="Search products..."
                        autoFocus
                        className="w-full text-xs px-2 py-1 outline-none border border-gray-200 rounded"
                      />
                    </div>
                    <div className="max-h-[160px] overflow-y-auto">
                      {(availableProducts ?? []).map((p) => (
                        <button
                          key={p?.id}
                          onClick={() => addProduct(p?.id ?? '')}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 text-gray-700 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{p?.name ?? ''}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{p?.category ?? ''}</span>
                        </button>
                      ))}
                      {(availableProducts ?? [])?.length === 0 && (
                        <div className="px-2.5 py-1.5 text-xs text-gray-400">No products available</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Multiplier */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Multiplier (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e?.target?.value ?? '1')}
              placeholder="1"
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Multiplies the total quantity applied to each measurement.</p>
          </div>

          {/* Use */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Use (optional)</label>
            <select
              value={selectedUse}
              onChange={(e) => setSelectedUse(e?.target?.value ?? '')}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors bg-white text-gray-800"
            >
              <option value="">None</option>
              {(uses ?? []).map((u) => (
                <option key={u?.id} value={u?.id}>{u?.name ?? ''}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Section (optional)</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e?.target?.value ?? '')}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors bg-white text-gray-800"
            >
              <option value="">None</option>
              {(sections ?? []).map((s) => (
                <option key={s?.id} value={s?.id}>{s?.name ?? ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-lg shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              canApply ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
