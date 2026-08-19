export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const products = await prisma.keyMeasureProduct.findMany({
      where: { keyMeasureId: params.id },
      include: { product: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(products);
  } catch (error: any) {
    console.error('Failed to fetch key measure products:', error);
    return NextResponse.json({ error: 'Failed to fetch key measure products' }, { status: 500 });
  }
}
