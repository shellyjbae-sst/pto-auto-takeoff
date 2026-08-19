import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Sheets
  const sheets = [
    { id: 'sheet-a101', name: 'A-101 Ground Floor Plan', category: 'Floor Plans', scale: '1/4" = 1\'', pageIndex: 0, sortOrder: 0 },
    { id: 'sheet-a102', name: 'A-102 Second Floor Plan', category: 'Floor Plans', scale: '1/4" = 1\'', pageIndex: 1, sortOrder: 1 },
    { id: 'sheet-a201', name: 'A-201 North Elevation', category: 'Elevations', scale: '1/4" = 1\'', pageIndex: 2, sortOrder: 2 },
    { id: 'sheet-a202', name: 'A-202 South Elevation', category: 'Elevations', scale: '1/4" = 1\'', pageIndex: 3, sortOrder: 3 },
    { id: 'sheet-s101', name: 'S-101 Foundation Plan', category: 'Structural', scale: '1/4" = 1\'', pageIndex: 4, sortOrder: 4 },
    { id: 'sheet-m101', name: 'M-101 Mechanical Plan', category: 'Mechanical', scale: '1/8" = 1\'', pageIndex: 5, sortOrder: 5 },
  ];
  for (const s of sheets) {
    await prisma.sheet.upsert({ where: { id: s.id }, update: s, create: s });
  }

  // Key Measures (construction codes) - grouped by realistic categories
  // Each KM now has a type: area, linear, or count
  const keyMeasures = [
    // CONCRETE — with subcategories
    { id: 'km-concrete', name: 'SOG_4000', color: '#64748B', category: 'CONCRETE', subcategory: 'Slabs', type: 'area', sortOrder: 0 },
    { id: 'km-rebar', name: 'RB_4_GR60', color: '#DC2626', category: 'CONCRETE', subcategory: 'Reinforcing', type: 'linear', sortOrder: 1 },
    // LVL
    { id: 'km-joist', name: 'LVL_1178', color: '#92400E', category: 'LVL', subcategory: null, type: 'linear', sortOrder: 2 },
    { id: 'km-header', name: 'HDR_2x10', color: '#B45309', category: 'LVL', subcategory: null, type: 'count', sortOrder: 3 },
    // RIM BOARD
    { id: 'km-rimboard1', name: 'RIM_2x10', color: '#A16207', category: 'RIM BOARD', subcategory: null, type: 'linear', sortOrder: 4 },
    // ROOFING — with subcategories
    { id: 'km-roofing', name: 'RF_SHGL_30', color: '#7C3AED', category: 'ROOFING', subcategory: 'Shingles', type: 'area', sortOrder: 5 },
    { id: 'km-gutter', name: 'GT_ALU_5IN', color: '#6D28D9', category: 'ROOFING', subcategory: 'Gutters', type: 'linear', sortOrder: 6 },
    // SHEATHING
    { id: 'km-sheath1', name: 'SHTH_OSB_7/16', color: '#D97706', category: 'SHEATHING', subcategory: null, type: 'area', sortOrder: 7 },
    { id: 'km-sheath2', name: 'SHTH_PLY_3/4', color: '#CA8A04', category: 'SHEATHING', subcategory: null, type: 'area', sortOrder: 8 },
    // SIDING
    { id: 'km-siding1', name: 'SID_VNL_D4', color: '#0891B2', category: 'SIDING', subcategory: null, type: 'area', sortOrder: 9 },
    // SILL PLATE
    { id: 'km-sill1', name: 'SILL_2x6_PT', color: '#059669', category: 'SILL PLATE', subcategory: null, type: 'linear', sortOrder: 10 },
    // WALLS EXTERIOR — with subcategories
    { id: 'km-framing', name: 'WALL_EXT_2x4_10', color: '#0EA5E9', category: 'WALLS EXTERIOR', subcategory: '2x4 Walls', type: 'linear', sortOrder: 11 },
    { id: 'km-wallext2', name: 'WALL_EXT_2x4_12', color: '#0284C7', category: 'WALLS EXTERIOR', subcategory: '2x4 Walls', type: 'linear', sortOrder: 12 },
    { id: 'km-wallext3', name: 'WALL_EXT_2x6_10', color: '#0369A1', category: 'WALLS EXTERIOR', subcategory: '2x6 Walls', type: 'linear', sortOrder: 13 },
    // WALLS INTERIOR
    { id: 'km-drywall', name: 'DW_5/8_FRC', color: '#78716C', category: 'WALLS INTERIOR', subcategory: null, type: 'area', sortOrder: 14 },
    { id: 'km-paint', name: 'PT_INT_LTX', color: '#A3A3A3', category: 'WALLS INTERIOR', subcategory: null, type: 'area', sortOrder: 15 },
    // FINISHES — with subcategories
    { id: 'km-flooring', name: 'VCT_12x12', color: '#10B981', category: 'FINISHES', subcategory: 'Flooring', type: 'area', sortOrder: 16 },
    { id: 'km-ceiling', name: 'ACT_2x4', color: '#8B5CF6', category: 'FINISHES', subcategory: 'Ceiling', type: 'area', sortOrder: 17 },
    { id: 'km-carpet', name: 'FLR_CPT_28', color: '#EC4899', category: 'FINISHES', subcategory: 'Flooring', type: 'area', sortOrder: 18 },
    { id: 'km-deckboard', name: 'Deckboard', color: '#F59E0B', category: 'FINISHES', subcategory: 'Decking', type: 'area', sortOrder: 19 },
    // OPENINGS — with subcategories
    { id: 'km-window', name: 'WN_DH_36x60', color: '#2563EB', category: 'OPENINGS', subcategory: 'Windows', type: 'count', sortOrder: 20 },
    { id: 'km-ext-door', name: 'DR_EXT_36', color: '#3B82F6', category: 'OPENINGS', subcategory: 'Doors', type: 'count', sortOrder: 21 },
    { id: 'km-int-door', name: 'DR_INT_32', color: '#60A5FA', category: 'OPENINGS', subcategory: 'Doors', type: 'count', sortOrder: 22 },
    // INSULATION
    { id: 'km-insul-batt', name: 'INS_R19_BATT', color: '#F97316', category: 'INSULATION', subcategory: null, type: 'area', sortOrder: 23 },
    // ELECTRICAL
    { id: 'km-electrical', name: 'EL_DPX_20A', color: '#FBBF24', category: 'ELECTRICAL', subcategory: null, type: 'count', sortOrder: 24 },
    // PLUMBING
    { id: 'km-plumbing', name: 'PLB_FIX_GRP', color: '#06B6D4', category: 'PLUMBING', subcategory: null, type: 'count', sortOrder: 25 },
    // MECHANICAL
    { id: 'km-hvac-duct', name: 'HVAC_DT_12R', color: '#14B8A6', category: 'MECHANICAL', subcategory: null, type: 'linear', sortOrder: 26 },
    // FIRE PROTECTION
    { id: 'km-sprinkler', name: 'FP_SPK_PND', color: '#EF4444', category: 'FIRE PROTECTION', subcategory: null, type: 'count', sortOrder: 27 },
    // HARDWARE
    { id: 'km-hinge', name: 'HW_DS_Hinge', color: '#71717A', category: 'HARDWARE', subcategory: null, type: 'count', sortOrder: 28 },
  ];
  for (const km of keyMeasures) {
    await prisma.keyMeasure.upsert({ where: { id: km.id }, update: km, create: km });
  }

  // Sections
  const sections = [
    { id: 'sec-wing-a', name: 'Wing A - Administrative', sortOrder: 0 },
    { id: 'sec-wing-b', name: 'Wing B - Medical', sortOrder: 1 },
    { id: 'sec-common', name: 'Common Areas', sortOrder: 2 },
    { id: 'sec-exterior', name: 'Exterior', sortOrder: 3 },
  ];
  for (const sec of sections) {
    await prisma.section.upsert({ where: { id: sec.id }, update: sec, create: sec });
  }

  // Uses
  const uses = [
    { id: 'use-bid-estimate', name: 'Bid Estimate', sortOrder: 0 },
    { id: 'use-budget', name: 'Budget', sortOrder: 1 },
    { id: 'use-change-order', name: 'Change Order', sortOrder: 2 },
    { id: 'use-verification', name: 'Verification', sortOrder: 3 },
  ];
  for (const u of uses) {
    await prisma.use.upsert({ where: { id: u.id }, update: u, create: u });

  // Products — realistic construction materials with units
  const products = [
    // Framing lumber
    { id: 'prod-stud-2x4-8', name: '2x4x8 SPF Stud', sku: 'LBR-2X4-08', unit: 'EA', category: 'Framing', sortOrder: 0 },
    { id: 'prod-stud-2x4-10', name: '2x4x10 SPF Stud', sku: 'LBR-2X4-10', unit: 'EA', category: 'Framing', sortOrder: 1 },
    { id: 'prod-stud-2x6-10', name: '2x6x10 SPF Stud', sku: 'LBR-2X6-10', unit: 'EA', category: 'Framing', sortOrder: 2 },
    { id: 'prod-plate-2x4', name: '2x4 Pressure-Treated Plate', sku: 'LBR-PT-2X4', unit: 'LF', category: 'Framing', sortOrder: 3 },
    { id: 'prod-header-2x10', name: '2x10 Header Stock', sku: 'LBR-2X10', unit: 'LF', category: 'Framing', sortOrder: 4 },
    // Fasteners
    { id: 'prod-framing-nails', name: '16d Framing Nails', sku: 'FST-16D', unit: 'LB', category: 'Fasteners', sortOrder: 5 },
    { id: 'prod-drywall-screws', name: '1-5/8" Drywall Screws', sku: 'FST-DWS-158', unit: 'BX', category: 'Fasteners', sortOrder: 6 },
    { id: 'prod-roofing-nails', name: 'Galv. Roofing Nails', sku: 'FST-RFN', unit: 'LB', category: 'Fasteners', sortOrder: 7 },
    // Drywall & finishes
    { id: 'prod-drywall-58', name: '5/8" Type-X Drywall 4x8', sku: 'GYP-58-48', unit: 'SHT', category: 'Drywall', sortOrder: 8 },
    { id: 'prod-joint-compound', name: 'Joint Compound', sku: 'GYP-JC', unit: 'BKT', category: 'Drywall', sortOrder: 9 },
    { id: 'prod-drywall-tape', name: 'Drywall Joint Tape', sku: 'GYP-TAPE', unit: 'RL', category: 'Drywall', sortOrder: 10 },
    { id: 'prod-paint-int', name: 'Interior Latex Paint', sku: 'PNT-INT', unit: 'GAL', category: 'Finishes', sortOrder: 11 },
    // Roofing
    { id: 'prod-shingles', name: 'Architectural Shingles', sku: 'RF-SHGL', unit: 'SQ', category: 'Roofing', sortOrder: 12 },
    { id: 'prod-underlayment', name: 'Synthetic Underlayment', sku: 'RF-UL', unit: 'RL', category: 'Roofing', sortOrder: 13 },
    { id: 'prod-drip-edge', name: 'Aluminum Drip Edge', sku: 'RF-DE', unit: 'LF', category: 'Roofing', sortOrder: 14 },
    // Sheathing / insulation
    { id: 'prod-osb-716', name: '7/16" OSB Sheathing 4x8', sku: 'SHT-OSB-716', unit: 'SHT', category: 'Sheathing', sortOrder: 15 },
    { id: 'prod-house-wrap', name: 'House Wrap', sku: 'SHT-HW', unit: 'RL', category: 'Sheathing', sortOrder: 16 },
    { id: 'prod-batt-r19', name: 'R-19 Batt Insulation', sku: 'INS-R19', unit: 'BAG', category: 'Insulation', sortOrder: 17 },
    // Openings
    { id: 'prod-window-3660', name: 'Double-Hung Window 36x60', sku: 'WN-DH-3660', unit: 'EA', category: 'Openings', sortOrder: 18 },
    { id: 'prod-door-ext-36', name: 'Exterior Door 36" Prehung', sku: 'DR-EXT-36', unit: 'EA', category: 'Openings', sortOrder: 19 },
    { id: 'prod-door-hardware', name: 'Entry Door Hardware Set', sku: 'HW-ENTRY', unit: 'EA', category: 'Openings', sortOrder: 20 },
    { id: 'prod-flashing-tape', name: 'Window Flashing Tape', sku: 'WN-FT', unit: 'RL', category: 'Openings', sortOrder: 21 },
  ];
  for (const p of products) {
    await prisma.product.upsert({ where: { id: p.id }, update: p, create: p });
  }

  // Key Measure subcomponents (Products that make up each Key Measure)
  const kmProducts = [
    // Exterior 2x4 wall framing (km-framing)
    { keyMeasureId: 'km-framing', productId: 'prod-stud-2x4-10', quantity: 1, sortOrder: 0 },
    { keyMeasureId: 'km-framing', productId: 'prod-plate-2x4', quantity: 3, sortOrder: 1 },
    { keyMeasureId: 'km-framing', productId: 'prod-framing-nails', quantity: 0.05, sortOrder: 2 },
    // Drywall (km-drywall)
    { keyMeasureId: 'km-drywall', productId: 'prod-drywall-58', quantity: 0.031, sortOrder: 0 },
    { keyMeasureId: 'km-drywall', productId: 'prod-drywall-screws', quantity: 0.01, sortOrder: 1 },
    { keyMeasureId: 'km-drywall', productId: 'prod-joint-compound', quantity: 0.004, sortOrder: 2 },
    { keyMeasureId: 'km-drywall', productId: 'prod-drywall-tape', quantity: 0.002, sortOrder: 3 },
    // Roofing (km-roofing)
    { keyMeasureId: 'km-roofing', productId: 'prod-shingles', quantity: 0.01, sortOrder: 0 },
    { keyMeasureId: 'km-roofing', productId: 'prod-underlayment', quantity: 0.002, sortOrder: 1 },
    { keyMeasureId: 'km-roofing', productId: 'prod-roofing-nails', quantity: 0.02, sortOrder: 2 },
    // Window (km-window)
    { keyMeasureId: 'km-window', productId: 'prod-window-3660', quantity: 1, sortOrder: 0 },
    { keyMeasureId: 'km-window', productId: 'prod-flashing-tape', quantity: 0.25, sortOrder: 1 },
    // Exterior door (km-ext-door)
    { keyMeasureId: 'km-ext-door', productId: 'prod-door-ext-36', quantity: 1, sortOrder: 0 },
    { keyMeasureId: 'km-ext-door', productId: 'prod-door-hardware', quantity: 1, sortOrder: 1 },
    // Exterior sheathing (km-sheath1)
    { keyMeasureId: 'km-sheath1', productId: 'prod-osb-716', quantity: 0.031, sortOrder: 0 },
    { keyMeasureId: 'km-sheath1', productId: 'prod-house-wrap', quantity: 0.001, sortOrder: 1 },
    // Insulation (km-insul-batt)
    { keyMeasureId: 'km-insul-batt', productId: 'prod-batt-r19', quantity: 0.02, sortOrder: 0 },
  ];
  for (const kp of kmProducts) {
    const id = `kmp-${kp.keyMeasureId}-${kp.productId}`;
    await prisma.keyMeasureProduct.upsert({
      where: { keyMeasureId_productId: { keyMeasureId: kp.keyMeasureId, productId: kp.productId } },
      update: { quantity: kp.quantity, sortOrder: kp.sortOrder },
      create: { id, ...kp },
    });
  }

  // Material Groups — named collections of Products
  const materialGroups = [
    { id: 'mg-ext-wall', name: 'Exterior Wall Assembly', category: 'Framing', sortOrder: 0 },
    { id: 'mg-roof-bundle', name: 'Roofing Bundle', category: 'Roofing', sortOrder: 1 },
    { id: 'mg-drywall-kit', name: 'Interior Drywall Kit', category: 'Drywall', sortOrder: 2 },
  ];
  for (const mg of materialGroups) {
    await prisma.materialGroup.upsert({ where: { id: mg.id }, update: mg, create: mg });
  }

  const mgProducts = [
    // Exterior Wall Assembly
    { materialGroupId: 'mg-ext-wall', productId: 'prod-stud-2x6-10', quantity: 1, sortOrder: 0 },
    { materialGroupId: 'mg-ext-wall', productId: 'prod-plate-2x4', quantity: 3, sortOrder: 1 },
    { materialGroupId: 'mg-ext-wall', productId: 'prod-osb-716', quantity: 0.031, sortOrder: 2 },
    { materialGroupId: 'mg-ext-wall', productId: 'prod-house-wrap', quantity: 0.001, sortOrder: 3 },
    { materialGroupId: 'mg-ext-wall', productId: 'prod-batt-r19', quantity: 0.02, sortOrder: 4 },
    // Roofing Bundle
    { materialGroupId: 'mg-roof-bundle', productId: 'prod-shingles', quantity: 0.01, sortOrder: 0 },
    { materialGroupId: 'mg-roof-bundle', productId: 'prod-underlayment', quantity: 0.002, sortOrder: 1 },
    { materialGroupId: 'mg-roof-bundle', productId: 'prod-drip-edge', quantity: 1, sortOrder: 2 },
    { materialGroupId: 'mg-roof-bundle', productId: 'prod-roofing-nails', quantity: 0.02, sortOrder: 3 },
    // Interior Drywall Kit
    { materialGroupId: 'mg-drywall-kit', productId: 'prod-drywall-58', quantity: 0.031, sortOrder: 0 },
    { materialGroupId: 'mg-drywall-kit', productId: 'prod-joint-compound', quantity: 0.004, sortOrder: 1 },
    { materialGroupId: 'mg-drywall-kit', productId: 'prod-drywall-tape', quantity: 0.002, sortOrder: 2 },
    { materialGroupId: 'mg-drywall-kit', productId: 'prod-drywall-screws', quantity: 0.01, sortOrder: 3 },
    { materialGroupId: 'mg-drywall-kit', productId: 'prod-paint-int', quantity: 0.004, sortOrder: 4 },
  ];
  for (const mp of mgProducts) {
    const id = `mgp-${mp.materialGroupId}-${mp.productId}`;
    await prisma.materialGroupProduct.upsert({
      where: { materialGroupId_productId: { materialGroupId: mp.materialGroupId, productId: mp.productId } },
      update: { quantity: mp.quantity, sortOrder: mp.sortOrder },
      create: { id, ...mp },
    });
  }
  }

  // Quick Measurements — ~10 measurements with mixed types
  const measurements = [
    // AREA measurements (3)
    {
      id: 'meas-lobby',
      name: 'RM_1F',
      type: 'area',
      color: '#3B82F6',
      value: 482.50,
      unit: 'SQ FT',
      segmentCount: 8,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 0,
      markupData: { type: 'polygon', points: [[120,180],[320,180],[320,340],[120,340]] },
    },
    {
      id: 'meas-corridor',
      name: 'SQ_1F',
      type: 'area',
      color: '#14B8A6',
      value: 316.00,
      unit: 'SQ FT',
      segmentCount: 1,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 1,
      markupData: { type: 'polygon', points: [[320,220],[580,220],[580,280],[320,280]] },
    },
    {
      id: 'meas-office2',
      name: 'SOG_4000',
      type: 'area',
      color: '#F59E0B',
      value: 224.00,
      unit: 'SQ FT',
      segmentCount: 1,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 2,
      markupData: { type: 'polygon', points: [[380,290],[540,290],[540,420],[380,420]] },
    },
    {
      id: 'meas-conference',
      name: 'DR_EXT_36',
      type: 'area',
      color: '#EF4444',
      value: 360.00,
      unit: 'SQ FT',
      segmentCount: 1,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 3,
      markupData: { type: 'polygon', points: [[580,100],[740,100],[740,280],[580,280]] },
    },
    // LINEAR measurements (3)
    {
      id: 'meas-wall-north',
      name: '1F_WI_2x4_8',
      type: 'linear',
      color: '#F97316',
      value: 64.50,
      unit: 'LF',
      segmentCount: 12,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 4,
      markupData: { type: 'line', points: [[120,180],[740,180]] },
    },
    {
      id: 'meas-wall-south',
      name: '1F_WE_2x6_8',
      type: 'linear',
      color: '#EC4899',
      value: 52.00,
      unit: 'LF',
      segmentCount: 14,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 5,
      markupData: { type: 'line', points: [[120,440],[720,440]] },
    },
    {
      id: 'meas-baseboard',
      name: '1F_WI_2x6_8',
      type: 'linear',
      color: '#84CC16',
      value: 186.00,
      unit: 'LF',
      segmentCount: 1,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 6,
      markupData: { type: 'line', points: [[120,340],[320,340],[320,280],[580,280],[580,410],[720,410]] },
    },
    // COUNT measurements (3)
    {
      id: 'meas-switches',
      name: 'WD_SINGLE_J6',
      type: 'count',
      color: '#0EA5E9',
      value: 2,
      unit: 'EA',
      segmentCount: 2,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 7,
      markupData: { type: 'points', points: [[390,110],[590,110]] },
    },
    {
      id: 'meas-outlets',
      name: 'EL_DPX_20A',
      type: 'count',
      color: '#6366F1',
      value: 18,
      unit: 'EA',
      segmentCount: 18,
      visible: true,
      isAI: false,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 8,
      markupData: { type: 'points', points: [[150,220],[280,220],[400,150],[480,150],[400,350],[500,350],[620,150],[700,150],[620,350],[680,350],[150,400],[220,400],[650,200],[700,250],[450,260],[550,260],[200,300],[260,260]] },
    },
    {
      id: 'meas-di-single-right',
      name: 'DI_SINGLE_RIGHT_J4',
      type: 'count',
      color: '#DC2626',
      value: 2,
      unit: 'EA',
      segmentCount: 2,
      visible: true,
      isAI: true,
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: 9,
      markupData: { type: 'points', points: [[330,190],[590,300]] },
    },
    // Example of an AI detection flagged as low confidence for the user to review
    {
      id: 'meas-flagged-header',
      name: 'AI: Header B-12 (needs review)',
      type: 'linear',
      color: '#8B5CF6',
      value: 12.5,
      unit: 'LF',
      segmentCount: 1,
      visible: true,
      isAI: true,
      flagged: true,
      confidence: 58,
      flagReason: 'Ambiguous header callout — the size tag could not be read confidently. Defaulted to (2) 2×10; please verify against the plan.',
      groupId: null,
      sheetId: 'sheet-a101',
      sortOrder: -1,
      markupData: { type: 'line', points: [[180,220],[360,220]] },
    },
  ];

  for (const m of measurements) {
    await prisma.measurement.upsert({
      where: { id: m.id },
      update: { ...m },
      create: { ...m },
    });
  }

  // Assignments — assign a couple of QMs to Key Measures for demo
  const qmAssignments = [
    { id: 'assign-meas-office2', measurementId: 'meas-office2', keyMeasureId: 'km-concrete', sectionId: 'sec-common', useId: 'use-bid-estimate' },
    { id: 'assign-meas-conference', measurementId: 'meas-conference', keyMeasureId: 'km-ext-door', sectionId: 'sec-exterior', useId: 'use-budget' },
    { id: 'assign-meas-outlets', measurementId: 'meas-outlets', keyMeasureId: 'km-electrical', sectionId: 'sec-common', useId: 'use-bid-estimate' },
  ];

  for (const a of qmAssignments) {
    await prisma.assignment.upsert({
      where: { id: a.id },
      update: a,
      create: a,
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });