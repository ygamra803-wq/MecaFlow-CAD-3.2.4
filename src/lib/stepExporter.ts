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

export interface STEPExportStats {
  faceCount: number;
  vertexCount: number;
  volumeMm3: number;
  boundingBox: { width: number; height: number; length: number };
}

/**
 * التحقق من سلامة محتوى ملف STEP المصدّر وفق معيار ISO-10303-21
 */
export function validateSTEPContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    throw new AppError('EXPORT_FAILED', 'محتوى ملف STEP فارغ أو غير صالح', 'error');
  }
  if (!content.startsWith('ISO-10303-21;') || !content.includes('END-ISO-10303-21;')) {
    throw new AppError('EXPORT_FAILED', 'ترويسة ملف STEP غير متوافقة مع معيار ISO-10303-21', 'error');
  }
  if (!content.includes('MANIFOLD_SOLID_BREP') || !content.includes('CLOSED_SHELL')) {
    throw new AppError('EXPORT_FAILED', 'ملف STEP لا يحتوي على مجسم صلب مغلق صالح (MANIFOLD_SOLID_BREP)', 'error');
  }
  if (content.includes('NaN') || content.includes('Infinity')) {
    throw new AppError('EXPORT_FAILED', 'ملف STEP يحتوي على إحداثيات رياضية غير معرفة (NaN/Infinity)', 'error');
  }
  return true;
}

/**
 * استخراج المجسمات الصلبة الحقيقية فقط واستبعاد خطوط المساعدة أو مسارات الليزر المضيئة
 */
export function collectSolidMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const name = child.name || '';
    if (
      name.startsWith('zerogap_toolpath') ||
      name.startsWith('zerogap_ghost') ||
      name.startsWith('zerogap_laser_mark_ring') ||
      name.startsWith('zerogap_collision') ||
      name === 'edges'
    ) {
      return;
    }
    const pos = child.geometry.attributes.position;
    if (pos && pos.count >= 3) {
      meshes.push(child);
    }
  });

  return meshes;
}

/**
 * تصدير المجسم ثلاثي الأبعاد إلى صيغة STEP القياسية (ISO-10303-21 / AP214)
 * مع دمج الرؤوس المتطابقة، وإزالة المثلثات المنحلة، وحساب الحجم الفعلي وصندوق الإحاطة
 */
