// Client-side helper to record activity-log entries.
// All takeoff mutations flow through the client handlers, so logging here keeps
// descriptions semantically rich (old/new names, target key measure, etc.).

export interface ActivityInput {
  action:
    | 'create'
    | 'rename'
    | 'update'
    | 'visibility'
    | 'delete'
    | 'duplicate'
    | 'assign'
    | 'unassign'
    | 'auto_takeoff';
  entityType?: 'measurement' | 'keyMeasure';
  entityId?: string | null;
  entityName?: string | null;
  description: string;
  metadata?: Record<string, any>;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (e) {
    // Logging must never break the main flow.
    console.error('logActivity error:', e);
  }
}
