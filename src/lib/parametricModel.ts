export type PrimitiveType = 
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'extrude'
  | 'revolve'
  | 'loft';

export type BooleanOp = 'union' | 'cut' | 'intersect';

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface Primitive {
  id: string;
  type: PrimitiveType;
  params: Record<string, number | number[] | string>;
  transform: Transform;
}

export interface Fillet {
  edgeSelector: string;
  radius: number;
}

export interface BooleanNode {
  id: string;
  op: BooleanOp;
  a: string;
  b: string;
}

export interface ParametricModel {
  version: string;
  units: 'mm' | 'cm' | 'm' | 'inch';
  primitives: Record<string, Primitive>;
  operations: BooleanNode[];
  fillets: Fillet[];
  rootId: string;
}

export function createParametricModel(): ParametricModel {
  return {
    version: '1.0',
    units: 'mm',
    primitives: {},
    operations: [],
    fillets: [],
    rootId: ''
  };
}

export function addPrimitive(
  model: ParametricModel,
  id: string,
  type: PrimitiveType,
  params: Record<string, number | number[] | string>,
  transform: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] }
): ParametricModel {
  return {
    ...model,
    primitives: {
      ...model.primitives,
      [id]: { id, type, params, transform }
    }
  };
}

export function addBooleanOperation(
  model: ParametricModel,
  id: string,
  op: BooleanOp,
  a: string,
  b: string
): ParametricModel {
  return {
    ...model,
    operations: [...model.operations, { id, op, a, b }]
  };
}

export function setRoot(model: ParametricModel, rootId: string): ParametricModel {
  return { ...model, rootId };
}

export function addFillet(
  model: ParametricModel,
  edgeSelector: string,
  radius: number
): ParametricModel {
  return {
    ...model,
    fillets: [...model.fillets, { edgeSelector, radius }]
  };
}