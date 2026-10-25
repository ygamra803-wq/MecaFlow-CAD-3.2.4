/// <reference lib="webworker" />

import { Cylinder, Cuboid, Vector, Axis, Plane, Solid, exportStep } from '@achirita/blox';
import type { ZeroGapState } from '../types';

self.onmessage = async (event: MessageEvent) => {
  const { type, data, id } = event.data;
  
  if (type === 'EXPORT_STEP') {
    try {
      const config: ZeroGapState = data.config;
      console.log("[Worker] Starting blox geometry construction for STEP export...");
      
      const model = buildModelFromConfig(config);
      
      console.log("[Worker] Geometry built, exporting to STEP...");
      const stepArray = exportStep({ entities: [model] });
      
      const blob = new Blob([stepArray.buffer as ArrayBuffer], { type: 'application/step' });
      const stepString = await blob.text();
      
      self.postMessage({ id, type: 'STEP_READY', stepString });
      
    } catch (error: any) {
      console.error("[Worker] Error building STEP:", error);
      self.postMessage({ id, type: 'ERROR', message: error.message || String(error) });
    }
  }
};

function buildModelFromConfig(config: ZeroGapState): Solid {
  const tl = config.tube.partLength || config.tube.totalLength;
  let tSolid: Solid;
  
  const w = config.tube.width;
  const hRect = config.tube.height || w;
  const th = config.tube.thickness;
  
  // 1. Build Base Tube
  if (config.tube.shape === 'دائري') {
    const outerRadius = w / 2;
    const innerRadius = (w - 2 * th) / 2;
    const outerCyl = Cylinder({ radius: outerRadius, height: tl, center: new Vector({ x: 0, y: 0, z: tl / 2 }) });
    const innerCyl = Cylinder({ radius: innerRadius, height: tl + 20, center: new Vector({ x: 0, y: 0, z: tl / 2 }) });
    tSolid = outerCyl.cut(innerCyl)[0];
  } else {
    const outerBox = Cuboid({ width: w, height: hRect, depth: tl, center: new Vector({ x: 0, y: 0, z: tl / 2 }) });
    const innerBox = Cuboid({ width: w - 2 * th, height: hRect - 2 * th, depth: tl + 20, center: new Vector({ x: 0, y: 0, z: tl / 2 }) });
    tSolid = outerBox.cut(innerBox)[0];
  }
  
  // 2. Tube Pivot Transformations
  const hInsertion = config.handle.insertionDepth || 10;
  const insertion = config.assembly.insertionDistance || 10;
  const tubeZPos = -tl + hInsertion / 2; // STEP 5 mode for final-inspect
  const angleRad = (config.assembly.tiltAngle || 0) * (Math.PI / 180);
  const tubeRoll = (config.assembly.handleAngleY || 0) * (Math.PI / 180);
  
  let rotatedTube = tSolid.rotate({ axis: Axis.OY, angle: tubeRoll });
  tSolid = rotatedTube;
  
  rotatedTube = tSolid.rotate({ axis: Axis.OX, angle: angleRad });
  tSolid = rotatedTube;
  
  let translatedTube = tSolid.translate(new Vector({ x: 0, y: 0, z: tubeZPos }));
  tSolid = translatedTube;

  // 3. Subtract Pan
  const panZOffset = tubeZPos + insertion;
  const panY = -(config.assembly.heightOffset || 0);
  
  const panBotR = (config.pan.bottomDiameter || w) / 2;
  const panH = config.pan.height || w;
  
  let panSolid: Solid;
  const pMesh = Cylinder({ radius: panBotR, height: panH, center: new Vector({ x: 0, y: 0, z: panH / 2 }) });
  
  const pBoundZ = panH; // Approximating max.z of pan
  panSolid = pMesh.translate(new Vector({ x: 0, y: panY, z: -pBoundZ + panZOffset }));
  
  const cutByPan = tSolid.cut(panSolid);
  if (cutByPan.length > 0) {
    tSolid = cutByPan[0];
  }
  
  // 4. Subtract Handle
  if (config.handle.shape) {
     const hW = config.handle.width || w;
     const hH = config.handle.shape === 'rectangular' ? (config.handle.thickness || hW) : hW;
     const hLen = config.handle.depth || 50;
     
     let handleSolid = config.handle.shape === 'cylindrical' 
         ? Cylinder({ radius: hW / 2, height: hLen, center: new Vector({ x: 0, y: 0, z: hLen / 2 }) })
         : Cuboid({ width: hW, height: hH, depth: hLen, center: new Vector({ x: 0, y: 0, z: hLen / 2 }) });
     
     const hBoundZ = hLen / 2;
     
     let tempObj = handleSolid.translate(new Vector({ x: 0, y: 0, z: hBoundZ }));
     handleSolid = tempObj;
     
     tempObj = handleSolid.rotate({ axis: Axis.OY, angle: (config.handle.angleY || 0) * (Math.PI / 180) });
     handleSolid = tempObj;
     
     tempObj = handleSolid.rotate({ axis: Axis.OX, angle: (config.handle.angleX || 0) * (Math.PI / 180) });
     handleSolid = tempObj;
     
     const hPivZLocal = tl / 2 - hInsertion;
     const hPivXLocal = config.handle.offsetZ || 0; 
     
     tempObj = handleSolid.translate(new Vector({ x: hPivXLocal, y: 0, z: hPivZLocal }));
     handleSolid = tempObj;
     
     tempObj = handleSolid.translate(new Vector({ x: 0, y: 0, z: tl / 2 }));
     handleSolid = tempObj;
     
     tempObj = handleSolid.rotate({ axis: Axis.OY, angle: tubeRoll });
     handleSolid = tempObj;
     
     tempObj = handleSolid.rotate({ axis: Axis.OX, angle: angleRad });
     handleSolid = tempObj;
     
     tempObj = handleSolid.translate(new Vector({ x: 0, y: 0, z: tubeZPos }));
     handleSolid = tempObj;
     
     const cutByHandle = tSolid.cut(handleSolid);
     if (cutByHandle.length > 0) {
        tSolid = cutByHandle[0];
     }
  }

  // 5. Fillets (Optional, if config.addFillet is true)
  if (config.addFillet) {
     try {
         const filleted = tSolid.fillet({ selector: () => true, radius: 0.2 });
         tSolid = filleted;
     } catch (e) {
         console.warn("Fillet failed in blox, skipping:", e);
     }
  }

  return tSolid;
}
