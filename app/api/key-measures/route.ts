export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const keyMeasures = await prisma.keyMeasure.findMany({ orderBy: { sortOrder: 'asc' } });
    return NextResponse.json(keyMeasures);
  } catch (error: any) {
    console.error('GET key measures error:', error);
    return NextResponse.json({ error: 'Failed to fetch key measures' }, { status: 500 });
  }
}

// POST: create a new KM or copy an existing one
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Copy mode: duplicate an existing KM into a target category/subcategory
    if (body.copyFromId) {
      const source = await prisma.keyMeasure.findUnique({ where: { id: body.copyFromId } });
      if (!source) return NextResponse.json({ error: 'Source KM not found' }, { status: 404 });
      const copy = await prisma.keyMeasure.create({
        data: {
          name: source.name,
          color: source.color,
          type: source.type,
          category: body.category ?? source.category,
          subcategory: body.subcategory !== undefined ? body.subcategory : source.subcategory,
          sortOrder: body.sortOrder ?? source.sortOrder,
        },
      });
      return NextResponse.json(copy, { status: 201 });
    }

    // Create mode
    const km = await prisma.keyMeasure.create({
      data: {
        name: body.name,
        color: body.color ?? '#3B82F6',
        type: body.type ?? 'area',
        category: body.category ?? 'General',
        subcategory: body.subcategory ?? null,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return NextResponse.json(km, { status: 201 });
  } catch (error: any) {
    console.error('POST key measure error:', error);
    return NextResponse.json({ error: 'Failed to create key measure' }, { status: 500 });
  }
}

// PUT: update a KM (move, rename, change category/subcategory)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.color !== undefined) data.color = body.color;
    if (body.type !== undefined) data.type = body.type;
    if (body.category !== undefined) data.category = body.category;
    if (body.subcategory !== undefined) data.subcategory = body.subcategory;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const updated = await prisma.keyMeasure.update({ where: { id: body.id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT key measure error:', error);
    return NextResponse.json({ error: 'Failed to update key measure' }, { status: 500 });
  }
}

// DELETE: remove a KM
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.keyMeasure.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE key measure error:', error);
    return NextResponse.json({ error: 'Failed to delete key measure' }, { status: 500 });
  }
}

// PATCH: batch reorder (update sortOrder, category, subcategory for multiple KMs)
export async function PATCH(request: Request) {
  try {
    const { updates } = await request.json();
    if (!Array.isArray(updates)) return NextResponse.json({ error: 'updates array required' }, { status: 400 });
    await prisma.$transaction(
      updates.map((u: any) => {
        const data: any = {};
        if (u.sortOrder !== undefined) data.sortOrder = u.sortOrder;
        if (u.category !== undefined) data.category = u.category;
        if (u.subcategory !== undefined) data.subcategory = u.subcategory;
        return prisma.keyMeasure.update({ where: { id: u.id }, data });
      })
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PATCH key measures reorder error:', error);
    return NextResponse.json({ error: 'Failed to reorder key measures' }, { status: 500 });
  }
}