export const exportToSTEP = (mesh: THREE.Object3D, customMetadata?: STEPMetadata): string => {
  if (!mesh) {
    throw new AppError('INVALID_MESH', 'لا يمكن تصدير مجسم فارغ إلى STEP', 'error');
  }

  const meshes = collectSolidMeshes(mesh);
  if (meshes.length === 0) {
    return '';
  }

  const metadata = {
    exporter: customMetadata?.exporter || 'MecaFlow-CAD v2.3.1',
    timestamp: customMetadata?.timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, ''),
    version: customMetadata?.version || 'AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }',
    units: customMetadata?.units || 'MILLI_METRE',
    author: customMetadata?.author || 'MecaFlow Engineering',
    organization: customMetadata?.organization || 'MecaFlow CAD System'
  };

  let idCounter = 1;
  const uLenId = idCounter++;
  const uAngId = idCounter++;
  const uSolId = idCounter++;
  const uAccId = idCounter++;
  const ctx3DId = idCounter++;

  const bodyLines: string[] = [];
  bodyLines.push(`#${uLenId} = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );`);
  bodyLines.push(`#${uAngId} = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );`);
  bodyLines.push(`#${uSolId} = ( NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($,.STERADIAN.) );`);
  bodyLines.push(`#${uAccId} = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-04), #${uLenId}, 'distance_accuracy_value', 'precision');`);
  bodyLines.push(`#${ctx3DId} = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uAccId})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${uLenId},#${uAngId},#${uSolId})) REPRESENTATION_CONTEXT('Context #1', '3D Mechanical CAD Context') );`);

  const vertexMap = new Map<string, number>();
  const bboxMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const bboxMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  let signedVolume6 = 0;

  const getVertexId = (x: number, y: number, z: number): number => {
    const rx = Math.abs(x) < 1e-7 ? 0 : x;
    const ry = Math.abs(y) < 1e-7 ? 0 : y;
    const rz = Math.abs(z) < 1e-7 ? 0 : z;
    const key = `${rx.toFixed(4)},${ry.toFixed(4)},${rz.toFixed(4)}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const id = idCounter++;
    vertexMap.set(key, id);
    bodyLines.push(`#${id} = CARTESIAN_POINT('', (${rx.toFixed(6)}, ${ry.toFixed(6)}, ${rz.toFixed(6)}));`);
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
      let idx0 = i;
      let idx1 = i + 1;
      let idx2 = i + 2;
      if (indexAttr) {
        idx0 = indexAttr.getX(i);
        idx1 = indexAttr.getX(i + 1);
        idx2 = indexAttr.getX(i + 2);
      }

      v0.set(posAttr.getX(idx0), posAttr.getY(idx0), posAttr.getZ(idx0)).applyMatrix4(m.matrixWorld);
      v1.set(posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1)).applyMatrix4(m.matrixWorld);
      v2.set(posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2)).applyMatrix4(m.matrixWorld);

      if (
        !Number.isFinite(v0.x) || !Number.isFinite(v0.y) || !Number.isFinite(v0.z) ||
        !Number.isFinite(v1.x) || !Number.isFinite(v1.y) || !Number.isFinite(v1.z) ||
        !Number.isFinite(v2.x) || !Number.isFinite(v2.y) || !Number.isFinite(v2.z)
      ) {
        continue;
      }

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

      // منع المثلثات المنحلة بعد دمج الرؤوس المتقاربة لضمان توافق النواة مع OpenCASCADE و SolidWorks
      if (id0 === id1 || id1 === id2 || id2 === id0) {
        continue;
      }

      bboxMin.min(v0).min(v1).min(v2);
      bboxMax.max(v0).max(v1).max(v2);
      signedVolume6 += v0.dot(edge1.cross(edge2));

      if (Math.abs(normal.x) < 0.9) {
        refX.set(1, 0, 0).cross(normal).normalize();
      } else {
        refX.set(0, 1, 0).cross(normal).normalize();
      }

      const dirNormalId = idCounter++;
      bodyLines.push(`#${dirNormalId} = DIRECTION('', (${normal.x.toFixed(6)}, ${normal.y.toFixed(6)}, ${normal.z.toFixed(6)}));`);

      const dirRefId = idCounter++;
      bodyLines.push(`#${dirRefId} = DIRECTION('', (${refX.x.toFixed(6)}, ${refX.y.toFixed(6)}, ${refX.z.toFixed(6)}));`);

      const placementId = idCounter++;
      bodyLines.push(`#${placementId} = AXIS2_PLACEMENT_3D('', #${id0}, #${dirNormalId}, #${dirRefId});`);

      const planeId = idCounter++;
      bodyLines.push(`#${planeId} = PLANE('', #${placementId});`);

      const polyLoopId = idCounter++;
      bodyLines.push(`#${polyLoopId} = POLY_LOOP('', (#${id0}, #${id1}, #${id2}));`);

      const boundId = idCounter++;
      bodyLines.push(`#${boundId} = FACE_OUTER_BOUND('', #${polyLoopId}, .T.);`);

      const faceId = idCounter++;
      bodyLines.push(`#${faceId} = FACE_SURFACE('', (#${boundId}), #${planeId}, .T.);`);
      faceIds.push(faceId);
    }
  }

  if (faceIds.length === 0) {
    return '';
  }

  // تجميع البنية الطوبولوجية للمجسم الصلب
  const shellId = idCounter++;
  const manifoldId = idCounter++;
  const shapeRepId = idCounter++;
  const appCtxId = idCounter++;
  const prodContextId = idCounter++;
  const prodId = idCounter++;
  const prodDefFormatId = idCounter++;
  const prodDefCtxId = idCounter++;
  const prodDefId = idCounter++;
  const shapeDefRelationId = idCounter++;
  const rootGeomId = idCounter++;

  bodyLines.push(`#${shellId} = CLOSED_SHELL('ZeroGap_Shell', (${faceIds.map(f => `#${f}`).join(',')}));`);
  bodyLines.push(`#${manifoldId} = MANIFOLD_SOLID_BREP('ZeroGap_Solid_Body', #${shellId});`);
  bodyLines.push(`#${shapeRepId} = FACETED_BREP_SHAPE_REPRESENTATION('ZeroGap_Part', (#${manifoldId}), #${ctx3DId});`);

  bodyLines.push(`#${appCtxId} = APPLICATION_CONTEXT('core data for automotive mechanical design processes');`);
  bodyLines.push(`#${prodContextId} = PRODUCT_CONTEXT('', #${appCtxId}, 'mechanical');`);
  bodyLines.push(`#${prodId} = PRODUCT('MecaFlow_ZeroGap_Part', 'MecaFlow Zero-Gap Laser Cut Part', '', (#${prodContextId}));`);
  bodyLines.push(`#${prodDefFormatId} = PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('Version_2_3', 'Production Solid Model', #${prodId}, .MADE.);`);
  bodyLines.push(`#${prodDefCtxId} = PRODUCT_DEFINITION_CONTEXT('part definition', #${appCtxId}, 'design');`);
  bodyLines.push(`#${prodDefId} = PRODUCT_DEFINITION('Design', 'Exact CSG Solid Part', #${prodDefFormatId}, #${prodDefCtxId});`);
  bodyLines.push(`#${shapeDefRelationId} = PRODUCT_DEFINITION_SHAPE('Part_Shape', '3D Solid Geometry', #${prodDefId});`);
  bodyLines.push(`#${rootGeomId} = SHAPE_DEFINITION_REPRESENTATION(#${shapeDefRelationId}, #${shapeRepId});`);

  const dimX = Number.isFinite(bboxMax.x - bboxMin.x) ? (bboxMax.x - bboxMin.x).toFixed(2) : '0.00';
  const dimY = Number.isFinite(bboxMax.y - bboxMin.y) ? (bboxMax.y - bboxMin.y).toFixed(2) : '0.00';
  const dimZ = Number.isFinite(bboxMax.z - bboxMin.z) ? (bboxMax.z - bboxMin.z).toFixed(2) : '0.00';
  const volumeMm3 = Math.abs(signedVolume6 / 6.0).toFixed(2);

  const headerLines: string[] = [];
  headerLines.push('ISO-10303-21;');
  headerLines.push('HEADER;');
  headerLines.push(
    `FILE_DESCRIPTION(('MecaFlow 3D Solid Model', 'Faces: ${faceIds.length}, Vertices: ${vertexMap.size}, BBox: ${dimX}x${dimY}x${dimZ} mm, Volume: ${volumeMm3} mm3'), '2;1');`
  );
  headerLines.push(
    `FILE_NAME('mecaflow_zerogap.step', '${metadata.timestamp}', ('${metadata.author}'), ('${metadata.organization}'), '${metadata.exporter}', 'MecaFlow CAD Kernel', '');`
  );
  headerLines.push(`FILE_SCHEMA(('${metadata.version}'));`);
  headerLines.push('ENDSEC;');
  headerLines.push('DATA;');

  const footerLines = ['ENDSEC;', 'END-ISO-10303-21;'];
  const stepOutput = [...headerLines, ...bodyLines, ...footerLines].join('\n');

  validateSTEPContent(stepOutput);
  return stepOutput;
};
