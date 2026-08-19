export interface MarkupData {
  type: 'polygon' | 'line' | 'points';
  points: number[][];
}

export type AssignmentTargetType = 'keyMeasure' | 'materialGroup' | 'products';

export type ActivityAction =
  | 'create'
  | 'rename'
  | 'update'
  | 'visibility'
  | 'delete'
  | 'duplicate'
  | 'assign'
  | 'unassign'
  | 'auto_takeoff';

export interface ActivityData {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ProductData {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  category: string;
  sortOrder: number;
}

export interface MaterialGroupProductData {
  id: string;
  materialGroupId: string;
  productId: string;
  quantity: number;
  sortOrder: number;
  product: ProductData;
}

export interface MaterialGroupData {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
  products: MaterialGroupProductData[];
}

export interface KeyMeasureProductData {
  id: string;
  keyMeasureId: string;
  productId: string;
  quantity: number;
  sortOrder: number;
  product: ProductData;
}

export interface AssignmentProductData {
  id: string;
  assignmentId: string;
  productId: string;
  quantity: number;
  product: ProductData;
}

export interface AssignmentData {
  id: string;
  measurementId: string;
  targetType: AssignmentTargetType;
  keyMeasureId: string | null;
  materialGroupId: string | null;
  sectionId: string | null;
  useId: string | null;
  multiplier: number;
  fromQuickMeasure: boolean;
  measurement: MeasurementData;
  keyMeasure: KeyMeasureData | null;
  materialGroup: MaterialGroupData | null;
  section: SectionData | null;
  use: UseData | null;
  products: AssignmentProductData[];
  createdAt: string;
}

export interface AssignmentPayload {
  targetType: AssignmentTargetType;
  keyMeasureId: string | null;
  materialGroupId: string | null;
  productIds: string[];
  multiplier: number;
  useId: string | null;
  sectionId: string | null;
}

export interface MeasurementData {
  id: string;
  name: string;
  type: 'area' | 'linear' | 'count';
  color: string;
  value: number;
  unit: string;
  segmentCount: number;
  visible: boolean;
  isAI: boolean;
  flagged?: boolean;
  flagReason?: string | null;
  confidence?: number | null;
  edited?: boolean;
  groupId: string | null;
  sheetId: string | null;
  markupData: MarkupData;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  assignments?: AssignmentData[];
}

export interface SheetData {
  id: string;
  name: string;
  category: string;
  scale: string;
  pageIndex: number;
  sortOrder: number;
}

export interface KeyMeasureData {
  id: string;
  name: string;
  color: string;
  category: string;
  subcategory: string | null;
  type: 'area' | 'linear' | 'count';
  sortOrder: number;
}

export interface SectionData {
  id: string;
  name: string;
  sortOrder: number;
}

export interface UseData {
  id: string;
  name: string;
  sortOrder: number;
}
