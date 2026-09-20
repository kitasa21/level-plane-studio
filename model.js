function snapRotation(value){const n=Number(value);return Number.isFinite(n)?((Math.round(n/15)*15)%360+360)%360:0}
function rotationCenter(s){if(s.type==='circle'){const xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y);return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2}}return s.points.reduce((c,p)=>({x:c.x+p.x/s.points.length,y:c.y+p.y/s.points.length}),{x:0,y:0})}
function rotateShapeTo(s,value){const target=snapRotation(value),angle=(target-(s.rotation||0))*Math.PI/180,c=rotationCenter(s);if(s.type!=='circle')s.points=s.points.map(p=>({x:c.x+(p.x-c.x)*Math.cos(angle)-(p.y-c.y)*Math.sin(angle),y:c.y+(p.x-c.x)*Math.sin(angle)+(p.y-c.y)*Math.cos(angle)}));s.rotation=target;return target}
function floorVisible(level,f){return !(level.hiddenFloors||[]).includes(f)}
function floorHeight(level,f){
 const heights=level.floorHeights;
 if(heights&&Number.isFinite(heights[f]))return heights[f];
 if(!heights||level.floors.includes(f))return (f-1)*(level.gap||4);
 const below=level.floors.filter(n=>n<f),anchor=below.length?Math.max(...below):Math.min(...level.floors);
 return floorHeight(level,anchor)+(f-anchor)*4;
}
function stairRise(level,s){const f=level.layers.find(l=>l.id===s.layer).floor;return floorHeight(level,f+(s.stairFloors||1))-floorHeight(level,f)}
function layerVisible(level,l){return !!l&&l.visible!==false&&floorVisible(level,l.floor)}
function previewGridBounds(level){
 const visible=new Set(level.layers.filter(l=>layerVisible(level,l)).map(l=>l.id));
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const s of level.shapes){if(!visible.has(s.layer))continue;for(const p of s.points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}}
 if(!Number.isFinite(minX))return{x:-10,y:-8,w:20,h:16};
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,w=Math.max(20,maxX-minX+4),h=Math.max(16,maxY-minY+4);
 const x=Math.floor(cx-w/2),y=Math.floor(cy-h/2);
 return{x,y,w:Math.ceil(cx+w/2)-x,h:Math.ceil(cy+h/2)-y};
}
// One object per layer. Legacy grouped layers are split without losing geometry.
function normalizeLevel(data){
 if(!data||data.format!=='level-studio'||![1,2].includes(data.version)||!Array.isArray(data.layers)||data.layers.length>10000||!Array.isArray(data.shapes)||data.shapes.length>10000)throw Error('Invalid level');
 const oldLayers=new Map();
 for(const l of data.layers){if(!l||typeof l.id!=='string'||oldLayers.has(l.id)||typeof l.name!=='string'||!Number.isSafeInteger(l.floor)||l.floor<1)throw Error('Invalid layer');oldLayers.set(l.id,l)}
 let floors=data.version===2?data.floors:[...new Set(data.layers.map(l=>l.floor))];
 if(!Array.isArray(floors)||floors.some(f=>!Number.isSafeInteger(f)||f<1)||new Set(floors).size!==floors.length||floors.length>10000)throw Error('Invalid floors');
 if(!floors.length)floors=[1];floors=[...floors].sort((a,b)=>a-b);
 const shapes=[],layers=[],ids=new Set();
 for(const s of data.shapes){
 if(!s||typeof s.id!=='string'||ids.has(s.id)||!oldLayers.has(s.layer)||!['rect','circle','arrow','stairs'].includes(s.type)||!/^#[0-9a-f]{6}$/i.test(s.color)||typeof s.name!=='string'||!Array.isArray(s.points)||s.points.length<(s.type==='circle'?2:3)||s.points.length>2000||s.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e5||Math.abs(p.y)>1e5))throw Error('Invalid shape');
 if(s.type==='stairs'&&(s.points.length!==4||(s.stairSteps!==undefined&&(!Number.isInteger(s.stairSteps)||s.stairSteps<2||s.stairSteps>64))||(s.stairFloors!==undefined&&(!Number.isInteger(s.stairFloors)||s.stairFloors<1||s.stairFloors>100))))throw Error('Invalid stairs');
 ids.add(s.id);
 }
 for(const l of data.layers){if(!floors.includes(l.floor))throw Error('Unknown floor');for(const s of data.shapes.filter(s=>s.layer===l.id)){const id='object-layer-'+layers.length;layers.push({id,name:s.name,floor:l.floor,visible:l.visible!==false,locked:!!l.locked});shapes.push({id:s.id,type:s.type,name:s.name,color:s.color,layer:id,points:s.points.map(p=>({x:p.x,y:p.y})),rotation:Number.isFinite(s.rotation)?s.rotation:0,...(s.type==='stairs'?{stairSteps:s.stairSteps||12,stairFloors:s.stairFloors||1,stairReverse:!!s.stairReverse}:{})})}}
 const hiddenFloors=data.hiddenFloors||[];
 if(!Array.isArray(hiddenFloors)||hiddenFloors.some(f=>!floors.includes(f)))throw Error('Invalid hidden floors');
 const gap=Math.max(1,Math.min(30,+data.gap||4)),floorHeights={};
 if(data.floorHeights!==undefined&&(!data.floorHeights||typeof data.floorHeights!=='object'||Array.isArray(data.floorHeights)))throw Error('Invalid floor heights');
 for(const f of floors){const h=data.floorHeights===undefined?(f-1)*gap:data.floorHeights[f];if(!Number.isFinite(h)||Math.abs(h)>1e5)throw Error('Invalid floor height');floorHeights[f]=h}
 return {name:typeof data.name==='string'?data.name:'导入的关卡',floors,floorHeights,hiddenFloors:[...new Set(hiddenFloors)],layers,shapes,gap};
}
if(typeof module!=='undefined')module.exports={normalizeLevel,snapRotation,rotationCenter,rotateShapeTo,floorVisible,floorHeight,stairRise,layerVisible,previewGridBounds};
