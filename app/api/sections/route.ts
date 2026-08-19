export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sections = await prisma.section.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(sections);
  } catch (error: any) {
    console.error('GET sections error:', error);
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
  }
}
