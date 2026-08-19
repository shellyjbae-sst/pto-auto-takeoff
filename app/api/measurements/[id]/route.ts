export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const measurement = await prisma.measurement.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(measurement);
  } catch (error: any) {
    console.error('PATCH measurement error:', error);
    return NextResponse.json({ error: 'Failed to update measurement' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.measurement.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE measurement error:', error);
    return NextResponse.json({ error: 'Failed to delete measurement' }, { status: 500 });
  }
}
