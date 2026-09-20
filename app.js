const $=id=>document.getElementById(id), svg=$('canvas'), NS='http://www.w3.org/2000/svg';
let state={name:'未命名关卡',floors:[1,2,3],floorHeights:{1:0,2:4,3:8},hiddenFloors:[],layers:[],shapes:[],gap:4};
let activeLayer=null,floor=1,selected=null,tool='select',view='2',zoom=1,pan={x:0,y:0},angle=-.65,tilt=.62,history=[],future=[],drag=null,space=false,serial=0;
const collapsedFloors=new Set();
let objectClipboard=null,pasteCount=0,layerDrag=null;
const colors=['#22ad88','#67a8d1','#dfb76a','#b18bc7','#df8b82','#6e8499'];
function el(tag,attrs={},parent=svg){let n=document.createElementNS(NS,tag);for(let k in attrs)n.setAttribute(k,attrs[k]);parent.appendChild(n);return n}
function clone(v){return JSON.parse(JSON.stringify(v))}function checkpoint(){history.push(clone(state));if(history.length>80)history.shift();future=[];buttons()}
function buttons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function layer(s){return state.layers.find(l=>l.id===s.layer)}function shape(){return state.shapes.find(s=>s.id===selected)}function bounds(s){let xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y);let x=Math.min(...xs),y=Math.min(...ys);return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}}
function center(){return{x:svg.clientWidth/2+pan.x,y:svg.clientHeight/2+pan.y}}
function project(p,f=1){let c=center(),u=40*zoom;if(view==='2')return{x:c.x+p.x*u,y:c.y+p.y*u};let ca=Math.cos(angle),sa=Math.sin(angle);return{x:c.x+(p.x*ca-p.y*sa)*u,y:c.y+(p.x*sa+p.y*ca)*u*Math.sin(tilt)-floorHeight(state,f)*u*Math.cos(tilt)}}
function world(e){let r=svg.getBoundingClientRect(),c=center();return{x:(e.clientX-r.left-c.x)/(40*zoom),y:(e.clientY-r.top-c.y)/(40*zoom)}}
function quant(p){return $('snap').checked?{x:Math.round(p.x),y:Math.round(p.y)}:p}function pts(a){return a.map(p=>`${p.x},${p.y}`).join(' ')}
function geometry(s){let b=bounds(s);if(s.type==='circle'){return Array.from({length:64},(_,i)=>({x:b.x+b.w/2+Math.cos(i*Math.PI/32)*b.w/2,y:b.y+b.h/2+Math.sin(i*Math.PI/32)*b.h/2}))}return s.points}
function projectAt(p,f){const q=project(p,f);if(view==='3')q.y-=(p.z||0)*40*zoom*Math.cos(tilt);return q}
function shade(color,k){return '#'+color.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*k).toString(16).padStart(2,'0')).join('')}
function drawStairPlan(s,f,opacity){if(s.points.length!==4)return;let g=el('g',{'pointer-events':'none',opacity});for(let i=1;i<(s.stairSteps||12);i++){let a=project(stairPoint(s,0,i/(s.stairSteps||12)),f),b=project(stairPoint(s,1,i/(s.stairSteps||12)),f);el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:s.color,'stroke-width':1},g)}let a=project(stairPoint(s,.5,.12),f),b=project(stairPoint(s,.5,.85),f),dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len;el('path',{d:`M${a.x},${a.y} L${b.x},${b.y} M${b.x-ux*8-uy*5},${b.y-uy*8+ux*5} L${b.x},${b.y} L${b.x-ux*8+uy*5},${b.y-uy*8-ux*5}`,stroke:shade(s.color,.55),'stroke-width':2,fill:'none'},g)}
function gridCorners(b){return[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}]}
function drawPreviewGrid(f,b,defs){
 const o=project({x:0,y:0},f),px=project({x:1,y:0},f),py=project({x:0,y:1},f),u=40*zoom;
 const group=el('g',{transform:'matrix('+[px.x-o.x,px.y-o.y,py.x-o.x,py.y-o.y,o.x,o.y].join(' ')+')','data-grid-floor':f,'pointer-events':'none'});
 el('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:'#edf4ed','fill-opacity':.12,stroke:'#a9bfb0','stroke-width':.8/u,'data-grid-bounds':[b.x,b.y,b.w,b.h].join(',')},group);
 if($('grid').checked){
 const majorStep=Math.max(5,5**Math.ceil(Math.log(8/Math.max(.001,u))/Math.log(5)));
 for(let [id,step,color,width,opacity] of [['unit',1,'#c6d5c8',.55,Math.min(1,u/4)],['major',majorStep,'#b5c7b9',.8,1]]){
 const patternId='preview-grid-'+f+'-'+id;
 const pattern=el('pattern',{id:patternId,width:step,height:step,patternUnits:'userSpaceOnUse'},defs);
 el('path',{d:'M'+step+' 0 H0 V'+step,fill:'none',stroke:color,'stroke-width':width/u},pattern);
 el('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:'url(#'+patternId+')',opacity,'data-grid-spacing':step},group);
 }}
 const label=project({x:b.x,y:b.y},f);el('text',{x:label.x-10,y:label.y-12,fill:'#527e68','font-size':13,'font-weight':600}).textContent=f+'F · 高度 '+floorHeight(state,f);
}
function render3D(){
 const grid=previewGridBounds(state);let defs=el('defs');
 for(let f of state.floors.filter(f=>floorVisible(state,f))){drawPreviewGrid(f,grid,defs)}
 let faces=[];for(let l of state.layers.filter(l=>layerVisible(state,l))){for(let s of state.shapes.filter(s=>s.layer===l.id)){if(s.type==='stairs'&&s.points.length===4){for(let face of stairMesh(s,state.gap,stairRise(state,s)))faces.push({...face,f:l.floor,color:shade(s.color,face.shade),stroke:shade(s.color,.55),id:s.id,opacity:1})}else faces.push({points:geometry(s),f:l.floor,color:s.color,stroke:s.color,id:s.id,opacity:.52,kind:'plane'})}}
 const depth=face=>face.points.reduce((sum,p)=>sum+(p.x*Math.sin(angle)+p.y*Math.cos(angle))*Math.cos(tilt)+(floorHeight(state,face.f)+(p.z||0))*Math.sin(tilt),0)/face.points.length;
 faces.sort((a,b)=>depth(a)-depth(b));for(let face of faces)el('polygon',{points:pts(face.points.map(p=>projectAt(p,face.f))),fill:face.color,'fill-opacity':face.opacity,stroke:face.stroke,'stroke-width':.7,'stroke-linejoin':'round','data-stair-face':face.kind==='plane'?'':face.kind,'data-object':face.id,'pointer-events':'none'});
}
function render(){svg.replaceChildren();let c=center(),u=40*zoom;
 if(view==='2'&&$('grid').checked){let defs=el('defs'),pattern=el('pattern',{id:'gridpattern',width:u,height:u,patternUnits:'userSpaceOnUse',x:c.x,y:c.y},defs);el('path',{d:`M ${u} 0 L 0 0 0 ${u}`,fill:'none',stroke:'#dfe5dd','stroke-width':.7},pattern);el('rect',{width:'100%',height:'100%',fill:'url(#gridpattern)'});el('line',{x1:c.x,x2:c.x,y1:0,y2:svg.clientHeight,stroke:'#c8d6c9','stroke-width':1});el('line',{x1:0,x2:svg.clientWidth,y1:c.y,y2:c.y,stroke:'#c8d6c9','stroke-width':1});}
 let floors=view==='3'?state.floors:[...state.floors.filter(f=>f!==floor),floor];
 if(view==='3')render3D();
 for(let f of (view==='3'?[]:floors)){
 for(let l of state.layers.filter(l=>l.floor===f&&layerVisible(state,l))){if(view==='2'&&f!==floor&&!$('ghost').checked)continue;for(let s of state.shapes.filter(s=>s.layer===l.id)){let active=f===floor,points=geometry(s).map(p=>project(p,f));el('polygon',{points:pts(points),fill:s.color,'fill-opacity':view==='2'&&!active?.10:.52,stroke:s.color,'stroke-width':selected===s.id?2.5:1.5,'stroke-opacity':view==='2'&&!active?.25:1,'data-shape':s.id,'pointer-events':view==='2'&&active&&!l.locked?'all':'none',cursor:tool==='select'?'move':'crosshair'});if(s.type==='stairs')drawStairPlan(s,f,active?1:.25);}}
 }
 let s=shape();if(s&&(tool==='select'||tool==='vertex')&&view==='2'&&layerVisible(state,layer(s))&&layer(s).floor===floor&&!layer(s).locked){if(tool==='vertex'&&s.type==='rect'){s.points.forEach((p,i)=>{let a=project(p),next=s.points[(i+1)%s.points.length],m=project({x:(p.x+next.x)/2,y:(p.y+next.y)/2});el('circle',{cx:m.x,cy:m.y,r:8,fill:'white',stroke:'#0a9f80','data-mid':i,cursor:'copy'});let text=el('text',{x:m.x,y:m.y+4,'text-anchor':'middle',fill:'#0a9f80','font-size':12,'pointer-events':'none'});text.textContent='+';el('circle',{cx:a.x,cy:a.y,r:5,fill:'#0a9f80',stroke:'white','stroke-width':2,'data-vertex':i,cursor:'move'});});}else{let b=bounds(s),a=project(b),z=project({x:b.x+b.w,y:b.y+b.h});el('rect',{x:a.x-3,y:a.y-3,width:z.x-a.x+6,height:z.y-a.y+6,fill:'none',stroke:'#159e80','stroke-dasharray':'4 3','pointer-events':'none'});for(let [i,p] of (s.type==='stairs'?s.points.map((p,i)=>[i,p]):[[0,{x:b.x,y:b.y}],[1,{x:b.x+b.w,y:b.y}],[2,{x:b.x+b.w,y:b.y+b.h}],[3,{x:b.x,y:b.y+b.h}]])){let q=project(p);el('rect',{x:q.x-4,y:q.y-4,width:8,height:8,rx:1,fill:'white',stroke:'#149d7d','data-resize':i,cursor:i%2?'nesw-resize':'nwse-resize'});}}}
 if(s&&view==='2'&&layerVisible(state,layer(s))&&layer(s).floor===floor&&!layer(s).locked&&(tool==='select'||tool==='vertex'))drawRotationControl(s);
 $('empty').hidden=state.shapes.length>0||view==='3';$('zoomLabel').textContent=Math.round(zoom*100)+'%';$('stats').textContent=state.shapes.length+' 个图形';$('status').textContent=view==='3'?'3D 空间预览':floor+'F · '+(state.layers.find(l=>l.id===activeLayer)?.name||'');$('hint').textContent=view==='3'?'拖动旋转视角 · 滚轮缩放 · 空格拖动平移':tool==='vertex'?'拖动顶点调整轮廓 · 点击 ＋ 增加顶点':tool==='select'?'Alt 拖动复制 · Ctrl+C / V 复制粘贴 · 空格平移':'在画布上拖动绘制 · Esc 返回选择';}
function drawRotationControl(s){let c=project(rotationCenter(s)),b=bounds(s),radius=Math.hypot(b.w,b.h)*20*zoom+25,a=((s.rotation||0)-90)*Math.PI/180,p={x:c.x+Math.cos(a)*radius,y:c.y+Math.sin(a)*radius};el('line',{x1:c.x,y1:c.y,x2:p.x,y2:p.y,stroke:'#128b73','stroke-width':1,'stroke-dasharray':'3 4','pointer-events':'none'});el('circle',{cx:p.x,cy:p.y,r:10,fill:'white',stroke:'#128b73','stroke-width':1.5,'data-rotate':'true',cursor:'grab'});let label=el('text',{x:p.x,y:p.y+4,'text-anchor':'middle',fill:'#128b73','font-size':13,'pointer-events':'none'});label.textContent='↻'}
function chooseFloor(f){floor=f;selected=null;activeLayer=null;panels();properties();render()}
function selectObject(s){collapsedFloors.delete(layer(s).floor);selected=s.id;activeLayer=s.layer;floor=layer(s).floor;panels();properties();render()}
function refresh(){panels();properties();render()}
function reorder(id,direction){let l=state.layers.find(x=>x.id===id);if(!l||l.locked)return;let siblings=state.layers.filter(x=>x.floor===l.floor),i=siblings.indexOf(l),other=siblings[i+direction];if(!other)return;checkpoint();let a=state.layers.indexOf(l),b=state.layers.indexOf(other);[state.layers[a],state.layers[b]]=[state.layers[b],state.layers[a]];refresh()}
function copyObject(source,sourceLayer,{targetFloor=sourceLayer.floor,offset={x:0,y:0},afterLayerId=sourceLayer.id}={}){
 const id='s'+Date.now()+'-'+serial++,copy=clone(source);copy.id=id;copy.layer='l'+id;copy.name=source.name+' 副本';
 copy.points=copy.points.map(p=>({x:p.x+offset.x,y:p.y+offset.y}));
 const newLayer={...clone(sourceLayer),id:copy.layer,name:copy.name,floor:targetFloor,visible:true,locked:false};
 const after=state.layers.findIndex(l=>l.id===afterLayerId);
 state.layers.splice(after<0?state.layers.length:after+1,0,newLayer);state.shapes.push(copy);return copy;
}
function duplicate(){const source=shape();if(!source)return;checkpoint();selectObject(copyObject(source,layer(source),{offset:{x:1,y:1}}));svg.focus({preventScroll:true})}
function copySelected(){const source=shape();if(!source)return false;objectClipboard={shape:clone(source),layer:clone(layer(source))};pasteCount=0;toast('体块已复制，按 Ctrl+V 粘贴到当前楼层');return true}
function pasteObject(){
 if(!objectClipboard)return false;
 if(!floorVisible(state,floor)){toast('当前楼层已隐藏，请先显示该楼层再粘贴');return true}
 checkpoint();pasteCount++;const offset={x:pasteCount,y:pasteCount};
 const copy=copyObject(objectClipboard.shape,objectClipboard.layer,{targetFloor:floor,offset,afterLayerId:activeLayer});
 selectObject(copy);svg.focus({preventScroll:true});return true;
}
function cancelCopyDrag(){
 if(!drag||!['copyPending','copyMove'].includes(drag.kind))return false;
 const gesture=drag;if(gesture.undoState){state=clone(gesture.undoState);history=gesture.historyBefore;future=gesture.futureBefore}
 selected=gesture.sourceId;activeLayer=shape()?.layer||null;drag=null;refresh();return true;
}
function layerDropSource(e){if(!layerDrag)return null;const id=e.dataTransfer.getData('text/plain');if(id!==layerDrag.id)return null;return state.layers.find(l=>l.id===id)}
function layerDropCopies(e){return !!(e.altKey||layerDrag?.copy)}
function handleLayerDrop(e,targetFloor,afterLayerId=null){
 e.preventDefault();e.stopPropagation();const from=layerDropSource(e),copying=layerDropCopies(e);layerDrag=null;
 if(!from||from.locked||(!copying&&from.id===afterLayerId)){panels();return}
 const source=state.shapes.find(s=>s.layer===from.id);if(!source)return;checkpoint();
 if(copying){selectObject(copyObject(source,from,{targetFloor,afterLayerId:afterLayerId||from.id}));toast('已复制为独立图层')}
 else{if(afterLayerId){state.layers.splice(state.layers.indexOf(from),1);state.layers.splice(state.layers.findIndex(l=>l.id===afterLayerId)+1,0,from)}from.floor=targetFloor;selectObject(source)}
 svg.focus({preventScroll:true});
}
function moveToFloor(s,f){layer(s).floor=f;floor=f;activeLayer=s.layer}
function eyeButton(visible,label,action,inherited=false){
 const btn=document.createElement('button');btn.className='eye-button'+(visible?'':' is-hidden')+(inherited?' inherited-hidden':'');
 btn.title=(visible?'隐藏':'显示')+label+(inherited?'（所属楼层已隐藏）':'');btn.setAttribute('aria-label',btn.title);btn.setAttribute('aria-pressed',String(visible));
 const icon=el('svg',{viewBox:'0 0 24 24',width:19,height:19,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'},btn);
 el('path',{d:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z'},icon);el('circle',{cx:12,cy:12,r:3},icon);
 if(!visible)el('path',{d:'m3 3 18 18'},icon);
 btn.onclick=e=>{e.stopPropagation();action()};return btn;
}
function toggleFloorVisibility(f){checkpoint();const hidden=new Set(state.hiddenFloors||[]);if(hidden.has(f))hidden.delete(f);else hidden.add(f);state.hiddenFloors=[...hidden];drag=null;refresh()}
function toggleLayerVisibility(l){checkpoint();l.visible=!l.visible;drag=null;refresh()}
function setFloorHeight(f,value){
 const h=Number(value);if(String(value).trim()===''||!Number.isFinite(h)||Math.abs(h)>100000){toast('请输入 -100000 至 100000 之间的高度');return false}
 if(h===floorHeight(state,f))return true;
 checkpoint();state.floorHeights=Object.fromEntries(state.floors.map(n=>[n,floorHeight(state,n)]));state.floorHeights[f]=h;
 if(view==='3')fit3D();refresh();return true;
}
function panels(){
 $('floorTabs').replaceChildren();let selector=document.createElement('select');selector.id='floorSelect';selector.setAttribute('aria-label','当前楼层');for(let f of state.floors){let o=document.createElement('option');o.value=f;o.textContent=f+'F';selector.appendChild(o)}selector.value=floor;selector.onchange=()=>chooseFloor(+selector.value);$('floorTabs').appendChild(selector);let count=document.createElement('span');count.textContent='共 '+state.floors.length+' 层';$('floorTabs').appendChild(count);
 $('layerList').replaceChildren();for(let f of [...state.floors].reverse()){
 let group=document.createElement('section');group.className='floor-group'+(floorVisible(state,f)?'':' floor-hidden');let heading=document.createElement('div');heading.className='floor-heading'+(f===floor?' current':'');let choose=document.createElement('button');choose.textContent=f+'F · 楼层';choose.onclick=()=>chooseFloor(f);heading.appendChild(choose);let info=document.createElement('span');let list=state.layers.filter(l=>l.floor===f);info.textContent=list.length+' 个体块';heading.appendChild(info);const heightLabel=document.createElement('label');heightLabel.className='floor-height';heightLabel.textContent='高度';const heightInput=document.createElement('input');heightInput.type='number';heightInput.step='any';heightInput.min='-100000';heightInput.max='100000';heightInput.value=floorHeight(state,f);heightInput.setAttribute('aria-label',f+'F 高度');heightInput.title='此楼层的绝对高度（单位），可输入小数或负数';heightInput.onclick=e=>e.stopPropagation();heightInput.onchange=()=>{if(!setFloorHeight(f,heightInput.value))heightInput.value=floorHeight(state,f)};heightInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();heightInput.blur()}};heightLabel.appendChild(heightInput);heading.appendChild(heightLabel);heading.appendChild(eyeButton(floorVisible(state,f),f+'F 楼层',()=>toggleFloorVisibility(f)));let fold=document.createElement('button');fold.className='floor-fold';fold.setAttribute('aria-label',(collapsedFloors.has(f)?'展开':'收起')+f+'F 子图层');fold.setAttribute('aria-expanded',String(!collapsedFloors.has(f)));fold.setAttribute('aria-controls','floor-children-'+f);fold.title='展开 / 收起子图层';fold.textContent=collapsedFloors.has(f)?'▸':'▾';fold.onclick=()=>{if(collapsedFloors.has(f))collapsedFloors.delete(f);else collapsedFloors.add(f);panels()};heading.appendChild(fold);group.appendChild(heading);let children=document.createElement('div');children.id='floor-children-'+f;children.hidden=collapsedFloors.has(f);group.appendChild(children);
 for(let l of [...list].reverse()){
 let object=state.shapes.find(s=>s.layer===l.id);if(!object)continue;
 let div=document.createElement('div');div.className='layer'+(selected===object.id?' active':'');div.dataset.layer=l.id;div.draggable=!l.locked;div.setAttribute('aria-label',object.name+' 图层');
 let icon=document.createElement('button');icon.className='layer-icon';icon.textContent={rect:'□',circle:'○',arrow:'↗',stairs:'▟'}[object.type];icon.style.color=object.color;icon.title='选择体块';icon.onclick=()=>selectObject(object);div.appendChild(icon);
 let name=document.createElement('input');name.value=object.name;name.setAttribute('aria-label','体块图层名称');name.title='单击选择体块，双击重命名';name.readOnly=true;name.disabled=l.locked;name.onclick=e=>{e.stopPropagation();if(!name.readOnly)return;selected=object.id;activeLayer=l.id;floor=f;document.querySelectorAll('.layer').forEach(row=>row.classList.toggle('active',row===div));$('floorSelect').value=f;properties();render();svg.focus({preventScroll:true})};name.ondblclick=e=>{e.stopPropagation();if(l.locked)return;name.readOnly=false;name.focus();name.select()};name.onblur=()=>{name.readOnly=true};name.onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();name.blur();svg.focus({preventScroll:true})}if(e.key==='Escape'){e.stopPropagation();name.value=object.name;name.blur();svg.focus({preventScroll:true})}};name.onchange=()=>{checkpoint();object.name=l.name=name.value||'未命名体块';properties();render()};div.appendChild(name);
 div.appendChild(eyeButton(l.visible,object.name+' 图层',()=>toggleLayerVisibility(l),!floorVisible(state,f)));
 for(let [key,yes,no,title] of [['locked','▣','♧','锁定或解锁体块']]){let btn=document.createElement('button');btn.title=title;btn.setAttribute('aria-label',title);btn.textContent=l[key]?yes:no;btn.onclick=e=>{e.stopPropagation();checkpoint();l[key]=!l[key];refresh()};div.appendChild(btn)}
 div.onclick=()=>{selectObject(object);svg.focus({preventScroll:true})};div.ondragstart=e=>{if(l.locked){e.preventDefault();return}layerDrag={id:l.id,copy:!!e.altKey};e.dataTransfer.setData('text/plain',l.id);e.dataTransfer.effectAllowed='copyMove'};div.ondragover=e=>{if(!layerDrag)return;e.preventDefault();e.dataTransfer.dropEffect=layerDropCopies(e)?'copy':'move';div.classList.add('drop-target')};div.ondragleave=()=>div.classList.remove('drop-target');div.ondragend=()=>{layerDrag=null;document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'))};div.ondrop=e=>handleLayerDrop(e,f,l.id);children.appendChild(div);
 }
 if(!list.length){let empty=document.createElement('p');empty.className='floor-empty';empty.textContent='此楼层暂无体块，选择后在画布绘制';children.appendChild(empty)}
 heading.ondragover=e=>{if(!layerDrag)return;e.preventDefault();e.dataTransfer.dropEffect=layerDropCopies(e)?'copy':'move'};heading.ondrop=e=>handleLayerDrop(e,f);$('layerList').appendChild(group);
 }
 $('layerUp').disabled=$('layerDown').disabled=$('deleteLayer').disabled=!shape()||!!layer(shape())?.locked;$('copyLayer').disabled=!shape();buttons();
}
function properties(){let s=shape();$('shapeProperties').hidden=!s;$('noSelection').hidden=!!s;$('shapeTag').textContent=s?{rect:'多边形',circle:'圆形',arrow:'箭头',stairs:'楼梯'}[s.type]:'未选择';if(!s)return;$('shapeName').value=s.name;$('shapeColor').value=s.color;$('colorValue').textContent=s.color.toUpperCase();$('shapeLayer').replaceChildren();for(let f of state.floors){let o=document.createElement('option');o.value=f;o.textContent=f+'F';$('shapeLayer').appendChild(o)}$('shapeLayer').value=layer(s).floor;let b=s.type==='stairs'?stairDimensions(s):bounds(s);$('shapeWidth').value=+b.w.toFixed(2);$('shapeHeight').value=+b.h.toFixed(2);$('rotation').value=s.rotation||0;$('editVertices').hidden=$('vertexHelp').hidden=s.type!=='rect';$('stairsProperties').hidden=s.type!=='stairs';if(s.type==='stairs'){$('stairSteps').value=s.stairSteps||12;$('stairFloors').value=s.stairFloors||1;$('stairReverse').value=s.stairReverse?'reverse':'forward';$('stairsConnection').textContent=layer(s).floor+'F → '+(layer(s).floor+(s.stairFloors||1))+'F · 高度差 '+Number(stairRise(state,s).toFixed(6))+' 单位';}let locked=layer(s).locked;for(let n of $('shapeProperties').querySelectorAll('input,select,button'))n.disabled=locked;}
function panel(p){$('layersPanel').hidden=p!=='layers';$('propertiesPanel').hidden=p!=='properties';document.querySelectorAll('[data-panel]').forEach(n=>n.classList.toggle('active',n.dataset.panel===p));properties()}
function setTool(t){if(view==='3')setView('2');tool=t;document.querySelectorAll('[data-tool]').forEach(n=>n.classList.toggle('active',n.dataset.tool===t));svg.style.cursor=t==='pan'?'grab':t==='select'?'default':'crosshair';render()}
function fit3D(){pan={x:0,y:0};zoom=1;let points=[];const gridBounds=previewGridBounds(state);for(let f of state.floors.filter(f=>floorVisible(state,f))){for(let p of gridCorners(gridBounds))points.push(project(p,f))}for(let s of state.shapes){if(layerVisible(state,layer(s))){points.push(...geometry(s).map(p=>project(p,layer(s).floor)));if(s.type==='stairs')points.push(...stairMesh(s,state.gap,stairRise(state,s)).flatMap(face=>face.points.map(p=>projectAt(p,layer(s).floor))))}}if(!points.length){zoom=1;return}let b=bounds({points});zoom=Math.max(.005,Math.min(1.2,(svg.clientWidth-90)/Math.max(1,b.w),(svg.clientHeight-160)/Math.max(1,b.h)));pan={x:(svg.clientWidth/2-(b.x+b.w/2))*zoom,y:(svg.clientHeight/2-(b.y+b.h/2))*zoom+25}}
function setView(v){if(v!==view){view=v;pan={x:0,y:0};zoom=1;if(v==='3')fit3D()}$('view2').classList.toggle('active',v==='2');$('view3').classList.toggle('active',v==='3');render()}

svg.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;svg.focus({preventScroll:true});svg.setPointerCapture(e.pointerId);let p=world(e);if(space||e.button===1||tool==='pan'){drag={kind:'pan',x:e.clientX,y:e.clientY,pan:{...pan}};return}if(view==='3'){drag={kind:'orbit',x:e.clientX,y:e.clientY,angle,tilt};return}let target=e.target,s=shape();if(target.hasAttribute('data-rotate')&&s){checkpoint();let c=rotationCenter(s);drag={kind:'rotate',start:clone(s),center:c,angle:Math.atan2(p.y-c.y,p.x-c.x)};return}if(target.hasAttribute('data-mid')&&s){checkpoint();let i=+target.dataset.mid,a=s.points[i],b=s.points[(i+1)%s.points.length];s.points.splice(i+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});drag={kind:'vertex',index:i+1};render();return}if(target.hasAttribute('data-vertex')&&s){checkpoint();drag={kind:'vertex',index:+target.dataset.vertex};return}if(target.hasAttribute('data-resize')&&s){checkpoint();drag={kind:'resize',index:+target.dataset.resize,start:clone(s),box:bounds(s)};return}if(tool==='select'||tool==='vertex'){let id=target.dataset.shape;selected=id||null;if(id){s=shape();activeLayer=s.layer;if(e.altKey){drag={kind:'copyPending',sourceId:s.id,start:clone(s),sourceLayer:clone(layer(s)),p,x:e.clientX,y:e.clientY}}else{checkpoint();drag={kind:'move',start:clone(s),p};}}panels();properties();render();return}
if(!floorVisible(state,floor)){toast('当前楼层已隐藏，请点击楼层旁的小眼睛显示后再绘制');return}checkpoint();collapsedFloors.delete(floor);let q=quant(p),id='s'+Date.now()+'-'+serial++;activeLayer='l'+id;state.layers.push({id:activeLayer,name:{rect:'方形',circle:'圆形',arrow:'箭头',stairs:'楼梯'}[tool],floor,visible:true,locked:false});let newShape={id,type:tool,layer:activeLayer,color:colors[(floor-1)%colors.length],name:{rect:'方形',circle:'圆形',arrow:'箭头',stairs:'楼梯'}[tool],points:[q,{x:q.x+.01,y:q.y+.01}],rotation:0,...(tool==='stairs'?{stairSteps:12,stairFloors:1,stairReverse:false}:{})};state.shapes.push(newShape);selected=id;drag={kind:'draw',p:q};render();});
svg.addEventListener('pointermove',e=>{if(!drag)return;
 if(drag.kind==='copyPending'){
 if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<3)return;
 drag.historyBefore=[...history];drag.futureBefore=[...future];checkpoint();drag.undoState=history[history.length-1];
 const copy=copyObject(drag.start,drag.sourceLayer);selected=copy.id;activeLayer=copy.layer;drag.start=clone(copy);drag.kind='copyMove';panels();properties();
 }
 let p=world(e),s=shape();if(drag.kind==='pan'){pan={x:drag.pan.x+e.clientX-drag.x,y:drag.pan.y+e.clientY-drag.y}}else if(drag.kind==='orbit'){angle=drag.angle+(e.clientX-drag.x)*.008;tilt=Math.max(.15,Math.min(1.35,drag.tilt+(e.clientY-drag.y)*.006))}else if(s){if(drag.kind==='rotate'){let delta=Math.atan2(p.y-drag.center.y,p.x-drag.center.x)-drag.angle;delta=Math.atan2(Math.sin(delta),Math.cos(delta));s.points=clone(drag.start.points);s.rotation=drag.start.rotation||0;rotateShapeTo(s,s.rotation+delta*180/Math.PI);$('rotation').value=s.rotation;}if(drag.kind==='move'||drag.kind==='copyMove'){let delta=quant({x:p.x-drag.p.x,y:p.y-drag.p.y});s.points=drag.start.points.map(q=>({x:q.x+delta.x,y:q.y+delta.y}));}if(drag.kind==='vertex')s.points[drag.index]=quant(p);if(drag.kind==='draw'){let q=quant(p),a=drag.p,x=Math.min(a.x,q.x),y=Math.min(a.y,q.y),w=Math.max(.05,Math.abs(q.x-a.x)),h=Math.max(.05,Math.abs(q.y-a.y));if(s.type==='rect'||s.type==='stairs')s.points=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];if(s.type==='circle'){let d=Math.max(w,h);s.points=[a,{x:a.x+(q.x<a.x?-d:d),y:a.y+(q.y<a.y?-d:d)}]}if(s.type==='arrow'){let dx=q.x-a.x,dy=q.y-a.y,len=Math.max(.1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len,head=Math.min(1.2,len*.4),th=.22;let trans=(u,v)=>({x:a.x+u*ux-v*uy,y:a.y+u*uy+v*ux});s.points=[trans(0,-th),trans(len-head,-th),trans(len-head,-.65),trans(len,0),trans(len-head,.65),trans(len-head,th),trans(0,th)]}}
if(drag.kind==='resize'){if(s.type==='stairs'){resizeStair(s,drag.start,quant(p),drag.index);render();return}let b=drag.box,q=quant(p),op=[{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h},{x:b.x,y:b.y},{x:b.x+b.w,y:b.y}][drag.index];let w=Math.max(.1,Math.abs(q.x-op.x)),h=Math.max(.1,Math.abs(q.y-op.y));if(s.type==='circle')w=h=Math.max(w,h);let x=q.x<op.x?op.x-w:op.x,y=q.y<op.y?op.y-h:op.y;s.points=drag.start.points.map(a=>({x:x+(a.x-b.x)/Math.max(.01,b.w)*w,y:y+(a.y-b.y)/Math.max(.01,b.h)*h}));}}render();});
function endDrag(){if(drag?.kind==='draw'){let s=shape(),b=s&&bounds(s);if(s&&(b.w<.1||b.h<.1)){let a=drag.p;s.points=s.type==='arrow'?[{x:a.x,y:a.y-.2},{x:a.x+2,y:a.y-.2},{x:a.x+2,y:a.y-.7},{x:a.x+3,y:a.y},{x:a.x+2,y:a.y+.7},{x:a.x+2,y:a.y+.2},{x:a.x,y:a.y+.2}]:[{...a},{x:a.x+3,y:a.y},{x:a.x+3,y:a.y+3},{x:a.x,y:a.y+3}];}if(s.type==='stairs'&&b.w<.1){let a=drag.p;s.points=[{...a},{x:a.x+3,y:a.y},{x:a.x+3,y:a.y+6},{x:a.x,y:a.y+6}]}setTool('select');panels();if(s.type==='stairs')panel('properties');}drag=null;properties();render()}svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',()=>{if(!cancelCopyDrag())endDrag()});
svg.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.min(3,Math.max(.005,zoom*Math.exp(-e.deltaY*.001)));render()},{passive:false});
document.querySelectorAll('[data-tool]').forEach(n=>n.onclick=()=>setTool(n.dataset.tool));document.querySelectorAll('[data-panel]').forEach(n=>n.onclick=()=>panel(n.dataset.panel));
$('view2').onclick=()=>setView('2');$('view3').onclick=$('previewLink').onclick=()=>setView('3');$('zoomIn').onclick=()=>{zoom=Math.min(3,zoom*1.2);render()};$('zoomOut').onclick=()=>{zoom=Math.max(.005,zoom/1.2);render()};$('fit').onclick=()=>{if(view==='3'){fit3D();render();return}pan={x:0,y:0};zoom=view==='3'?.65:1;if(view==='2'&&state.shapes.length){let points=state.shapes.filter(s=>layer(s)?.floor===floor&&layerVisible(state,layer(s))).flatMap(s=>s.points);if(points.length){let b=bounds({points});zoom=Math.min(1.5,(svg.clientWidth-120)/(40*Math.max(5,b.w)),(svg.clientHeight-180)/(40*Math.max(5,b.h)));zoom=Math.max(.2,zoom);pan={x:-(b.x+b.w/2)*40*zoom,y:-(b.y+b.h/2)*40*zoom};}}render()};
$('addFloor').onclick=()=>{checkpoint();let next=Math.max(...state.floors)+1;state.floorHeights=Object.fromEntries(state.floors.map(f=>[f,floorHeight(state,f)]));state.floorHeights[next]=floorHeight(state,next-1)+4;state.floors.push(next);chooseFloor(next);if(view==='3'){fit3D();render()}toast('已新增 '+next+'F')};
$('layerUp').onclick=()=>shape()&&reorder(shape().layer,1);$('layerDown').onclick=()=>shape()&&reorder(shape().layer,-1);$('copyLayer').onclick=duplicate;$('deleteLayer').onclick=()=>remove();

