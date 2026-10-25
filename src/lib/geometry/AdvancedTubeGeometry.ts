import * as THREE from 'three';

// Local Interfaces to avoid circular dependencies
export interface TubeGeometryConfig {
  width: number;
  height: number;
  length: number;
  thickness: number;
  cornerRadius?: number;
  shape: 'rectangular' | 'oval' | 'circular' | 'custom';
  isHollow?: boolean;
  density?: number;
}

export interface TubeFace {
  name: string;
  points: THREE.Vector3[];
  normal: THREE.Vector3;
  area: number;
  type: 'planar' | 'curved';
}

export interface TubeEdge {
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
  face: string;
}

export interface MomentOfInertia {
  Ix: number;
  Iy: number;
  Iz: number;
}

export interface TubeProperties {
  outerVolume?: number;
  innerVolume?: number;
  volume?: number;
  weight?: number;
  surfaceArea?: number;
  centerOfMass?: THREE.Vector3;
  momentOfInertia?: MomentOfInertia;
  density?: number;
}

/**
 * نظام الأنبوب المتقدم - مجسم ثلاثي الأبعاد متطور
 * يدعم:
 * - أنابيب مستطيلة، بيضاوية، دائرية
 * - جدران داخلية وخارجية
 * - قطع وفتحات مخصصة
 * - حسابات رياضية وفيزيائية متقدمة
 */
export class AdvancedTubeGeometry {
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshStandardMaterial;
  private mesh: THREE.Mesh;
  private wireframe: THREE.LineSegments;

  // الخصائص الهندسية
  private width: number;
  private height: number;
  private length: number;
  private thickness: number;
  private cornerRadius: number;
  private shape: 'rectangular' | 'oval' | 'circular' | 'custom';
  private isHollow: boolean;
  private density: number = 7.85; // كثافة الفولاذ (g/cm³)

  // البيانات المحسوبة
  private vertices: THREE.Vector3[] = [];
  private faces: TubeFace[] = [];
  private edges: TubeEdge[] = [];
  private properties: TubeProperties = {};

