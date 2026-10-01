import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {vectors,type Arrow} from '../core/puzzle';
const palette:Record<string,string>={POS_X:'#dd8762',NEG_X:'#dd8762',POS_Y:'#5b9588',NEG_Y:'#5b9588',POS_Z:'#758bab',NEG_Z:'#758bab'};
interface Visual {group:T.Group;material:T.MeshStandardMaterial;base:T.Vector3;direction:T.Vector3;animation?:{start:number;kind:'fly'|'shake';done?:()=>void}}
export class SceneManager {
  renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(36,1,.1,200);controls:OrbitControls;
  visuals=new Map<string,Visual>();private meshes:T.Object3D[]=[];private raycaster=new T.Raycaster();private pointer=new T.Vector2();private frame=0;private resizeObserver:ResizeObserver;
  private shaft=new T.CylinderGeometry(.105,.105,.53,12);private head=new T.ConeGeometry(.255,.36,4);private collar=new T.CylinderGeometry(.17,.17,.055,12);private arrowGeometry:T.BufferGeometry;
  private grid=new T.GridHelper(14,14,0xa6b6ad,0xd4ddd6);private floor:T.Mesh;private center=new T.Vector3();private extent=3;
  private pointers=new Map<number,{x:number;y:number;drag:boolean}>();private multi=false;private disposed=false;
  onPick:(id:string)=>void=()=>{};onFrame?:(fps:number,calls:number)=>void;onError:()=>void=()=>{};
  reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private last=performance.now();private frames=0;private sampled=performance.now();
  constructor(private host:HTMLElement){
    this.shaft.translate(0,-.13,0);this.head.rotateY(Math.PI/4);this.head.translate(0,.295,0);this.collar.translate(0,-.38,0);this.arrowGeometry=mergeGeometries([this.shaft,this.head,this.collar]);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setClearColor(0,0);
    this.renderer.domElement.setAttribute('aria-label','Drehbares 3D-Puzzle. Ziehen zum Drehen, tippen zum Entfernen. Alternativ die Pfeilliste benutzen.');this.renderer.domElement.tabIndex=0;
    host.append(this.renderer.domElement);this.scene.add(new T.HemisphereLight(0xffffff,0xa5b3a8,2.5));
    const sun=new T.DirectionalLight(0xfff6e8,3.1);sun.position.set(5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,far:50});sun.shadow.bias=-.001;sun.shadow.normalBias=.04;this.scene.add(sun);
    const fill=new T.DirectionalLight(0xdbe9ff,1.5);fill.position.set(-6,3,-5);this.scene.add(fill);
    this.floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.ShadowMaterial({opacity:.10}));this.floor.rotation.x=-Math.PI/2;this.floor.receiveShadow=true;this.scene.add(this.floor);this.grid.visible=false;this.scene.add(this.grid);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=!this.reduced;this.controls.dampingFactor=.09;this.controls.enablePan=false;this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.8;this.controls.minPolarAngle=.08;this.controls.maxPolarAngle=Math.PI-.08;
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('webglcontextlost',this.contextLost);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.tick();
  }
  private contextLost=(e:Event)=>{e.preventDefault();this.onError();};
  private down=(e:PointerEvent)=>{if(e.button!==0&&e.pointerType==='mouse')return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,drag:false});if(this.pointers.size>1)this.multi=true;};
  private move=(e:PointerEvent)=>{const p=this.pointers.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>7)p.drag=true;};
  private cancel=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);if(!this.pointers.size)this.multi=false;};
  private up=(e:PointerEvent)=>{const p=this.pointers.get(e.pointerId),multi=this.multi;this.cancel(e);if(!p||p.drag||multi||Math.hypot(e.clientX-p.x,e.clientY-p.y)>7)return;const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.meshes,false)[0];if(hit)this.onPick(hit.object.userData.id);};
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(w<1||h<1)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  setArrows(arrows:readonly Arrow[],reset=true){
    for(const v of this.visuals.values()){this.scene.remove(v.group);v.material.dispose();}this.visuals.clear();this.meshes=[];
    for(const a of arrows){const group=new T.Group(),material=new T.MeshStandardMaterial({color:palette[a.direction],roughness:.35,metalness:.06});
      const mesh=new T.Mesh(this.arrowGeometry,material);
      group.add(mesh);const direction=new T.Vector3(...vectors[a.direction]);group.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);group.position.set(a.x*1.18,a.y*1.18,a.z*1.18);
      group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;o.userData.id=a.id;this.meshes.push(o);}});this.scene.add(group);this.visuals.set(a.id,{group,material,base:group.position.clone(),direction});
    }
    if(arrows.length){const box=new T.Box3().setFromPoints([...this.visuals.values()].map(v=>v.base));box.getCenter(this.center);const size=box.getSize(new T.Vector3());this.extent=Math.max(2.5,size.length()+1.5);this.floor.position.y=box.min.y-.66;this.grid.position.set(this.center.x,box.min.y-.65,this.center.z);}
    if(reset)this.resetCamera();
  }
  resetCamera(){this.controls.target.copy(this.center);const aspect=Math.min(1,this.camera.aspect);const distance=this.extent*1.6/Math.max(.5,aspect);this.camera.position.copy(this.center).add(new T.Vector3(1,.8,1.25).normalize().multiplyScalar(distance));this.controls.minDistance=Math.max(2,this.extent*.65);this.controls.maxDistance=Math.min(90,distance*2.5);this.controls.update();}
  turn(dx:number,dy:number){const offset=this.camera.position.clone().sub(this.controls.target),s=new T.Spherical().setFromVector3(offset);s.theta+=dx;s.phi=T.MathUtils.clamp(s.phi+dy,.1,Math.PI-.1);this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.controls.update();}
  zoom(factor:number){const offset=this.camera.position.clone().sub(this.controls.target);offset.setLength(T.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance));this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
  highlight(ids:string[]){const set=new Set(ids);for(const [id,v] of this.visuals){v.material.emissive.set(set.has(id)?'#6e631b':'#000000');v.material.emissiveIntensity=set.has(id)?.55:0;}}
  fly(id:string,done:()=>void){const v=this.visuals.get(id);if(!v){done();return;}v.material.transparent=true;v.animation={start:performance.now(),kind:'fly',done};}
  shake(id:string){const v=this.visuals.get(id);if(v)v.animation={start:performance.now(),kind:'shake'};}
  setGrid(show:boolean){this.grid.visible=show;}
  project(id:string){const v=this.visuals.get(id);if(!v)return null;const p=v.base.clone().project(this.camera),r=this.renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}
  private tick=()=>{
    if(this.disposed)return;this.frame=requestAnimationFrame(this.tick);const now=performance.now();this.last=now;this.frames++;
    for(const [id,v] of this.visuals){const a=v.animation;if(!a)continue;const duration=this.reduced?80:a.kind==='fly'?520:330,t=Math.min(1,(now-a.start)/duration);
      if(a.kind==='fly'){v.group.position.copy(v.base).addScaledVector(v.direction,t*t*(this.extent+5));v.material.opacity=1-t*t;v.group.scale.setScalar(1-.22*t);}
      else {v.group.position.copy(v.base).addScaledVector(v.direction,Math.sin(t*Math.PI*4)*(1-t)*.14);v.material.emissive.set('#8b241b');v.material.emissiveIntensity=Math.sin(t*Math.PI)*.5;}
      if(t===1){v.animation=undefined;if(a.kind==='fly'){this.scene.remove(v.group);this.meshes=this.meshes.filter(m=>m.userData.id!==id);v.material.dispose();this.visuals.delete(id);a.done?.();}else{v.group.position.copy(v.base);v.material.emissive.set('#000000');}}
    }
    this.controls.update();this.renderer.render(this.scene,this.camera);if(now-this.sampled>500){this.onFrame?.(this.frames*1000/(now-this.sampled),this.renderer.info.render.calls);this.sampled=now;this.frames=0;}
  };
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();const c=this.renderer.domElement;c.removeEventListener('pointerdown',this.down);c.removeEventListener('pointermove',this.move);c.removeEventListener('pointerup',this.up);c.removeEventListener('pointercancel',this.cancel);c.removeEventListener('webglcontextlost',this.contextLost);for(const v of this.visuals.values())v.material.dispose();this.shaft.dispose();this.head.dispose();this.collar.dispose();this.arrowGeometry.dispose();this.floor.geometry.dispose();(this.floor.material as T.Material).dispose();this.grid.geometry.dispose();const gm=this.grid.material;(Array.isArray(gm)?gm:[gm]).forEach(m=>m.dispose());this.renderer.dispose();}
}
