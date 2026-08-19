export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const uses = await prisma.use.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(uses);
  } catch (error: any) {
    console.error('Failed to fetch uses:', error);
    return NextResponse.json({ error: 'Failed to fetch uses' }, { status: 500 });
  }
}
