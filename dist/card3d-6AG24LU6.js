import{a as E,c as ut,d as vt,f as W,g as ht,h as ft,j as _,k as Y,l as mt,m as yt,n as xt,q as Mt}from"./chunk-QQDZCFPC.js";var B=1.5,wt=.012,Et=.95,Ct=3.3,St=.9,kt=`
uniform float uBulge;
uniform float uFold;   // 0 flat \u2026 1 folded in half
uniform float uSide;   // +1 on the front face of the card, -1 on the back face
varying vec2 vUv;
varying vec3 vNormal;
varying vec2 vLocal;   // position on the card as seen from the front, for the cut line
void main() {
  vUv = uv;
  vec3 p = position;
  vec3 n = normal;
  // Paper bulge: a sachet swells in the middle, a napkin barely does.
  vec2 c = uv * 2.0 - 1.0;
  p.z += uBulge * (1.0 - c.x * c.x) * (1.0 - c.y * c.y);
  vLocal = vec2(position.x * uSide, position.y);
  // Fold: the top half swings forward about the middle line and lands on the bottom half.
  if (p.y > 0.0) {
    float a = uFold * 3.14159265 * uSide;
    float cs = cos(a), sn = sin(a);
    float y = p.y, z = p.z;
    p.y = y * cs - z * sn;
    p.z = y * sn + z * cs + 0.05 * uFold * uSide; // the lift keeps the folded half in front of the half it lands on
    n = vec3(n.x, n.y * cs - n.z * sn, n.y * sn + n.z * cs);
  }
  vNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,Ft=`
