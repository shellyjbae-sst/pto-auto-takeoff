export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sheets = await prisma.sheet.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(sheets);
  } catch (error: any) {
    console.error('GET sheets error:', error);
    return NextResponse.json({ error: 'Failed to fetch sheets' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Support batch creation: body.sheets = [{ name, category, scale, pageIndex, sortOrder }]
    if (Array.isArray(body.sheets)) {
      const created = [];
      for (const s of body.sheets) {
        const sheet = await prisma.sheet.create({
          data: {
            name: s.name ?? 'Untitled Sheet',
            category: s.category ?? 'Floor Plans',
            scale: s.scale ?? '1/4" = 1\'',
            pageIndex: s.pageIndex ?? 0,
            sortOrder: s.sortOrder ?? 0,
          },
        });
        created.push(sheet);
      }
      return NextResponse.json(created);
    }
    // Single creation
    const sheet = await prisma.sheet.create({
      data: {
        name: body.name ?? 'Untitled Sheet',
        category: body.category ?? 'Floor Plans',
        scale: body.scale ?? '1/4" = 1\'',
        pageIndex: body.pageIndex ?? 0,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return NextResponse.json(sheet);
  } catch (error: any) {
    console.error('POST sheets error:', error);
    return NextResponse.json({ error: 'Failed to create sheet(s)' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    // Batch update: body.updates = [{ id, name?, scale?, category? }]
    if (Array.isArray(body.updates)) {
      const updated = [];
      for (const u of body.updates) {
        if (!u.id) continue;
        const data: any = {};
        if (u.name !== undefined) data.name = u.name;
        if (u.scale !== undefined) data.scale = u.scale;
        if (u.category !== undefined) data.category = u.category;
        if (u.pageIndex !== undefined) data.pageIndex = u.pageIndex;
        if (u.sortOrder !== undefined) data.sortOrder = u.sortOrder;
        const sheet = await prisma.sheet.update({ where: { id: u.id }, data });
        updated.push(sheet);
      }
      return NextResponse.json(updated);
    }
    return NextResponse.json({ error: 'Expected { updates: [...] }' }, { status: 400 });
  } catch (error: any) {
    console.error('PATCH sheets error:', error);
    return NextResponse.json({ error: 'Failed to update sheets' }, { status: 500 });
  }
}
