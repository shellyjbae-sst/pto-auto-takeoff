export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json(activities);
  } catch (error: any) {
    console.error('GET activity error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      entityType = 'measurement',
      entityId = null,
      entityName = null,
      description,
      metadata = {},
    } = body ?? {};

    if (!action || !description) {
      return NextResponse.json({ error: 'action and description are required' }, { status: 400 });
    }

    const entry = await prisma.activityLog.create({
      data: { action, entityType, entityId, entityName, description, metadata },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error('POST activity error:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}
