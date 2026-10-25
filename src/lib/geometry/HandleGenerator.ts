import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { HandleConfig } from '../../types';

export const createHandleGeometry = (config: HandleConfig): THREE.BufferGeometry => {
  if (config.shape === 'مخصص' && config.customStlBuffer) {
    const loader = new STLLoader();
    const handleGeom = loader.parse(config.customStlBuffer);
    handleGeom.center();
    handleGeom.computeVertexNormals();
    handleGeom.computeBoundingBox();
    return handleGeom;
  }

  let handleGeom: THREE.BufferGeometry;
  const isSolid = !!config.solid;
  
  if (config.shape === 'cylindrical') {
    if (isSolid) {
      handleGeom = new THREE.CylinderGeometry(config.width / 2, config.width / 2, config.depth, 32, 1, false);
    } else {
      const outerR = config.width / 2;
      const innerR = Math.max(0.1, outerR - config.thickness);
      const outerCyl = new THREE.CylinderGeometry(outerR, outerR, config.depth, 32, 1, true);
      const innerCyl = new THREE.CylinderGeometry(innerR, innerR, config.depth, 32, 1, true);
      const topRing = new THREE.RingGeometry(innerR, outerR, 32);
      topRing.rotateX(-Math.PI / 2); topRing.translate(0, config.depth / 2, 0);
      const bottomRing = new THREE.RingGeometry(innerR, outerR, 32);
      bottomRing.rotateX(Math.PI / 2); bottomRing.translate(0, -config.depth / 2, 0);
      try { 
        handleGeom = BufferGeometryUtils.mergeGeometries([outerCyl, innerCyl, topRing, bottomRing], false); 
      } catch { 
        handleGeom = outerCyl; 
      }
    }
    handleGeom.rotateX(Math.PI / 2);
  } else {
    const hw = config.width, hh = config.height, hd = config.depth;
    const hr = Math.min(config.cornerRadius, hw / 2, hh / 2);
    const hShape = new THREE.Shape();
    const hx = -hw / 2, hy = -hh / 2;
    if (hr > 0) {
      hShape.moveTo(hx + hr, hy); hShape.lineTo(hx + hw - hr, hy);
      hShape.quadraticCurveTo(hx + hw, hy, hx + hw, hy + hr);
      hShape.lineTo(hx + hw, hy + hh - hr);
      hShape.quadraticCurveTo(hx + hw, hy + hh, hx + hw - hr, hy + hh);
      hShape.lineTo(hx + hr, hy + hh);
      hShape.quadraticCurveTo(hx, hy + hh, hx, hy + hh - hr);
      hShape.lineTo(hx, hy + hr);
      hShape.quadraticCurveTo(hx, hy, hx + hr, hy);
    } else {
      hShape.moveTo(hx, hy); hShape.lineTo(hx + hw, hy);
      hShape.lineTo(hx + hw, hy + hh); hShape.lineTo(hx, hy + hh); hShape.closePath();
    }
    if (!isSolid) {
      const it = config.thickness;
      if (it > 0 && it < hw / 2 && it < hh / 2) {
        const ir = Math.max(0, hr - it);
        const ix = hx + it, iy = hy + it, iw = hw - 2 * it, ih = hh - 2 * it;
        const hole = new THREE.Path();
        if (ir > 0) {
          hole.moveTo(ix + ir, iy); hole.lineTo(ix + iw - ir, iy);
          hole.quadraticCurveTo(ix + iw, iy, ix + iw, iy + ir);
          hole.lineTo(ix + iw, iy + ih - ir);
          hole.quadraticCurveTo(ix + iw, iy + ih, ix + iw - ir, iy + ih);
          hole.lineTo(ix + ir, iy + ih);
          hole.quadraticCurveTo(ix, iy + ih, ix, iy + ih - ir);
          hole.lineTo(ix, iy + ir);
          hole.quadraticCurveTo(ix, iy, ix + ir, iy);
        } else {
          hole.moveTo(ix, iy); hole.lineTo(ix + iw, iy);
          hole.lineTo(ix + iw, iy + ih); hole.lineTo(ix, iy + ih); hole.closePath();
        }
        hShape.holes.push(hole);
      }
    }
    handleGeom = new THREE.ExtrudeGeometry(hShape, { depth: hd, bevelEnabled: false, curveSegments: 16 });
  }
  handleGeom.center();
  return handleGeom;
};