precision highp float;
uniform sampler2D uMap;
uniform vec2 uPointer;   // cursor in card coordinates (-1\u20261)
uniform float uHolo;     // 0 at rest, 1 while hovered
uniform vec2 uCut;       // cut line: y = uCut.x * x + uCut.y
uniform float uKeep;     // +1 keeps what is above the line, -1 what is below
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vNormal;
varying vec2 vLocal;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.02) discard;
  if ((vLocal.y - (uCut.x * vLocal.x + uCut.y)) * uKeep < 0.0) discard;
  vec2 c = vUv * 2.0 - 1.0;
  vec3 col = tex.rgb;
  float d = distance(c, uPointer);
  col += vec3(1.0) * exp(-d * d * 3.2) * 0.2 * uHolo;
  // Light from above-left, so a face darkens a little as it turns away (and inside a fold).
  float shade = 0.9 + 0.1 * clamp(dot(normalize(vNormal), normalize(vec3(-0.3, 0.5, 0.8))), 0.0, 1.0);
  col *= shade;
  gl_FragColor = linearToOutputTexel(vec4(col, tex.a * uAlpha));
}`,At=new xt,C=(r,D,f)=>Math.min(f,Math.max(D,r)),Rt=r=>r<.5?4*r*r*r:1-(-2*r+2)**3/2;function Xt(r){let D=matchMedia("(prefers-reduced-motion: reduce)").matches,f=new mt({antialias:!0,alpha:!0});f.setPixelRatio(Math.min(devicePixelRatio,2)),f.setClearColor(0,0);let F=f.domElement;r.prepend(F);let m=document.createElement("i");m.className="arch-slice",r.append(m);let G=new yt,w=new ft(30,1,.1,20),g=new Y,P=new Y;g.add(P),G.add(g);let u=[1,-1].map(t=>({keep:t,group:new Y,meshes:[],p:{x:0,y:0,r:0,vx:0,vy:0,vr:0}}));u.forEach(t=>P.add(t.group));let T=[],$=0,y={w:1,h:1,fold:!1},o={yaw:0,pitch:0,vy:0,vp:0,rest:0},v={t:0,to:0},x={x:0,v:0},l={a:0,v:0},b={n:0,t:0},p=-1,S=new E(0,0),i=null,A=!1,U=0,q=0,R=1,Z=()=>{let t=r.clientWidth,e=r.clientHeight;if(!t||!e)return;f.setSize(t,e,!1),w.aspect=t/e;let n=.95/Math.tan(w.fov*Math.PI/360)/Math.min(1,w.aspect*1.05);w.position.set(0,0,n),w.updateProjectionMatrix()},J=new ResizeObserver(Z);J.observe(r),Z();let Q=(t,e,n)=>new ht({uniforms:{uMap:{value:null},uBulge:{value:t},uFold:{value:0},uSide:{value:e},uPointer:{value:new E},uHolo:{value:0},uCut:{value:new E},uKeep:{value:n},uAlpha:{value:1}},vertexShader:kt,fragmentShader:Ft,transparent:!0}),tt=t=>u.forEach(e=>e.meshes.forEach(n=>t(n.material.uniforms,n)));function et(){for(let t of u){for(let e of t.meshes)t.group.remove(e),e.material.uniforms.uMap.value?.dispose(),e.material.dispose();t.meshes=[]}for(let t of T)t.dispose();T=[]}function gt(t){let e=++$;et(),o.yaw=o.rest=o.pitch=o.vy=o.vp=0,v.t=v.to=0,p=-1,u.forEach(d=>Object.assign(d.p,{x:0,y:0,r:0,vx:0,vy:0,vr:0}));let[n,s]=t.ratio>=1?[B,B/t.ratio]:[B*t.ratio,B];y={w:n,h:s,fold:/napkin/i.test(t.type),spin:/coaster/i.test(t.type)},l.a=l.v=0,b.n=0;let c=new _(n,s,24,24),h=new _(n,s,24,24);T=[c,h];for(let d of u){let L=new W(c,Q(t.bulge,1,d.keep)),a=new W(h,Q(t.bulge,-1,d.keep));L.position.z=wt,a.position.z=-wt,a.rotation.y=Math.PI,d.group.add(L,a),d.meshes=[L,a]}r.classList.remove("ready");let M=0;[t.front,t.back].forEach((d,L)=>{At.load(d,a=>{if(e!==$)return a.dispose();a.colorSpace="srgb",a.anisotropy=f.capabilities.getMaxAnisotropy();for(let V of u)V.meshes[L].material.uniforms.uMap.value=a;++M===2&&(r.classList.add("ready"),R=1)})})}let H=new Mt,j=new vt,ot=new E,nt=t=>{let e=F.getBoundingClientRect();ot.set((t.clientX-e.left)/e.width*2-1,-((t.clientY-e.top)/e.height)*2+1),H.setFromCamera(ot,w),g.updateMatrixWorld(!0),j.copy(P.matrixWorld).invert();let n=H.ray.origin.clone().applyMatrix4(j),s=H.ray.direction.clone().transformDirection(j);if(Math.abs(s.z)<1e-4)return null;let c=-n.z/s.z;return c>0?new ut().copy(n).addScaledVector(s,c):null},bt=()=>Math.abs(o.yaw-o.rest)<.35&&Math.abs(o.pitch)<.35&&Math.round(o.rest/Math.PI)%2===0,at=(t,e)=>{let n=r.getBoundingClientRect(),s=t.x-n.left,c=t.y-n.top;m.style.cssText=`left:${s}px;top:${c}px;width:${Math.hypot(e.x-t.x,e.y-t.y)}px;transform:rotate(${Math.atan2(e.y-t.y,e.x-t.x)}rad)`},rt=t=>{let e=F.getBoundingClientRect();if(S.set((t.clientX-e.left)/e.width*2-1,-((t.clientY-e.top)/e.height)*2+1),!i||t.pointerId!==i.id)return;if(i.mode==="slice"){at({x:i.x,y:i.y},{x:t.clientX,y:t.clientY});return}let n=performance.now(),s=Math.max(.004,(n-i.t)/1e3);Math.hypot(t.clientX-i.x,t.clientY-i.y)>6&&(i.moved=!0);let c=i.yaw+(t.clientX-i.x)*.011,h=C(i.pitch+(t.clientY-i.y)*.007,-.9,.9);o.vy=C((c-o.yaw)/s*.4+o.vy*.6,-25,25),o.vp=C((h-o.pitch)/s*.4+o.vp*.6,-25,25),o.yaw=c,o.pitch=h,i.t=n},Lt=t=>{if(i||t.pointerType==="mouse"&&t.button!==0)return;r.setPointerCapture?.(t.pointerId);let e=nt(t),n=e&&p<0&&v.to===0&&bt()&&Math.abs(e.x)>y.w*.32&&Math.abs(e.y)<y.h/2+.15;i={id:t.pointerId,mode:n?"slice":"turn",x:t.clientX,y:t.clientY,at:e,yaw:o.yaw,pitch:o.pitch,t:performance.now(),moved:!1},n?(m.classList.remove("go"),at({x:t.clientX,y:t.clientY},{x:t.clientX,y:t.clientY}),m.classList.add("on")):r.classList.add("grabbing")},O=t=>{if(!i||t.pointerId!==i.id)return;let e=i;if(i=null,r.classList.remove("grabbing"),r.releasePointerCapture?.(t.pointerId),e.mode==="slice"){let n=t.type==="pointerup"?nt(t):null,s=n&&e.at&&Math.sign(n.x)===-Math.sign(e.at.x)&&Math.abs(n.x)>y.w*.32,c=s?n.x-e.at.x:0,h=s?C((n.y-e.at.y)/c,-.7,.7):0,M=s?e.at.y-(n.y-e.at.y)/c*e.at.x:0;s&&Math.abs(M)<y.h/2&&(m.classList.add("go"),zt(h,M)),m.classList.remove("on");return}if(!e.moved&&performance.now()-e.t<450&&t.type==="pointerup")return It();o.rest=Math.round((o.yaw+o.vy*.12)/Math.PI)*Math.PI},it=t=>{if(t.ctrlKey)return;t.preventDefault();let e=t.deltaMode===1?16:1;o.yaw-=t.deltaX*e*.008,o.pitch=C(o.pitch-t.deltaY*e*.005,-.9,.9),o.vy=o.vp=0,q=performance.now()+220,o.rest=Math.round(o.yaw/Math.PI)*Math.PI},Pt=()=>{o.rest=Math.round(o.yaw/Math.PI)*Math.PI+Math.PI};function It(){if(p>=0)return;if(y.fold)return void(v.to=1-v.to);x.v+=9;let t=performance.now();b.n=t-b.t<700?b.n+1:1,b.t=t,y.spin&&b.n>=3&&(l.v=15,b.n=0)}function zt(t,e){tt(c=>c.uCut.value.set(t,e)),p=0;let[n,s]=u;Object.assign(n.p,{x:0,y:0,r:0,vx:-.5+Math.random()*.4,vy:1.7,vr:-1.1-Math.random()}),Object.assign(s.p,{x:0,y:0,r:0,vx:.5-Math.random()*.4,vy:-.2,vr:1+Math.random()})}addEventListener("pointermove",rt,{passive:!0}),addEventListener("pointerup",O),addEventListener("pointercancel",O),r.addEventListener("pointerdown",Lt),r.addEventListener("pointerenter",()=>A=!0),r.addEventListener("pointerleave",()=>(A=!1,S.set(0,0))),r.addEventListener("wheel",it,{passive:!1});let k=0,K=performance.now(),st=0,I=1,N=!0,z=new E,ct=t=>{if(k=0,!N||document.hidden)return;let e=Math.min(.033,(t-K)/1e3);K=t,st+=e;let n=i?.mode==="turn"||t<q;n||(o.vy+=((o.rest-o.yaw)*70-o.vy*10.5)*e,o.vp+=((0-o.pitch)*60-o.vp*10)*e,o.yaw+=o.vy*e,o.pitch+=o.vp*e);let s=!n&&Math.abs(o.yaw-o.rest)<.6,c=s&&A&&i?.mode!=="slice"?S:{x:0,y:0};z.x+=(c.x-z.x)*(1-Math.exp(-e*9)),z.y+=(c.y-z.y)*(1-Math.exp(-e*9)),U+=((A?1:0)-U)*(1-Math.exp(-e*6)),R=Math.max(0,R-e*2.4);let h=1-Math.pow(1-(1-R),3);v.t=C(v.t+Math.sign(v.to-v.t)*(e/Et),0,1);let M=Rt(v.t);x.v+=(-x.x*220-x.v*12)*e,x.x+=x.v*e,P.position.y=M*y.h*.25,P.scale.set(1+x.x*.05,1-x.x*.05,1),l.v*=Math.exp(-1.15*e),l.a+=l.v*e,Math.abs(l.v)<.8&&(l.a+=(Math.round(l.a/(2*Math.PI))*2*Math.PI-l.a)*(1-Math.exp(-6*e))),P.rotation.z=l.a;let d=1;if(p>=0){p+=e;for(let a of u)a.p.vy-=7*e,a.p.x+=a.p.vx*e,a.p.y+=a.p.vy*e,a.p.r+=a.p.vr*e,a.group.position.set(a.p.x,a.p.y,0),a.group.rotation.z=a.p.r;if(p>Ct){p=-1,tt(a=>(a.uCut.value.set(0,0),a.uAlpha.value=0));for(let a of u)a.group.position.set(0,0,0),a.group.rotation.z=0;I=0}}p<0&&I<1&&(I=Math.min(1,I+e/St),d=I),g.rotation.set(o.pitch-z.y*.32+Math.sin(M*Math.PI)*.35,o.yaw+z.x*.36,0),g.position.y=(D?0:Math.sin(st*1.3)*.015)+(1-h)*.5,g.scale.setScalar(.9+.1*h);let L=Math.cos(g.rotation.y)<0;for(let a of u)a.meshes.forEach((V,dt)=>{let X=V.material.uniforms;X.uHolo.value=p<0?U*(s?1:.6):0,X.uPointer.value.set(S.x*(dt?-1:1)*(L===(dt===1)?1:0),S.y),X.uFold.value=M,p<0&&I<=1&&(X.uAlpha.value=d)});f.render(G,w),k=requestAnimationFrame(ct)},lt=()=>{k||(K=performance.now(),k=requestAnimationFrame(ct))},pt=new IntersectionObserver(t=>{N=t.at(-1).isIntersecting,N&&lt()});return pt.observe(r),lt(),{setItem:gt,flip:Pt,dispose(){cancelAnimationFrame(k),pt.disconnect(),J.disconnect(),removeEventListener("pointermove",rt),removeEventListener("pointerup",O),removeEventListener("pointercancel",O),r.removeEventListener("wheel",it),et(),m.remove(),f.dispose(),F.remove()}}}export{Xt as mountCard};
