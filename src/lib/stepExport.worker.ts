/// <reference lib="webworker" />

import { Cylinder, Cuboid, Vector, Axis, Solid, exportStep } from '@achirita/blox';
import type { ZeroGapState } from '../types';

self.onmessage = async (event: MessageEvent) => {
  const { type, data, id } = event.data;

  if (type === 'EXPORT_STEP') {
    try {
      const config: ZeroGapState = data.config;
      const model = buildModelFromConfig(config);
      const stepArray = exportStep({ entities: [model] });

      const blob = new Blob([stepArray.buffer as ArrayBuffer], { type: 'application/step' });
      const stepString = await blob.text();

      self.postMessage({ id, type: 'STEP_READY', stepString });
    } catch (error: any) {
      self.postMessage({ id, type: 'ERROR', message: error.message || String(error) });
    }
  }
};

function buildModelFromConfig(config: ZeroGapState): Solid {
  const dPan = config.assembly.insertionDistance || 10;
  const dHandle = config.handle.insertionDepth ?? 15;
  const headLength = Math.max(dPan, 10);
  const tailLength = Math.max(dHandle, 10);
  const tl = (config.tube.partLength || 70) + headLength + tailLength;

  const w = config.tube.width;
  const hRect = config.tube.shape === 'دائري' ? w : (config.tube.height || w);
  const th = config.tube.thickness;
  const clearance = config.thermalClearance ? 0.1 : 0;

  // 1. بناء الأنبوب الأساسي المجوف على محور Z في النطاق [-tl/2, +tl/2]
  let tSolid: Solid;
  if (config.tube.shape === 'دائري') {
    const outerRadius = w / 2;
    const innerRadius = Math.max(0.5, (w - 2 * th) / 2);
    const outerCyl = Cylinder({ radius: outerRadius, height: tl, center: new Vector({ x: 0, y: 0, z: 0 }) });
    const innerCyl = Cylinder({ radius: innerRadius, height: tl + 20, center: new Vector({ x: 0, y: 0, z: 0 }) });
    tSolid = outerCyl.cut(innerCyl)[0];
  } else {
    const outerBox = Cuboid({ width: w, height: hRect, depth: tl, center: new Vector({ x: 0, y: 0, z: 0 }) });
    const innerBox = Cuboid({
      width: Math.max(1, w - 2 * th),
      height: Math.max(1, hRect - 2 * th),
      depth: tl + 20,
      center: new Vector({ x: 0, y: 0, z: 0 })
    });
    tSolid = outerBox.cut(innerBox)[0];
  }

  // 2. نقل الأنبوب بحيث يقع الطرف الأمامي A عند z = 0 والطرف الخلفي B عند z = tl
  tSolid = tSolid.translate(new Vector({ x: 0, y: 0, z: tl / 2 }));

  // 3. تحويلات التجميع للأنبوب في المرحلة النهائية (مطابقة لـ ThreeCanvas)
  const tubeZPos = -tl + dHandle / 2;
  const angleRad = (config.assembly.tiltAngle || 0) * (Math.PI / 180);
  const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);

  if (Math.abs(tubeRoll) > 1e-6) {
    tSolid = tSolid.rotate({ axis: Axis.OZ, angle: tubeRoll });
  }
  if (Math.abs(angleRad) > 1e-6) {
    tSolid = tSolid.rotate({ axis: Axis.OX, angle: angleRad });
  }
  tSolid = tSolid.translate(new Vector({ x: 0, y: 0, z: tubeZPos }));

  // 4. طرح مجسم المقلاة عند الطرف A (المقلاة تدور حول محور Y)
  const panZOffset = tubeZPos + dPan;
  const panY = -(config.assembly.heightOffset || 0);
  const rTop = (config.pan.topDiameter || 280) / 2 + (config.pan.addRim ? (config.pan.rimThickness || 2) : 0);
  const rAvg = ((config.pan.bottomDiameter || 120) / 2 + (config.pan.topDiameter || 280) / 2) / 2 + clearance;
  const panH = (config.pan.height || 50) + 2 * clearance;

  let panSolid = Cylinder({ radius: rAvg, height: panH, center: new Vector({ x: 0, y: 0, z: panH / 2 }) });
  panSolid = panSolid.rotate({ axis: Axis.OX, angle: -Math.PI / 2 });
  panSolid = panSolid.translate(new Vector({ x: 0, y: panY, z: -rTop + panZOffset }));

  const cutByPan = tSolid.cut(panSolid);
  if (cutByPan.length > 0) {
    tSolid = cutByPan[0];
  }

  // 5. طرح مجسم المقبض عند الطرف B
  if (config.handle.shape) {
    const hW = (config.handle.width || w) + 2 * clearance;
    const hH = (config.handle.shape === 'cylindrical' ? hW : (config.handle.height || hW)) + 2 * clearance;
    const hLen = (config.handle.depth || 80) + 2 * clearance;

    let handleSolid =
      config.handle.shape === 'cylindrical'
        ? Cylinder({ radius: hW / 2, height: hLen, center: new Vector({ x: 0, y: 0, z: 0 }) })
        : Cuboid({ width: hW, height: hH, depth: hLen, center: new Vector({ x: 0, y: 0, z: 0 }) });

    const hBoundZ = hLen / 2;
    handleSolid = handleSolid.translate(new Vector({ x: 0, y: 0, z: hBoundZ }));

    const hAngleX = (config.handle.angleX || 0) * (Math.PI / 180);
    const hAngleY = (config.handle.angleY || 0) * (Math.PI / 180);
    if (Math.abs(hAngleX) > 1e-6) {
      handleSolid = handleSolid.rotate({ axis: Axis.OX, angle: hAngleX });
    }
    if (Math.abs(hAngleY) > 1e-6) {
      handleSolid = handleSolid.rotate({ axis: Axis.OY, angle: hAngleY });
    }

    const hPivZLocal = tl / 2 - dHandle;
    const hPivXLocal = config.handle.offsetZ || 0;
    handleSolid = handleSolid.translate(new Vector({ x: hPivXLocal, y: 0, z: hPivZLocal + tl / 2 }));

    if (Math.abs(tubeRoll) > 1e-6) {
      handleSolid = handleSolid.rotate({ axis: Axis.OZ, angle: tubeRoll });
    }
    if (Math.abs(angleRad) > 1e-6) {
      handleSolid = handleSolid.rotate({ axis: Axis.OX, angle: angleRad });
    }
    handleSolid = handleSolid.translate(new Vector({ x: 0, y: 0, z: tubeZPos }));

    const cutByHandle = tSolid.cut(handleSolid);
    if (cutByHandle.length > 0) {
      tSolid = cutByHandle[0];
    }
  }

  if (config.addFillet) {
    try {
      tSolid = tSolid.fillet({ selector: () => true, radius: 0.2 });
    } catch (e) {
      console.warn('Fillet skipped in worker:', e);
    }
  }

  return tSolid;
}
