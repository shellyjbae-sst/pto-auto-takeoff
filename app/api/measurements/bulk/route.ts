export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { ids, action } = await request.json();
    if (action === 'delete') {
      await prisma.measurement.deleteMany({ where: { id: { in: ids ?? [] } } });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Bulk measurement error:', error);
    return NextResponse.json({ error: 'Failed to process bulk action' }, { status: 500 });
  }
}
