'use client';

import React, { useState } from 'react';
import { X, Square, Minus, Circle } from 'lucide-react';

interface NewMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; type: string; color: string; value: number; unit: string }) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1'];

export default function NewMeasurementModal({ isOpen, onClose, onCreate }: NewMeasurementModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'area' | 'linear' | 'count'>('area');
  const [color, setColor] = useState('#3B82F6');
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const unitMap: Record<string, string> = { area: 'SQ FT', linear: 'LF', count: 'EA' };

  const handleCreate = () => {
    if (!name?.trim?.()) return;
    onCreate?.({
      name: name.trim(),
      type,
      color,
      value: parseFloat(value) || 0,
      unit: unitMap[type] ?? 'SQ FT',
    });
    setName('');
    setType('area');
    setColor('#3B82F6');
    setValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[400px] max-w-[95vw]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">New Measurement</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e?.target?.value ?? '')}
              placeholder="e.g., Storage Room"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2">
              {([{ key: 'area', label: 'Area', icon: Square }, { key: 'linear', label: 'Linear', icon: Minus }, { key: 'count', label: 'Count', icon: Circle }] as const).map((t: any) => (
                <button
                  key={t?.key}
                  onClick={() => setType(t?.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md border transition-colors ${
                    type === t?.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t?.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c: string) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value ({unitMap[type] ?? 'SQ FT'})</label>
            <input
              type="number"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e?.target?.value ?? '')}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name?.trim?.()}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              name?.trim?.() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
