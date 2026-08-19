export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const groups = await prisma.materialGroup.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        products: {
          include: { product: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return NextResponse.json(groups);
  } catch (error: any) {
    console.error('Failed to fetch material groups:', error);
    return NextResponse.json({ error: 'Failed to fetch material groups' }, { status: 500 });
  }
}
