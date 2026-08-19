'use client';

import React from 'react';
import { ActivityData, ActivityAction } from '@/types/takeoff';
import {
  X,
  Plus,
  Pencil,
  Eye,
  Trash2,
  Copy,
  Link2,
  Unlink,
  Sparkles,
  SlidersHorizontal,
  Activity as ActivityIcon,
  RotateCw,
} from 'lucide-react';

interface ActivityLogProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityData[];
  loading?: boolean;
  onRefresh?: () => void;
}

const ACTION_META: Record<ActivityAction, { Icon: any; tint: string }> = {
  create: { Icon: Plus, tint: 'bg-gray-900 text-white' },
  rename: { Icon: Pencil, tint: 'bg-gray-100 text-gray-700' },
  update: { Icon: SlidersHorizontal, tint: 'bg-gray-100 text-gray-700' },
  visibility: { Icon: Eye, tint: 'bg-gray-100 text-gray-700' },
  delete: { Icon: Trash2, tint: 'bg-gray-100 text-gray-700' },
  duplicate: { Icon: Copy, tint: 'bg-gray-100 text-gray-700' },
  assign: { Icon: Link2, tint: 'bg-gray-900 text-white' },
  unassign: { Icon: Unlink, tint: 'bg-gray-100 text-gray-700' },
  auto_takeoff: { Icon: Sparkles, tint: 'bg-gray-900 text-white' },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export default function ActivityLog({ isOpen, onClose, activities, loading, onRefresh }: ActivityLogProps) {
  // Tick to keep relative timestamps fresh while the drawer is open.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-[380px] max-w-[90vw] bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="h-12 flex items-center gap-2 px-4 border-b border-gray-200 flex-shrink-0">
          <ActivityIcon className="w-4 h-4 text-gray-900" />
          <h2 className="text-sm font-semibold text-gray-900">Activity Log</h2>
          <div className="flex-1" />
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              title="Refresh"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading activity...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-8 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <ActivityIcon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No activity yet</p>
              <p className="text-xs text-gray-400">
                Changes to Quick Measures and Key Measure assignments will appear here.
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {activities.map((a) => {
                const meta = ACTION_META[a.action as ActivityAction] ?? {
                  Icon: SlidersHorizontal,
                  tint: 'bg-gray-100 text-gray-700',
                };
                const Icon = meta.Icon;
                return (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.tint}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 leading-snug break-words">{a.description}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5" title={absoluteTime(a.createdAt)}>
                        {relativeTime(a.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
