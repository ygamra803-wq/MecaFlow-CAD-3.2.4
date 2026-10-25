import re

with open('src/components/ThreeCanvas.tsx', 'r') as f:
    content = f.read()

pattern = r"// ── 5\. Render: Preview or Boolean ────────────────────────────────────(.*?)// ── TRUE ABSOLUTE CENTER at \(0, 0, 0\) ──────────────────────────"

replacement = """// ── 5. Render based on Wizard Step ────────────────────────────────────
        const step = config.wizardStep || 'final';

        if (step === 'dashboard') {
          exportMeshRef.current = new THREE.Mesh();
          tubeGeom.dispose(); panGeom.dispose(); panInnerGeom.dispose(); hcGeom.dispose();
        } else if (step === 'tube') {
          tubeMesh.position.set(0, 0, 0);
          tubeMesh.rotation.set(0, 0, 0);
          tubeMesh.updateMatrixWorld(true);
          try {
            const edges = new THREE.EdgesGeometry(tubeGeom);
            if (edges.attributes.position?.count > 0) tubeMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
          } catch {}
          scene.add(tubeMesh);
          exportMeshRef.current = tubeMesh;
          panGeom.dispose(); panInnerGeom.dispose(); hcGeom.dispose();
        } else if (step === 'pan') {
          panMesh.position.set(0, 0, 0);
          panMesh.rotation.set(0, 0, 0);
          panMesh.updateMatrixWorld(true);
          if (config.pan.useShellPreview) {
             const panOuterWf = new THREE.Mesh(panGeom, new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.35 }));
             const panInnerWf = new THREE.Mesh(panInnerGeom, new THREE.MeshBasicMaterial({ color: 0xFFA500, wireframe: true, transparent: true, opacity: 0.25 }));
             scene.add(panOuterWf); scene.add(panInnerWf);
          } else {
             const solidMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.5, roughness: 0.3 });
             const panSolid = new THREE.Mesh(panGeom, solidMat);
             scene.add(panSolid);
          }
          exportMeshRef.current = panMesh;
          tubeGeom.dispose(); hcGeom.dispose();
        } else if (step === 'handle') {
          hcMesh.position.set(0, 0, 0);
          hcMesh.rotation.set(0, 0, 0);
          hcMesh.updateMatrixWorld(true);
          (hcMesh as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.3, roughness: 0.5 });
          scene.add(hcMesh);
          exportMeshRef.current = hcMesh;
          tubeGeom.dispose(); panGeom.dispose(); panInnerGeom.dispose();
        } else if (step === 'intersect_pan') {
          tubeMesh.name = 'zerogap_tube_preview';
          const panOuterWf = new THREE.Mesh(panGeom, new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.35 }));
          panOuterWf.position.copy(panMesh.position); panOuterWf.rotation.copy(panMesh.rotation);
          scene.add(panOuterWf);
          if (config.pan.useShellPreview) {
            const panInnerWf = new THREE.Mesh(panInnerGeom, new THREE.MeshBasicMaterial({ color: 0xFFA500, wireframe: true, transparent: true, opacity: 0.25 }));
            panInnerWf.position.copy(panMesh.position); panInnerWf.rotation.copy(panMesh.rotation);
            scene.add(panInnerWf);
          }
          
          try {
            const tubeBSP = CSG.fromMesh(tubeMesh);
            const panBSP  = CSG.fromMesh(panMesh);
            const intersectBSP = tubeBSP.intersect(panBSP);
            if (intersectBSP) {
              if (config.showGlow) {
                const glowMesh = CSG.toMesh(intersectBSP, new THREE.Matrix4(), new THREE.MeshStandardMaterial({
                  color: 0x00ff00, emissive: 0x00aa00, emissiveIntensity: 1.5, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthTest: true, depthWrite: false
                }));
                scene.add(glowMesh);
              }
              if (config.showBorders) {
                try {
                  const skinPts = buildPanProfile(0.5);
                  const skinGeom = new THREE.LatheGeometry(skinPts, 64);
                  const skinMesh = new THREE.Mesh(skinGeom);
                  skinMesh.position.copy(panMesh.position); skinMesh.rotation.copy(panMesh.rotation); skinMesh.updateMatrixWorld(true);
                  const skinBSP = panBSP.subtract(CSG.fromMesh(skinMesh));
                  const outerRingBSP = tubeBSP.intersect(skinBSP);
                  if (outerRingBSP) {
                    const ringMesh = CSG.toMesh(outerRingBSP, new THREE.Matrix4(), new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
                    ringMesh.renderOrder = 1; scene.add(ringMesh);
                  }
                  skinGeom.dispose();
                } catch {}
                if (config.pan.useShellPreview) {
                  try {
                    const panInnerBSP = CSG.fromMesh(panInnerMesh);
                    const innerIntersectBSP = tubeBSP.intersect(panInnerBSP);
                    if (innerIntersectBSP) {
                      const innerMesh = CSG.toMesh(innerIntersectBSP, new THREE.Matrix4());
                      if (innerMesh.geometry.attributes.position?.count > 3) {
                        const innerEdges = new THREE.EdgesGeometry(innerMesh.geometry, 15);
                        const innerRing = new THREE.LineSegments(innerEdges, new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 3, transparent: true, opacity: 1.0, depthTest: true }));
                        innerRing.renderOrder = 1; (innerRing.material as THREE.LineBasicMaterial).polygonOffset = true; (innerRing.material as THREE.LineBasicMaterial).polygonOffsetFactor = -5;
                        scene.add(innerRing);
                      }
                      innerMesh.geometry.dispose();
                    }
                  } catch {}
                }
              }
            }
          } catch {}

          try {
            const edges = new THREE.EdgesGeometry(tubeGeom);
            if (edges.attributes.position?.count > 0) tubeMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
          } catch {}
          scene.add(tubeMesh);
          exportMeshRef.current = tubeMesh;
          hcGeom.dispose();
        } else if (step === 'intersect_handle') {
          setIsLoading(true);
          // Show Tube (cut from Pan side) + Handle cutter
          const tubeBSP = CSG.fromMesh(tubeMesh);
          const cutPanBSP = config.pan.applyThicknessToCut ? CSG.fromMesh(panInnerMesh) : CSG.fromMesh(panMesh);
          const halfCutBSP = tubeBSP.subtract(cutPanBSP);
          
          const halfCutMesh = CSG.toMesh(halfCutBSP, new THREE.Matrix4(), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.3 }));
          try {
             const edges = new THREE.EdgesGeometry(halfCutMesh.geometry);
             if (edges.attributes.position?.count > 0) halfCutMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 })));
          } catch {}
          scene.add(halfCutMesh);

          (hcMesh as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.4 });
          scene.add(hcMesh);

          exportMeshRef.current = halfCutMesh;
          tubeGeom.dispose(); panGeom.dispose(); panInnerGeom.dispose();
        } else {
          // final / boolean
          setIsLoading(true);
          const tubeBSP = CSG.fromMesh(tubeMesh);
          const cutPanBSP = config.pan.applyThicknessToCut ? CSG.fromMesh(panInnerMesh) : CSG.fromMesh(panMesh);
          const hcBSP = CSG.fromMesh(hcMesh);

          let resultBSP = tubeBSP.subtract(cutPanBSP).subtract(hcBSP);

          if (config.markOrientation) {
            const markGeom = new THREE.CylinderGeometry(1, 1, Math.max(tw, th) * 2, 8);
            markGeom.rotateX(Math.PI / 2);
            const markMesh = new THREE.Mesh(markGeom);
            markMesh.position.set(0, th / 2, tl - 15);
            markMesh.updateMatrixWorld(true);
            resultBSP = resultBSP.subtract(CSG.fromMesh(markMesh));
            markGeom.dispose();
          }

          if (config.nestingMode === 'twin') {
            const singleMesh = CSG.toMesh(resultBSP, new THREE.Matrix4());
            const twinMesh = singleMesh.clone();
            twinMesh.rotateY(Math.PI);
            twinMesh.position.z = tl * 2 + (config.slugGap || 5);
            twinMesh.updateMatrix(); twinMesh.updateMatrixWorld(true);
            resultBSP = resultBSP.union(CSG.fromMesh(twinMesh));
            singleMesh.geometry.dispose();
          }

          tubeGeom.dispose(); panGeom.dispose(); hcGeom.dispose();

          const resultMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide });
          const finalMesh = CSG.toMesh(resultBSP, new THREE.Matrix4(), resultMat);
          finalMesh.name = 'zerogap_result';

          if (!finalMesh.geometry.attributes.position || finalMesh.geometry.attributes.position.count === 0) {
            finalMesh.geometry = new THREE.BoxGeometry(1, 1, 1);
          }
          finalMesh.geometry.computeVertexNormals();

          // ── TRUE ABSOLUTE CENTER at (0, 0, 0) ──────────────────────────"""

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/components/ThreeCanvas.tsx', 'w') as f:
    f.write(new_content)
