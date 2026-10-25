import * as THREE from 'three';

export const exportToSTEP = (mesh: THREE.Object3D): string => {
  // Extract all meshes from the object
  const meshes: THREE.Mesh[] = [];
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    return "";
  }

  const lines: string[] = [];

  // 1. STEP ISO File Header
  lines.push("ISO-10303-21;");
  lines.push("HEADER;");
  lines.push("FILE_DESCRIPTION(('MecaFlow 3D Faceted Solid Model', 'Industry Standard CAD Export'), '2;1');");
  lines.push(`FILE_NAME('mecaflow_model.step', '${new Date().toISOString()}', ('MecaFlow'), ('MecaFlow CAD Corp'), 'ThreeJS STEP Exporter v2.3', 'MecaFlow Studio', '');`);
  lines.push("FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));");
  lines.push("ENDSEC;");
  lines.push("DATA;");

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

  // Build a unique vertex map to avoid giant files and ensure solid topological connectivity
  const vertexMap = new Map<string, number>();
  const vertexIds: number[] = [];

  const getVertexId = (x: number, y: number, z: number): number => {
    // Round to 4 decimal places for deduplication stability
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

  // Iterate over all meshes, extract world/local transformed triangles
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const geom = m.geometry;
    const posAttr = geom.attributes.position;
    if (!posAttr) continue;

    // We can handle both indexed and non-indexed geometry
    const indexAttr = geom.index;
    const vertexCount = indexAttr ? indexAttr.count : posAttr.count;

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();

    for (let i = 0; i < vertexCount; i += 3) {
      let idx0 = i, idx1 = i + 1, idx2 = i + 2;
      if (indexAttr) {
        idx0 = indexAttr.getX(i);
        idx1 = indexAttr.getX(i + 1);
        idx2 = indexAttr.getX(i + 2);
      }

      v0.set(posAttr.getX(idx0), posAttr.getY(idx0), posAttr.getZ(idx0));
      v1.set(posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1));
      v2.set(posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2));

      // Apply mesh world transform to vertices to maintain correct position in space
      v0.applyMatrix4(m.matrixWorld);
      v1.applyMatrix4(m.matrixWorld);
      v2.applyMatrix4(m.matrixWorld);

      // Check degenerate triangle
      const edge1 = new THREE.Vector3().subVectors(v1, v0);
      const edge2 = new THREE.Vector3().subVectors(v2, v0);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2);
      const len = normal.length();
      if (len < 1e-6) {
        continue; // skip degenerate
      }
      normal.divideScalar(len);

      // Unique vertex indexing
      const id0 = getVertexId(v0.x, v0.y, v0.z);
      const id1 = getVertexId(v1.x, v1.y, v1.z);
      const id2 = getVertexId(v2.x, v2.y, v2.z);

      // Compute support plane coordinates
      // We need Ref direction (orthogonal to normal)
      const refX = new THREE.Vector3();
      if (Math.abs(normal.x) < 0.9) {
        refX.set(1, 0, 0).cross(normal).normalize();
      } else {
        refX.set(0, 1, 0).cross(normal).normalize();
      }

      // Write direction vectors
      const dirNormalId = idCounter++;
      lines.push(`#${dirNormalId} = DIRECTION('', (${normal.x.toFixed(6)}, ${normal.y.toFixed(6)}, ${normal.z.toFixed(6)}));`);

      const dirRefId = idCounter++;
      lines.push(`#${dirRefId} = DIRECTION('', (${refX.x.toFixed(6)}, ${refX.y.toFixed(6)}, ${refX.z.toFixed(6)}));`);

      // Supporting Plane structure
      const placementId = idCounter++;
      lines.push(`#${placementId} = AXIS2_PLACEMENT_3D('', #${id0}, #${dirNormalId}, #${dirRefId});`);

      const planeId = idCounter++;
      lines.push(`#${planeId} = PLANE('', #${placementId});`);

      // Loop & bounds definitions
      const polyLoopId = idCounter++;
      lines.push(`#${polyLoopId} = POLY_LOOP('', (#${id0}, #${id1}, #${id2}));`);

      const boundId = idCounter++;
      lines.push(`#${boundId} = FACE_OUTER_BOUND('', #${polyLoopId}, .T.);`);

      const faceId = idCounter++;
      // A standard FACE_SURFACE representing a flat triangle in space
      lines.push(`#${faceId} = FACE_SURFACE('', (#${boundId}), #${planeId}, .T.);`);
      faceIds.push(faceId);
    }
  }

  // 3. Topology Assembly
  const shellId = idCounter++;
  const manifoldId = idCounter++;
  const shapeRepId = idCounter++;
  const productRepId = idCounter++;
  const rootGeomId = idCounter++;

  // Closed shell referencing all ADVANCED_FACE/FACE_SURFACE components
  lines.push(`#${shellId} = CLOSED_SHELL('', (${faceIds.map(f => `#${f}`).join(',')}));`);
  lines.push(`#${manifoldId} = MANIFOLD_SOLID_BREP('Solid Body', #${shellId});`);
  lines.push(`#${shapeRepId} = FACETED_BREP_SHAPE_REPRESENTATION('', (#${manifoldId}), #${ctx3DId});`);

  // Product Definitions
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

  // Relationship back to Faceted representation
  lines.push(`#${rootGeomId} = SHAPE_DEFINITION_REPRESENTATION(#${shapeDefRelationId}, #${shapeRepId});`);

  // End of STEP
  lines.push("ENDSEC;");
  lines.push("END-ISO-10303-21;");

  return lines.join("\n");
};
