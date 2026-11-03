import * as THREE from 'three';
import { AppError } from './errorHandler';

export interface STEPMetadata {
  exporter?: string;
  timestamp?: string;
  version?: string;
  units?: string;
  author?: string;
  organization?: string;
}

/**
 * التحقق من سلامة محتوى ملف STEP المصدّر
 */
export function validateSTEPContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    throw new AppError('EXPORT_FAILED', 'محتوى ملف STEP فارغ أو غير صالح', 'error');
  }
  if (!content.startsWith('ISO-10303-21;') || !content.includes('END-ISO-10303-21;')) {
    throw new AppError('EXPORT_FAILED', 'ترويسة ملف STEP غير متوافقة مع معيار ISO-10303-21', 'error');
  }
  if (!content.includes('MANIFOLD_SOLID_BREP')) {
    throw new AppError('EXPORT_FAILED', 'ملف STEP لا يحتوي على مجسم صلب صالح (MANIFOLD_SOLID_BREP)', 'error');
  }
  return true;
}

/**
 * تصدير المجسم ثلاثي الأبعاد إلى صيغة STEP القياسية (ISO-10303-21 / AP214)
 */
export const exportToSTEP = (mesh: THREE.Object3D, customMetadata?: STEPMetadata): string => {
  if (!mesh) {
    throw new AppError('INVALID_MESH', 'لا يمكن تصدير مجسم فارغ إلى STEP', 'error');
  }

  const meshes: THREE.Mesh[] = [];
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    return '';
  }

  const metadata = {
    exporter: customMetadata?.exporter || 'MecaFlow-CAD v2.3.1',
    timestamp: customMetadata?.timestamp || new Date().toISOString(),
    version: customMetadata?.version || 'CONFIG_CONTROL_DESIGN',
    units: customMetadata?.units || 'MILLI_METRE',
    author: customMetadata?.author || 'MecaFlow',
    organization: customMetadata?.organization || 'MecaFlow CAD Corp'
  };

  const lines: string[] = [];

  // 1. STEP ISO File Header
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push("FILE_DESCRIPTION(('MecaFlow 3D Faceted Solid Model', 'Industry Standard CAD Export'), '2;1');");
  lines.push(`FILE_NAME('mecaflow_model.step', '${metadata.timestamp}', ('${metadata.author}'), ('${metadata.organization}'), '${metadata.exporter}', 'MecaFlow Studio', '');`);
  lines.push(`FILE_SCHEMA(('${metadata.version}'));`);
  lines.push('ENDSEC;');
  lines.push('DATA;');

  let idCounter = 1;

  // Global Context & Unit Definitions
  const uLenId = idCounter++;
  const uAngId = idCounter++;
  const uSolId = idCounter++;
  const uAccId = idCounter++;
  const ctx3DId = idCounter++;

  lines.push(`#${uLenId} = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );`);
  lines.push(`#${uAngId} = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );`);
  lines.push(`#${uSolId} = ( NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($,.STERADIAN.) );`);
  lines.push(`#${uAccId} = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-04), #${uLenId}, 'distance_accuracy_value', 'precision');`);
  lines.push(`#${ctx3DId} = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uAccId})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${uLenId},#${uAngId},#${uSolId})) REPRESENTATION_CONTEXT('Context #1', '3D Context with All Units') );`);

  const vertexMap = new Map<string, number>();

  const getVertexId = (x: number, y: number, z: number): number => {
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (vertexMap.has(key)) {
      return vertexMap.get(key)!;
    }
    const id = idCounter++;
    vertexMap.set(key, id);
    lines.push(`#${id} = CARTESIAN_POINT('', (${x.toFixed(6)}, ${y.toFixed(6)}, ${z.toFixed(6)}));`);
    return id;
  };

  const faceIds: number[] = [];

  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const geom = m.geometry;
    const posAttr = geom.attributes.position;
    if (!posAttr) continue;

    const indexAttr = geom.index;
    const vertexCount = indexAttr ? indexAttr.count : posAttr.count;

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const refX = new THREE.Vector3();

    for (let i = 0; i < vertexCount; i += 3) {
      let idx0 = i, idx1 = i + 1, idx2 = i + 2;
      if (indexAttr) {
        idx0 = indexAttr.getX(i);
        idx1 = indexAttr.getX(i + 1);
        idx2 = indexAttr.getX(i + 2);
      }

      v0.set(posAttr.getX(idx0), posAttr.getY(idx0), posAttr.getZ(idx0)).applyMatrix4(m.matrixWorld);
      v1.set(posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1)).applyMatrix4(m.matrixWorld);
      v2.set(posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2)).applyMatrix4(m.matrixWorld);

      edge1.subVectors(v1, v0);
      edge2.subVectors(v2, v0);
      normal.crossVectors(edge1, edge2);
      const len = normal.length();
      if (len < 1e-6) {
        continue;
      }
      normal.divideScalar(len);

      const id0 = getVertexId(v0.x, v0.y, v0.z);
      const id1 = getVertexId(v1.x, v1.y, v1.z);
      const id2 = getVertexId(v2.x, v2.y, v2.z);

      if (Math.abs(normal.x) < 0.9) {
        refX.set(1, 0, 0).cross(normal).normalize();
      } else {
        refX.set(0, 1, 0).cross(normal).normalize();
      }

      const dirNormalId = idCounter++;
      lines.push(`#${dirNormalId} = DIRECTION('', (${normal.x.toFixed(6)}, ${normal.y.toFixed(6)}, ${normal.z.toFixed(6)}));`);

      const dirRefId = idCounter++;
      lines.push(`#${dirRefId} = DIRECTION('', (${refX.x.toFixed(6)}, ${refX.y.toFixed(6)}, ${refX.z.toFixed(6)}));`);

      const placementId = idCounter++;
      lines.push(`#${placementId} = AXIS2_PLACEMENT_3D('', #${id0}, #${dirNormalId}, #${dirRefId});`);

      const planeId = idCounter++;
      lines.push(`#${planeId} = PLANE('', #${placementId});`);

      const polyLoopId = idCounter++;
      lines.push(`#${polyLoopId} = POLY_LOOP('', (#${id0}, #${id1}, #${id2}));`);

      const boundId = idCounter++;
      lines.push(`#${boundId} = FACE_OUTER_BOUND('', #${polyLoopId}, .T.);`);

      const faceId = idCounter++;
      lines.push(`#${faceId} = FACE_SURFACE('', (#${boundId}), #${planeId}, .T.);`);
      faceIds.push(faceId);
    }
  }

  if (faceIds.length === 0) {
    return '';
  }

  // 3. Topology Assembly
  const shellId = idCounter++;
  const manifoldId = idCounter++;
  const shapeRepId = idCounter++;
  const rootGeomId = idCounter++;

  lines.push(`#${shellId} = CLOSED_SHELL('', (${faceIds.map(f => `#${f}`).join(',')}));`);
  lines.push(`#${manifoldId} = MANIFOLD_SOLID_BREP('Solid Body', #${shellId});`);
  lines.push(`#${shapeRepId} = FACETED_BREP_SHAPE_REPRESENTATION('', (#${manifoldId}), #${ctx3DId});`);

  const prodId = idCounter++;
  const prodDefFormatId = idCounter++;
  const prodContextId = idCounter++;
  const prodDefId = idCounter++;
  const shapeDefRelationId = idCounter++;

  lines.push(`#${prodId} = PRODUCT('MecaFlow Part', 'MecaFlow Part', '', (#${prodContextId}));`);
  lines.push(`#${prodContextId} = PRODUCT_CONTEXT('', #${ctx3DId}, 'mechanical');`);
  lines.push(`#${prodDefFormatId} = PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('Standard', 'MecaFlow Production Part', #${prodId}, .MADE.);`);
  lines.push(`#${prodDefId} = PRODUCT_DEFINITION('Design', 'Standard CAD model', #${prodDefFormatId}, #${prodContextId});`);
  lines.push(`#${shapeDefRelationId} = PRODUCT_DEFINITION_SHAPE('', '', #${prodDefId});`);

  lines.push(`#${rootGeomId} = SHAPE_DEFINITION_REPRESENTATION(#${shapeDefRelationId}, #${shapeRepId});`);

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  const stepOutput = lines.join('\n');
  validateSTEPContent(stepOutput);
  return stepOutput;
};
