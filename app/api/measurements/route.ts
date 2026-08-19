export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const measurements = await prisma.measurement.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { assignments: { include: { keyMeasure: true, section: true } } },
    });
    return NextResponse.json(measurements);
  } catch (error: any) {
    console.error('GET measurements error:', error);
    return NextResponse.json({ error: 'Failed to fetch measurements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const measurement = await prisma.measurement.create({ data: body });
    return NextResponse.json(measurement, { status: 201 });
  } catch (error: any) {
    console.error('POST measurement error:', error);
    return NextResponse.json({ error: 'Failed to create measurement' }, { status: 500 });
  }
}
