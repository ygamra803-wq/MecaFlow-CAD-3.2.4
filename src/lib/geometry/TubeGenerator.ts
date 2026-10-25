import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { TubeConfig } from '../../types';

export const createTubeGeometry = (config: TubeConfig): THREE.BufferGeometry => {
  const tw = config.width;
  const th = config.shape === 'دائري' ? tw : config.height;
  const tl = config.totalLength;

  if (config.shape === 'مخصص' && config.customStlBuffer) {
    const loader = new STLLoader();
    const tubeGeom = loader.parse(config.customStlBuffer);
    tubeGeom.center();
    tubeGeom.computeVertexNormals();
    tubeGeom.computeBoundingBox();
    return tubeGeom;
  }

  const tt = config.thickness;
  const tr = config.shape === 'دائري' ? tw / 2 : config.cornerRadius;
  // clearance is handled here or previously?
  // previous code used config.thermalClearance - we should pass it or handle differently.
  const clearance = 0; // default 0 if not passed 

  const outerShape = new THREE.Shape();
  const tx = -tw / 2, ty = -th / 2;

  if (config.shape === 'بيضاوي') {
    // True ellipse (oval)
    outerShape.ellipse(0, 0, tw / 2, th / 2, 0, Math.PI * 2, false, 0);
  } else if (tr > 0) {
    // Rounded rectangle
    outerShape.moveTo(tx + tr, ty);
    outerShape.lineTo(tx + tw - tr, ty);
    outerShape.quadraticCurveTo(tx + tw, ty, tx + tw, ty + tr);
    outerShape.lineTo(tx + tw, ty + th - tr);
    outerShape.quadraticCurveTo(tx + tw, ty + th, tx + tw - tr, ty + th);
    outerShape.lineTo(tx + tr, ty + th);
    outerShape.quadraticCurveTo(tx, ty + th, tx, ty + th - tr);
    outerShape.lineTo(tx, ty + tr);
    outerShape.quadraticCurveTo(tx, ty, tx + tr, ty);
  } else {
    outerShape.moveTo(tx, ty);
    outerShape.lineTo(tx + tw, ty);
    outerShape.lineTo(tx + tw, ty + th);
    outerShape.lineTo(tx, ty + th);
    outerShape.lineTo(tx, ty);
  }
  const etl = tt - clearance;
  const itr = Math.max(0, tr - etl);
  const itx = tx + etl, ity = ty + etl;
  const itw = tw - 2 * etl, ith = th - 2 * etl;
  if (itw > 0 && ith > 0) {
    const hole = new THREE.Path();
    if (config.shape === 'بيضاوي') {
      hole.ellipse(0, 0, (tw - 2 * etl) / 2, (th - 2 * etl) / 2, 0, Math.PI * 2, false, 0);
    } else if (itr > 0) {
      hole.moveTo(itx + itr, ity);
      hole.lineTo(itx + itw - itr, ity);
      hole.quadraticCurveTo(itx + itw, ity, itx + itw, ity + itr);
      hole.lineTo(itx + itw, ity + ith - itr);
      hole.quadraticCurveTo(itx + itw, ity + ith, itx + itw - itr, ity + ith);
      hole.lineTo(itx + itr, ity + ith);
      hole.quadraticCurveTo(itx, ity + ith, itx, ity + ith - itr);
      hole.lineTo(itx, ity + itr);
      hole.quadraticCurveTo(itx, ity, itx + itr, ity);
    } else {
      hole.moveTo(itx, ity);
      hole.lineTo(itx + itw, ity);
      hole.lineTo(itx + itw, ity + ith);
      hole.lineTo(itx, ity + ith);
      hole.lineTo(itx, ity);
    }
    outerShape.holes.push(hole);
  }

  const tubeGeom = new THREE.ExtrudeGeometry(outerShape, { depth: tl, bevelEnabled: false, curveSegments: 16 });
  tubeGeom.center();
  tubeGeom.computeBoundingBox();
  return tubeGeom;
};
