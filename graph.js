var COM_LABELS={0:"Diffusion & Signal",1:"Gen Model Training",2:"Medical Image Gen",3:"Dev Tools",4:"Wavelet & Quality",5:"Paper Workflow",6:"Brain Parcellation",7:"Infrastructure",8:"Rectified Flow",9:"Image Post-Proc",10:"Early Diagnosis",11:"Cortical Pipeline",12:"LaTeX & Submission",13:"Deep Learning",14:"Self-Supervised 3D"};
var COLORS=["#f72585","#b5179e","#7209b7","#3a0ca3","#4361ee","#4cc9f0","#06d6a0","#fb5607","#ff006e","#8338ec","#3a86ff","#80ed99","#f77f00","#e36414","#9b5de5","#00bbf9","#00f5d4","#fee440","#d90368","#0ead69"];
function c(n){return COLORS[n%COLORS.length];}

fetch("graph.json").then(function(r){return r.json()}).then(function(raw){
  var gd={nodes:[],links:[]};
  raw.nodes.forEach(function(n){gd.nodes.push({id:n.id,name:n.label||n.id.replace(/_/g," "),group:n.community!=null?n.community:0,val:n.file_type==="document"?12:(n.val||3),type:n.file_type||"concept"})});
  (raw.links||[]).forEach(function(l){gd.links.push({source:l.source,target:l.target,value:l.weight||1})});

  var shown={},leg=document.getElementById("legend");
  gd.nodes.forEach(function(n){if(n.type==="document"&&!shown[n.group]){shown[n.group]=true;var d=document.createElement("div");d.className="legend-item";d.innerHTML='<span class="legend-dot" style="background:'+c(n.group)+'"></span> '+(COM_LABELS[n.group]||"C"+n.group);leg.appendChild(d)}});

  var graph=ForceGraph3D({controlType:"orbit"})(document.getElementById("graph-container"))
    .graphData(gd).nodeId("id")
    .nodeColor(function(n){return c(n.group)}).nodeVal("val")
    .nodeThreeObject(function(n){
      var isDoc=n.type==="document";var sz=isDoc?8:3;
      var sph=new THREE.Mesh(new THREE.SphereGeometry(sz,isDoc?24:16),new THREE.MeshStandardMaterial({color:new THREE.Color(c(n.group)),metalness:isDoc?.5:.2,roughness:isDoc?.3:.5,emissive:new THREE.Color(c(n.group)),emissiveIntensity:isDoc?.15:.05,transparent:true,opacity:isDoc?1:.75}));
      if(isDoc){var ring=new THREE.Mesh(new THREE.RingGeometry(sz*1.6,sz*1.8,32),new THREE.MeshBasicMaterial({color:new THREE.Color(c(n.group)),transparent:true,opacity:.2,side:THREE.DoubleSide}));ring.position.z=.1;sph.add(ring)}
      return sph;
    })
    .linkColor(function(l){var g=(l.source&&l.source.group!=null)?l.source.group:0;var cl=new THREE.Color(c(g));cl.multiplyScalar(.7);return cl})
    .linkOpacity(.2).linkWidth(function(l){return Math.min(l.value||1,2)})
    .backgroundColor("#0a0a0f").showNavInfo(false).enableNodeDrag(false)
    .onNodeClick(function(n){graph.centerAt(n.x,n.y,400);graph.zoom(3,400)})
    .onNodeHover(function(n){
      var t=document.getElementById("tooltip");
      if(n){t.querySelector(".tt-title").textContent=n.name;t.querySelector(".tt-type").textContent=n.type==="document"?"Knowledge Unit":"Concept";t.querySelector(".tt-community").textContent=COM_LABELS[n.group]||"Community "+n.group;t.classList.add("visible")}else{t.classList.remove("visible")}
    })
    .d3AlphaDecay(.02).d3VelocityDecay(.3);

  graph.autoRotate=true;window.GR=graph;
  var ang=0;setInterval(function(){if(graph.autoRotate){ang+=.003;var c=graph.cameraPosition();var r=Math.sqrt(c.x*c.x+c.z*c.z);graph.cameraPosition({x:r*Math.sin(ang),y:c.y,z:r*Math.cos(ang)},{x:0,y:0,z:0})}},20);

  var rt,ce=document.getElementById("graph-container");
  ce.addEventListener("mousedown",function(){graph.autoRotate=false;btn.textContent="Stop";clearTimeout(rt)});
  ce.addEventListener("mouseup",function(){rt=setTimeout(function(){graph.autoRotate=true;btn.textContent="Auto-rotate"},3000)});
  ce.addEventListener("wheel",function(){graph.autoRotate=false;btn.textContent="Stop";clearTimeout(rt);rt=setTimeout(function(){graph.autoRotate=true;btn.textContent="Auto-rotate"},3000)});
  ce.addEventListener("mousemove",function(e){var t=document.getElementById("tooltip");t.style.left=(e.clientX+16)+"px";t.style.top=(e.clientY+16)+"px"});

  var btn=document.getElementById("btn-auto");
  btn.onclick=function(){graph.autoRotate=!graph.autoRotate;this.textContent=graph.autoRotate?"Auto-rotate":"Stop"};

  document.getElementById("search-box").oninput=function(){
    var q=this.value;if(!q){graph.nodeColor(function(n){return c(n.group)}).nodeVal("val");graph.zoomToFit(400);return}
    var ql=q.toLowerCase(),match={};gd.nodes.forEach(function(n){if(n.name.toLowerCase().indexOf(ql)>=0)match[n.id]=true});
    graph.nodeColor(function(n){return match[n.id]?c(n.group):"rgba(60,50,80,.3)"}).nodeVal(function(n){return match[n.id]?(n.type==="document"?18:6):1});
    for(var i=0;i<gd.nodes.length;i++){var f=gd.nodes[i];if(match[f.id]){graph.centerAt(f.x||0,f.y||0,600);graph.zoom(2.5,600);break}}
  };

  document.getElementById("loading").classList.add("hidden");
  setTimeout(function(){graph.zoomToFit(600,50)},100);
  window.addEventListener("resize",function(){setTimeout(function(){graph.width(window.innerWidth).height(window.innerHeight)},100)});
}).catch(function(err){document.getElementById("loading").innerHTML="<div style='color:#f72585'>Error: "+err.message+"</div>";console.error("Graph:",err)});
