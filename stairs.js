// Stair footprint uses four ordered corners; elevation is relative to its floor.
function stairPoint(s,u,v,z=0){const [a,b,,d]=s.points;const t=s.stairReverse?1-v:v;return{x:a.x+(b.x-a.x)*u+(d.x-a.x)*t,y:a.y+(b.y-a.y)*u+(d.y-a.y)*t,z}}
function stairDimensions(s){const [a,b,,d]=s.points;return{w:Math.hypot(b.x-a.x,b.y-a.y),h:Math.hypot(d.x-a.x,d.y-a.y)}}
function stairRectangle(a,ux,uy,w,h){return[{...a},{x:a.x+ux.x*w,y:a.y+ux.y*w},{x:a.x+ux.x*w+uy.x*h,y:a.y+ux.y*w+uy.y*h},{x:a.x+uy.x*h,y:a.y+uy.y*h}]}
function stairAxes(s){const [a,b,,d]=s.points,dim=stairDimensions(s);return{ux:{x:(b.x-a.x)/Math.max(.001,dim.w),y:(b.y-a.y)/Math.max(.001,dim.w)},uy:{x:(d.x-a.x)/Math.max(.001,dim.h),y:(d.y-a.y)/Math.max(.001,dim.h)}}}
function resizeStair(s,start,q,index){const {ux,uy}=stairAxes(start),op=start.points[(index+2)%4],dx=q.x-op.x,dy=q.y-op.y,sx=index===0||index===3?-1:1,sy=index<2?-1:1,w=Math.max(.1,(dx*ux.x+dy*ux.y)*sx),h=Math.max(.1,(dx*uy.x+dy*uy.y)*sy);let a={x:op.x-(sx<0?ux.x*w:0)-(sy<0?uy.x*h:0),y:op.y-(sx<0?ux.y*w:0)-(sy<0?uy.y*h:0)};s.points=stairRectangle(a,ux,uy,w,h)}
function sizeStair(s,axis,value){const {ux,uy}=stairAxes(s),d=stairDimensions(s);s.points=stairRectangle(s.points[0],ux,uy,axis==='Width'?value:d.w,axis==='Height'?value:d.h)}
function stairMesh(s,gap,riseOverride){
 const count=s.stairSteps||12,rise=Number.isFinite(riseOverride)?riseOverride:(s.stairFloors||1)*gap,faces=[];
 const add=(points,shade,kind)=>faces.push({points,shade,kind});
 for(let i=0;i<count;i++){
  const v=i/count,w=(i+1)/count,z=(i+1)*rise/count,low=i*rise/count;
  add([stairPoint(s,0,v,z),stairPoint(s,1,v,z),stairPoint(s,1,w,z),stairPoint(s,0,w,z)],1,'tread');
  add([stairPoint(s,0,v,low),stairPoint(s,1,v,low),stairPoint(s,1,v,z),stairPoint(s,0,v,z)],.67,'riser');
 }
 return faces;
}
if(typeof module!=='undefined')module.exports={stairPoint,stairMesh,stairDimensions,resizeStair,sizeStair};
