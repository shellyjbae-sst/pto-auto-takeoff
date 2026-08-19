export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    const original = await prisma.measurement.findUnique({ where: { id } });
    if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = original;
    const duplicate = await prisma.measurement.create({
      data: { ...data, name: `${data?.name ?? 'Copy'} (Copy)`, markupData: data?.markupData ?? {} },
    });
    return NextResponse.json(duplicate, { status: 201 });
  } catch (error: any) {
    console.error('Duplicate error:', error);
    return NextResponse.json({ error: 'Failed to duplicate' }, { status: 500 });
  }
}