for(let id of ['grid','snap','ghost'])$(id).onchange=render;
function mutate(fn){let s=shape();if(!s||layer(s).locked)return;checkpoint();fn(s);panels();properties();render()}
$('shapeName').onchange=()=>mutate(s=>{s.name=layer(s).name=$('shapeName').value||'未命名体块'});$('shapeColor').onchange=()=>mutate(s=>s.color=$('shapeColor').value);$('shapeLayer').onchange=()=>{mutate(s=>{moveToFloor(s,+$('shapeLayer').value)});panels()};for(let color of colors){let n=document.createElement('button');n.style.background=color;n.title=color;n.setAttribute('aria-label','颜色 '+color);n.onclick=()=>mutate(s=>s.color=color);$('swatches').appendChild(n)}for(let axis of ['Width','Height'])$('shape'+axis).onchange=()=>mutate(s=>{let b=bounds(s),v=Math.max(.1,Math.min(10000,+$('shape'+axis).value||1));if(s.type==='stairs'){sizeStair(s,axis,v);return}s.points=s.points.map(p=>({x:axis==='Width'||s.type==='circle'?b.x+(p.x-b.x)*v/Math.max(.01,b.w):p.x,y:axis==='Height'||s.type==='circle'?b.y+(p.y-b.y)*v/Math.max(.01,b.h):p.y}));});$('rotation').onchange=()=>mutate(s=>rotateShapeTo(s,$('rotation').value));$('rotateLeft').onclick=()=>mutate(s=>rotateShapeTo(s,(s.rotation||0)-15));$('rotateRight').onclick=()=>mutate(s=>rotateShapeTo(s,(s.rotation||0)+15));$('editVertices').onclick=()=>setTool('vertex');
$('stairSteps').onchange=()=>mutate(s=>s.stairSteps=Math.max(2,Math.min(64,Math.round(+$('stairSteps').value)||12)));$('stairFloors').onchange=()=>mutate(s=>s.stairFloors=Math.max(1,Math.min(100,Math.round(+$('stairFloors').value)||1)));$('stairReverse').onchange=()=>mutate(s=>s.stairReverse=$('stairReverse').value==='reverse');
function remove(){if(!shape()||layer(shape()).locked)return;checkpoint();state.layers=state.layers.filter(l=>l.id!==shape().layer);state.shapes=state.shapes.filter(s=>s.id!==selected);selected=null;activeLayer=null;refresh()}$('deleteShape').onclick=remove;
function undo(redo=false){let from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(clone(state));state=from.pop();selected=null;activeLayer=null;if(!state.floors.includes(floor))floor=state.floors[0];$('projectName').value=state.name;panels();properties();render()}$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);$('projectName').onchange=()=>{checkpoint();state.name=$('projectName').value||'未命名关卡'};
function onEditorKeyDown(e){
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||e.isComposing)return;
 if(e.key==='Escape'&&cancelCopyDrag()){e.preventDefault();return}
 const key=e.key.toLowerCase();
 if(e.ctrlKey||e.metaKey){
 if(drag)return;
 if(key==='c'){if(copySelected())e.preventDefault();return}
 if(key==='v'){if(pasteObject())e.preventDefault();return}
 if(key==='z'){e.preventDefault();undo(e.shiftKey);return}
 return;
 }
 if(e.code==='Space'){space=true;e.preventDefault()}
 if(e.key==='Delete'||e.key==='Backspace'){if(drag)return;e.preventDefault();remove()}
 if(e.key==='Escape'){selected=null;setTool('select');properties()}
 const t={v:'select',r:'rect',c:'circle',a:'arrow',s:'stairs',e:'vertex',h:'pan'}[key];if(t&&!e.altKey&&!drag)setTool(t);
}
window.addEventListener('keydown',onEditorKeyDown);window.addEventListener('keyup',e=>{if(e.code==='Space')space=false});window.addEventListener('blur',()=>{space=false;layerDrag=null;if(!cancelCopyDrag())drag=null});
svg.addEventListener('dragover',e=>{if(view==='2'&&layerDrag&&layerDropCopies(e)){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
svg.addEventListener('drop',e=>{
 const from=layerDropSource(e),copying=layerDropCopies(e);layerDrag=null;
 if(view!=='2'||!from||from.locked||!copying)return;e.preventDefault();
 if(!floorVisible(state,floor)){toast('请先显示当前楼层再拖入副本');return}
 const source=state.shapes.find(s=>s.layer===from.id);if(!source)return;
 const p=world(e),c=rotationCenter(source),offset=quant({x:p.x-c.x,y:p.y-c.y});checkpoint();selectObject(copyObject(source,from,{targetFloor:floor,offset}));svg.focus({preventScroll:true});
});
$('export').onclick=()=>{let blob=new Blob([JSON.stringify({format:'level-studio',version:2,...state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(state.name||'关卡')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('关卡已导出，包含图形和楼层信息')};$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{let file=$('file').files[0];if(!file)return;try{if(file.size>5e6)throw Error();let next=normalizeLevel(JSON.parse(await file.text()));checkpoint();state=next;selected=null;activeLayer=null;floor=state.floors[0];$('projectName').value=state.name;refresh();$('fit').click();toast('关卡已导入，每个体块均为独立图层')}catch{toast('无法导入：请选择有效的关卡 JSON 文件')}finally{$('file').value=''}};

new ResizeObserver(render).observe(svg);panels();properties();render();