  constructor(config: TubeGeometryConfig) {
    this.width = config.width;
    this.height = config.height;
    this.length = config.length;
    this.thickness = config.thickness;
    this.cornerRadius = config.cornerRadius || 0;
    this.shape = config.shape || 'rectangular';
    this.isHollow = config.isHollow !== false;
    this.density = config.density || 7.85;

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.wireframe = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3 })
    );

    this.generateGeometry();
    this.calculateProperties();
  }

  /**
   * توليد الهندسة الكاملة للأنبوب
   */
  private generateGeometry(): void {
    // 1. Build a flawless, robust 3D BufferGeometry using ExtrudeGeometry
    const outerShape = this.createCrossSectionShape(this.width, this.height, this.cornerRadius, false, 0);
    if (this.isHollow) {
      const innerShape = this.createCrossSectionShape(this.width, this.height, this.cornerRadius, true, this.thickness);
      outerShape.holes.push(innerShape);
    }

    // Extrude the shape
    const extrudedGeom = this.generateGeometryFromShape(outerShape, this.length);
    
    // Copy to this.geometry
    this.geometry.copy(extrudedGeom);
    extrudedGeom.dispose();

    // 2. Clear and generate pristine analytical faces, vertices, and edges (perfectly 3D and no duplicates!)
    this.generateAnalyticalFacesAndEdges();

    // Wireframe updates
    this.wireframe.geometry.dispose();
    this.wireframe.geometry = new THREE.WireframeGeometry(this.geometry);
  }

  private createCrossSectionShape(width: number, height: number, radius: number, isInner: boolean, thickness: number): THREE.Shape {
    const shape = new THREE.Shape();
    
    // Width along horizontal (let's map to X in 2D space), height along vertical (mapped to Y in 2D space)
    const w = isInner ? (width - 2 * thickness) : width;
    const h = isInner ? (height - 2 * thickness) : height;
    const r = isInner ? Math.max(0, radius - thickness) : radius;
    
    const hW = w / 2;
    const hH = h / 2;
    
    if (this.shape === 'circular') {
      shape.absarc(0, 0, hW, 0, Math.PI * 2, false);
    } else if (this.shape === 'oval') {
      shape.absellipse(0, 0, hW, hH, 0, Math.PI * 2, false, 0);
    } else {
      if (r > 0) {
        // Rounded rectangle
        shape.moveTo(-hW + r, -hH);
        shape.lineTo(hW - r, -hH);
        shape.quadraticCurveTo(hW, -hH, hW, -hH + r);
        shape.lineTo(hW, hH - r);
        shape.quadraticCurveTo(hW, hH, hW - r, hH);
        shape.lineTo(-hW + r, hH);
        shape.quadraticCurveTo(-hW, hH, -hW, hH - r);
        shape.lineTo(-hW, -hH + r);
        shape.quadraticCurveTo(-hW, -hH, -hW + r, -hH);
      } else {
        // Plain rectangle
        shape.moveTo(-hW, -hH);
        shape.lineTo(hW, -hH);
        shape.lineTo(hW, hH);
        shape.lineTo(-hW, hH);
        shape.lineTo(-hW, -hH);
      }
    }
    return shape;
  }

  private generateGeometryFromShape(outerShape: THREE.Shape, length: number): THREE.BufferGeometry {
    const geom = new THREE.ExtrudeGeometry(outerShape, {
      depth: length,
      bevelEnabled: false,
      curveSegments: 24
    });
    // Center it
    geom.center();
    // Rotate 90 deg around Y-axis to align along X-axis
    geom.rotateY(Math.PI / 2);
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    return geom;
  }

  private generateAnalyticalFacesAndEdges(): void {
    this.vertices = [];
    this.faces = [];
    this.edges = [];

    const w = this.width / 2;
    const h = this.height / 2;
    const l = this.length / 2;
    const r = this.cornerRadius;
    const t = this.thickness;

    // Helper to generate a 2D cross section path at a given X position
    const getCrossSectionPoints = (xVal: number, widthVal: number, heightVal: number, radiusVal: number): THREE.Vector3[] => {
      const points: THREE.Vector3[] = [];
      const segments = 40;

      if (this.shape === 'circular') {
        const radiusCircle = widthVal;
        for (let i = 0; i < segments; i++) {
          const angle = (2 * Math.PI * i) / segments;
          const y = radiusCircle * Math.sin(angle);
          const z = radiusCircle * Math.cos(angle);
          points.push(new THREE.Vector3(xVal, y, z));
        }
      } else if (this.shape === 'oval') {
        const radiusX = widthVal;
        const radiusY = heightVal;
        for (let i = 0; i < segments; i++) {
          const angle = (2 * Math.PI * i) / segments;
          const y = radiusY * Math.sin(angle);
          const z = radiusX * Math.cos(angle);
          points.push(new THREE.Vector3(xVal, y, z));
        }
      } else {
        // Rectangular cross-section with corner roundness
        const segmentsCorner = 8;
        // Top-right (+z, +y)
        for (let i = 0; i <= segmentsCorner; i++) {
          const angle = (Math.PI / 2) * (i / segmentsCorner);
          const z = widthVal - radiusVal + radiusVal * Math.cos(angle);
          const y = heightVal - radiusVal + radiusVal * Math.sin(angle);
          points.push(new THREE.Vector3(xVal, y, z));
        }
        // Top-left (-z, +y)
        for (let i = 0; i <= segmentsCorner; i++) {
          const angle = (Math.PI / 2) * (i / segmentsCorner) + Math.PI / 2;
          const z = -widthVal + radiusVal + radiusVal * Math.cos(angle);
          const y = heightVal - radiusVal + radiusVal * Math.sin(angle);
          points.push(new THREE.Vector3(xVal, y, z));
        }
        // Bottom-left (-z, -y)
        for (let i = 0; i <= segmentsCorner; i++) {
          const angle = (Math.PI / 2) * (i / segmentsCorner) + Math.PI;
          const z = -widthVal + radiusVal + radiusVal * Math.cos(angle);
          const y = -heightVal + radiusVal + radiusVal * Math.sin(angle);
          points.push(new THREE.Vector3(xVal, y, z));
        }
        // Bottom-right (+z, -y)
        for (let i = 0; i <= segmentsCorner; i++) {
          const angle = (Math.PI / 2) * (i / segmentsCorner) + (3 * Math.PI) / 2;
          const z = widthVal - radiusVal + radiusVal * Math.cos(angle);
          const y = -heightVal + radiusVal + radiusVal * Math.sin(angle);
          points.push(new THREE.Vector3(xVal, y, z));
        }
      }
      return points;
    };

    // 1. FRONT FACE (at x = -l)
    const frontPointsOuter = getCrossSectionPoints(-l, w, h, r);
    this.vertices.push(...frontPointsOuter);
    
    const frontFaceName = this.shape === 'circular' ? 'front_circle' : this.shape === 'oval' ? 'front_oval' : 'front';
    this.faces.push({
      name: frontFaceName,
      points: frontPointsOuter,
      normal: new THREE.Vector3(-1, 0, 0),
      area: this.calculatePolygonArea(frontPointsOuter),
      type: (this.shape === 'circular' || this.shape === 'oval') ? 'curved' : 'planar'
    });

    // 2. BACK FACE (at x = l)
    const backPointsOuter = getCrossSectionPoints(l, w, h, r);
    this.vertices.push(...backPointsOuter);

    const backFaceName = this.shape === 'circular' ? 'back_circle' : this.shape === 'oval' ? 'back_oval' : 'back';
    this.faces.push({
      name: backFaceName,
      points: backPointsOuter,
      normal: new THREE.Vector3(1, 0, 0),
      area: this.calculatePolygonArea(backPointsOuter),
      type: (this.shape === 'circular' || this.shape === 'oval') ? 'curved' : 'planar'
    });

    // 3. SIDE FACES & WALLS
    if (this.shape === 'circular' || this.shape === 'oval') {
      const sideFaceName = this.shape === 'circular' ? 'side_circle' : 'side_oval';
      const perimeter = this.shape === 'circular' ? (2 * Math.PI * w) : this.calculateEllipsePerimeter(w, h);
      this.faces.push({
        name: sideFaceName,
        points: frontPointsOuter,
        normal: new THREE.Vector3(0, 0, 1),
        area: perimeter * this.length,
        type: 'curved'
      });
    } else {
      // Rectangular: Top, Bottom, Left, Right side faces
      const topPoints = [
        new THREE.Vector3(-l, h, w),
        new THREE.Vector3(l, h, w),
        new THREE.Vector3(l, h, -w),
        new THREE.Vector3(-l, h, -w)
      ];
      this.faces.push({
        name: 'top',
        points: topPoints,
        normal: new THREE.Vector3(0, 1, 0),
        area: 4 * w * l,
        type: 'planar'
      });

      const bottomPoints = [
        new THREE.Vector3(-l, -h, -w),
        new THREE.Vector3(l, -h, -w),
        new THREE.Vector3(l, -h, w),
        new THREE.Vector3(-l, -h, w)
      ];
      this.faces.push({
        name: 'bottom',
        points: bottomPoints,
        normal: new THREE.Vector3(0, -1, 0),
        area: 4 * w * l,
        type: 'planar'
      });

      const leftPoints = [
        new THREE.Vector3(-l, -h, -w),
        new THREE.Vector3(-l, h, -w),
        new THREE.Vector3(l, h, -w),
        new THREE.Vector3(l, -h, -w)
      ];
      this.faces.push({
        name: 'left',
        points: leftPoints,
        normal: new THREE.Vector3(0, 0, -1),
        area: 4 * h * l,
        type: 'planar'
      });

      const rightPoints = [
        new THREE.Vector3(-l, -h, w),
        new THREE.Vector3(l, -h, w),
        new THREE.Vector3(l, h, w),
        new THREE.Vector3(-l, h, w)
      ];
      this.faces.push({
        name: 'right',
        points: rightPoints,
        normal: new THREE.Vector3(0, 0, 1),
        area: 4 * h * l,
        type: 'planar'
      });
    }

    // 4. INNER WALLS (if hollow)
    if (this.isHollow && w > t && h > t) {
      const innerW = w - t;
      const innerH = h - t;
      const innerR = Math.max(0, r - t);

      const frontPointsInner = getCrossSectionPoints(-l, innerW, innerH, innerR);
      this.faces.push({
        name: 'inner_front',
        points: frontPointsInner,
        normal: new THREE.Vector3(1, 0, 0),
        area: this.calculatePolygonArea(frontPointsInner),
        type: (this.shape === 'circular' || this.shape === 'oval') ? 'curved' : 'planar'
      });

      const backPointsInner = getCrossSectionPoints(l, innerW, innerH, innerR);
      this.faces.push({
        name: 'inner_back',
        points: backPointsInner,
        normal: new THREE.Vector3(-1, 0, 0),
        area: this.calculatePolygonArea(backPointsInner),
        type: (this.shape === 'circular' || this.shape === 'oval') ? 'curved' : 'planar'
      });
    }

    // Calculate unique edges from all planar/curved faces (preventing duplicates!)
    this.calculateFacesAndEdges();
  }

  /**
   * حساب الأوجه والحواف مع تجنب التكرار بذكاء
   */
  private calculateFacesAndEdges(): void {
    const seenEdges = new Set<string>();
    this.edges = [];
    for (const face of this.faces) {
      for (let i = 0; i < face.points.length; i++) {
        const nextIdx = (i + 1) % face.points.length;
        const p1 = face.points[i];
        const p2 = face.points[nextIdx];
        
        // build segment identifier (direction agnostic)
        const coords = [
          p1.x.toFixed(3), p1.y.toFixed(3), p1.z.toFixed(3),
          p2.x.toFixed(3), p2.y.toFixed(3), p2.z.toFixed(3)
        ].sort();
        const key = coords.join(',');
        
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          const edge: TubeEdge = {
            start: p1.clone(),
            end: p2.clone(),
            length: p1.distanceTo(p2),
            face: face.name
          };
          this.edges.push(edge);
        }
      }
    }
  }

  /**
   * حساب خصائص الأنبوب
   */
  private calculateProperties(): void {
    // الحجم الخارجي
    const outerVolume = this.width * this.height * this.length;

    // الحجم الداخلي (إذا كان مجوفاً)
    let innerVolume = 0;
    if (this.isHollow) {
      const innerWidth = this.width - 2 * this.thickness;
      const innerHeight = this.height - 2 * this.thickness;
      innerVolume = Math.max(0, innerWidth * innerHeight * this.length);
    }

    // الحجم الفعلي
    const volume = outerVolume - innerVolume;

    // الوزن
    const weight = (volume / 1000) * this.density; // بالكيلوجرام

    // المساحة السطحية
    let surfaceArea = 0;
    for (const face of this.faces) {
      surfaceArea += face.area;
    }

    // مركز الكتلة
    const centerOfMass = this.calculateCenterOfMass();

    // لحظة القصور الذاتي
    const momentOfInertia = this.calculateMomentOfInertia();

    this.properties = {
      outerVolume,
      innerVolume,
      volume,
      weight,
      surfaceArea,
      centerOfMass,
      momentOfInertia,
      density: this.density
    };
  }

  /**
   * حساب مركز الكتلة
   */
  private calculateCenterOfMass(): THREE.Vector3 {
    const center = new THREE.Vector3();
    center.x = 0;
    center.y = 0;
    center.z = 0;
    return center;
  }

  /**
   * حساب لحظة القصور الذاتي
   */
  private calculateMomentOfInertia(): MomentOfInertia {
    const m = this.properties.weight || 1;
    const w = this.width;
    const h = this.height;
    const l = this.length;

    return {
      Ix: (m / 12) * (h * h + l * l),
      Iy: (m / 12) * (w * w + l * l),
      Iz: (m / 12) * (w * w + h * h)
    };
  }

  /**
   * حساب مساحة المضلع
   */
  private calculatePolygonArea(points: THREE.Vector3[]): number {
    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      area += p1.x * p2.y - p2.x * p1.y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * حساب محيط الإهليلج
   */
  private calculateEllipsePerimeter(a: number, b: number): number {
    const h = ((a - b) * (a - b)) / ((a + b) * (a + b));
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }

  /**
   * الحصول على الأوجه
   */
  getFaces(): TubeFace[] {
    return this.faces;
  }

  /**
   * الحصول على الحواف
   */
  getEdges(): TubeEdge[] {
    return this.edges;
  }

  /**
   * الحصول على الخصائص
   */
  getProperties(): TubeProperties {
    return this.properties;
  }

  /**
   * الحصول على الـ Mesh
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * الحصول على Wireframe
   */
  getWireframe(): THREE.LineSegments {
    return this.wireframe;
  }

  /**
   * تحديث لون الوجه المحدد
   */
  highlightFace(faceName: string): void {
    this.material.emissive.setHex(0x224422);
  }

  /**
   * إزالة التحديد
   */
  unhighlightFace(): void {
    this.material.emissive.setHex(0x000000);
  }

  /**
   * تنظيف الموارد
   */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.wireframe.geometry.dispose();
    (this.wireframe.material as THREE.LineBasicMaterial).dispose();
  }
}
