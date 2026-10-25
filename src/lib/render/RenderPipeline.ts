// RenderPipeline.ts
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { performanceOptimizer } from '../performanceOptimizer';

export class RenderPipeline {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  
  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090A0C);
    
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
    this.camera.position.set(220, 200, 280);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    this.setupLights();
    this.setupEnvironment();
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 500, 0);
    this.scene.add(hemiLight);
    
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(200, 300, 150);
    dirLight1.castShadow = true;
    this.scene.add(dirLight1);
  }

  private setupEnvironment() {
    const grid = new THREE.GridHelper(500, 50, 0x333333, 0x1a1a1a);
    grid.position.y = -0.1;
    this.scene.add(grid);
    this.scene.add(new THREE.AxesHelper(100));
  }

  private animationFrameId: number | null = null;

  animate(callback: (time: number) => void) {
    const animateLoop = (timestamp: number) => {
      this.animationFrameId = requestAnimationFrame(animateLoop);
      callback(timestamp);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      performanceOptimizer.measureFPS();
      performanceOptimizer.updateWebGLMetrics(this.renderer!.info);
    };
    this.animationFrameId = requestAnimationFrame(animateLoop);
  }

  dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    const domElement = this.renderer.domElement;
    if (domElement && domElement.parentNode) {
      domElement.parentNode.removeChild(domElement);
    }
  }
}
