export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const assignmentInclude = {
  measurement: true,
  keyMeasure: true,
  materialGroup: true,
  section: true,
  use: true,
  products: { include: { product: true } },
} as const;

export async function GET() {
  try {
    const assignments = await prisma.assignment.findMany({
      include: assignmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error('GET assignments error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      measurementIds,
      targetType = 'keyMeasure',
      keyMeasureId = null,
      materialGroupId = null,
      productIds = [],
      multiplier = 1,
      useId = null,
      sectionId = null,
    } = body;

    const cleanMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    const results = [];

    for (const measurementId of (measurementIds ?? [])) {
      let assignment;

      if (targetType === 'keyMeasure' && keyMeasureId) {
        // Upsert on the unique measurement+keyMeasure pair
        assignment = await prisma.assignment.upsert({
          where: { measurementId_keyMeasureId: { measurementId, keyMeasureId } },
          update: {
            targetType,
            materialGroupId: null,
            sectionId: sectionId || null,
            useId: useId || null,
            multiplier: cleanMultiplier,
            fromQuickMeasure: true,
          },
          create: {
            measurementId,
            targetType,
            keyMeasureId,
            sectionId: sectionId || null,
            useId: useId || null,
            multiplier: cleanMultiplier,
            fromQuickMeasure: true,
          },
          include: assignmentInclude,
        });
      } else if (targetType === 'materialGroup' && materialGroupId) {
        // Find an existing material-group assignment for this measurement+group
        const existing = await prisma.assignment.findFirst({
          where: { measurementId, targetType: 'materialGroup', materialGroupId },
        });
        if (existing) {
          assignment = await prisma.assignment.update({
            where: { id: existing.id },
            data: {
              sectionId: sectionId || null,
              useId: useId || null,
              multiplier: cleanMultiplier,
              fromQuickMeasure: true,
            },
            include: assignmentInclude,
          });
        } else {
          assignment = await prisma.assignment.create({
            data: {
              measurementId,
              targetType,
              materialGroupId,
              sectionId: sectionId || null,
              useId: useId || null,
              multiplier: cleanMultiplier,
              fromQuickMeasure: true,
            },
            include: assignmentInclude,
          });
        }
      } else {
        // products-only assignment
        assignment = await prisma.assignment.create({
          data: {
            measurementId,
            targetType: 'products',
            sectionId: sectionId || null,
            useId: useId || null,
            multiplier: cleanMultiplier,
            fromQuickMeasure: true,
          },
          include: assignmentInclude,
        });
      }

      // Sync AssignmentProduct rows when productIds provided
      if (Array.isArray(productIds)) {
        await prisma.assignmentProduct.deleteMany({ where: { assignmentId: assignment.id } });
        for (const pid of productIds) {
          if (!pid) continue;
          await prisma.assignmentProduct.create({
            data: { assignmentId: assignment.id, productId: pid, quantity: 1 },
          });
        }
        assignment = await prisma.assignment.findUnique({
          where: { id: assignment.id },
          include: assignmentInclude,
        });
      }

      results.push(assignment);
    }
    return NextResponse.json(results, { status: 201 });
  } catch (error: any) {
    console.error('POST assignment error:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}
