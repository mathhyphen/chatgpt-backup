function c(n){var h=((Number(n)||0)*137.508)%360;return "hsl("+h.toFixed(1)+",82%,62%)";}

setTimeout(function(){var d=document.getElementById("loading");if(d&&d.className.indexOf("hidden")<0){d.innerHTML="<div style=color:#f72585>加载超时 - <a href=graph.html style=color:#4cc9f0>重试</a></div>"}},12000);
fetch("graph.json").then(function(r){return r.json()}).then(function(raw){
  var GROUPS=raw.groups||{};
  var gd={nodes:[],links:[]};
  raw.nodes.forEach(function(n){
    var t=n.type||"concept";
    gd.nodes.push({id:n.id,name:n.label||n.name||n.id.replace(/_/g," "),
      group:n.community!=null?n.community:(n.group!=null?n.group:0),
      degree:n.degree||0,val:t==="document"?12:(n.val||3),
      tags:n.tags||[],summary:n.summary||"",type:t});
  });
  (raw.links||[]).forEach(function(l){gd.links.push({source:l.source,target:l.target,type:l.type||"tag",value:l.weight||l.value||1})});

  var nodeById={};
  gd.nodes.forEach(function(n){nodeById[n.id]=n});
  function sid(v){return typeof v==="object"?v.id:v}
  function glabel(g){return GROUPS[g]||("社区 "+g)}
  function radius(n){return n.type==="document"?1.7+Math.sqrt(n.degree||1)*1.25:0.9+Math.sqrt(n.degree||1)*0.7}

  // ---- 自定义节点渲染:球体 + 文档节点带文字标签 ----
  function makeObj(n){
    var g=new THREE.Group();
    var r=radius(n);
    var mesh=new THREE.Mesh(new THREE.SphereGeometry(r,18,18),
      new THREE.MeshLambertMaterial({color:new THREE.Color(c(n.group)),transparent:true,opacity:.96}));
    g.add(mesh);n.__mesh=mesh;
    if(n.type==="document"&&typeof SpriteText!=="undefined"){
      var sp=new SpriteText(n.name,3.6,"#efe9ff");
      sp.center.set(.5,0);sp.position.set(0,r+1.2,0);
      sp.material.transparent=true;sp.material.opacity=.95;sp.material.depthWrite=false;
      g.add(sp);n.__sprite=sp;
    }
    return g;
  }
  function setOpacity(n,o){if(n.__mesh)n.__mesh.material.opacity=o;if(n.__sprite)n.__sprite.material.opacity=o}

  // ---- 状态与聚焦 ----
  var focusedId=null,focusedGroup=null;
  function linkGroup(l){var a=nodeById[sid(l.source)];return a?a.group:0}
  function styleLink(l){
    var a=nodeById[sid(l.source)],b=nodeById[sid(l.target)];
    var inFocus=focusedGroup==null||(a&&b&&a.group===focusedGroup&&b.group===focusedGroup);
    if(!inFocus)return{color:"rgba(80,76,100,.10)",width:.25,opacity:.06};
    if(l.type==="related")return{color:"#e8dbff",width:2.2,opacity:.9};
    if(l.type==="shared-tag")return{color:c(linkGroup(l)),width:1.1,opacity:.45};
    return{color:c(linkGroup(l)),width:.55,opacity:.22};
  }
  function applyStyles(){
    gd.nodes.forEach(function(n){
      var on=focusedGroup==null||n.group===focusedGroup;
      setOpacity(n,on?(n.type==="document"?.96:.85):.12);
    });
    graph.linkColor(function(l){return styleLink(l).color})
         .linkWidth(function(l){return styleLink(l).width})
         .linkOpacity(function(l){return styleLink(l).opacity});
  }
  function updateLegend(){
    leg.querySelectorAll(".legend-item").forEach(function(it){
      var g=it.getAttribute("data-group"),id=it.getAttribute("data-node");
      if(g!=null)it.classList.toggle("active",focusedGroup!=null&&Number(g)===focusedGroup);
      if(id!=null)it.classList.toggle("active",focusedId===id);
    });
  }
  function resetFocus(){focusedId=null;focusedGroup=null;updateLegend();applyStyles();graph.zoomToFit(600,80)}
  function focusGroup(g){
    if(focusedGroup===g){resetFocus();return}
    focusedGroup=g;focusedId=null;updateLegend();applyStyles();
    var ms=gd.nodes.filter(function(n){return n.group===g});
    if(ms.length){var cx=0,cy=0,cz=0;ms.forEach(function(n){cx+=n.x||0;cy+=n.y||0;cz+=n.z||0});
      graph.centerAt(cx/ms.length,cy/ms.length,cz/ms.length,700);graph.zoom(2.0,700)}
    graph.autoRotate=false;btn.textContent="停止";
  }
  function focusNode(id){
    var n=nodeById[id];if(!n)return;
    if(focusedId===id){resetFocus();return}
    focusedId=id;focusedGroup=n.group;updateLegend();applyStyles();
    graph.centerAt(n.x||0,n.y||0,700);graph.zoom(2.6,700);
    graph.autoRotate=false;btn.textContent="停止";
  }

  // ---- 图例:统计 + 社区 + 知识单元 ----
  var leg=document.getElementById("legend");
  var docs=gd.nodes.filter(function(n){return n.type==="document"});
  var cons=gd.nodes.filter(function(n){return n.type!=="document"});
  var comms={};docs.forEach(function(n){(comms[n.group]=comms[n.group]||[]).push(n)});
  var gids=Object.keys(comms).map(Number).sort(function(a,b){return comms[b].length-comms[a].length});
  var html='<div class="legend-title">🧠 知识图谱</div>'
    +'<div id="stats">'+docs.length+" 知识单元 · "+cons.length+" 概念 · "+gd.links.length+" 关系 · "+gids.length+" 社区</div>"
    +'<div class="legend-section">社区</div>';
  leg.innerHTML=html;
  gids.forEach(function(g){
    var d=document.createElement("div");d.className="legend-item";d.setAttribute("data-group",g);
    d.innerHTML='<span class="legend-dot" style="background:'+c(g)+'"></span><span>'+glabel(g)+'</span><span class="cnt">'+comms[g].length+"</span>";
    d.onclick=function(){focusGroup(g)};leg.appendChild(d);
  });
  var sec=document.createElement("div");sec.className="legend-section";sec.textContent="知识单元";leg.appendChild(sec);
  docs.sort(function(a,b){return a.name.localeCompare(b.name,"zh-Hans-CN")}).forEach(function(n){
    var d=document.createElement("div");d.className="legend-item";d.setAttribute("data-node",n.id);
    d.innerHTML='<span class="legend-dot" style="background:'+c(n.group)+'"></span><span>'+n.name+"</span>";
    d.onclick=function(){focusNode(n.id)};leg.appendChild(d);
  });

  // ---- 图 ----
  var graph=ForceGraph3D({controlType:"orbit"})(document.getElementById("graph-container"))
    .graphData(gd).nodeId("id")
    .nodeThreeObject(function(n){return makeObj(n)})
    .linkColor(function(l){return styleLink(l).color})
    .linkOpacity(function(l){return styleLink(l).opacity})
    .linkWidth(function(l){return styleLink(l).width})
    .backgroundColor("#0a0a0f").showNavInfo(false).enableNodeDrag(false).width(window.innerWidth).height(window.innerHeight)
    .onNodeClick(function(n){focusNode(n.id)})
    .onNodeHover(function(n){
      var t=document.getElementById("tooltip");
      if(n){
        t.querySelector(".tt-title").textContent=n.name;
        t.querySelector(".tt-type").textContent=n.type==="document"?"知识单元":"概念节点";
        t.querySelector(".tt-community").textContent=glabel(n.group);
        var tg=t.querySelector(".tt-tags");
        tg.innerHTML="";(n.tags||[]).slice(0,8).forEach(function(x){var s=document.createElement("span");s.className="tt-tag";s.textContent=x;tg.appendChild(s)});
        t.querySelector(".tt-summary").textContent=n.summary||"";
        t.classList.add("visible");
      }else{t.classList.remove("visible")}
    })
    .d3AlphaDecay(.02).d3VelocityDecay(.3);

  graph.autoRotate=true;window.GR=graph;
  var ang=0;setInterval(function(){if(graph.autoRotate){ang+=.003;var p=graph.cameraPosition();var r=Math.sqrt(p.x*p.x+p.z*p.z);graph.cameraPosition({x:r*Math.sin(ang),y:p.y,z:r*Math.cos(ang)},{x:0,y:0,z:0})}},20);

  var rt,ce=document.getElementById("graph-container");
  ce.addEventListener("mousedown",function(){graph.autoRotate=false;btn.textContent="停止";clearTimeout(rt)});
  ce.addEventListener("mouseup",function(){rt=setTimeout(function(){graph.autoRotate=true;btn.textContent="自动旋转"},3000)});
  ce.addEventListener("wheel",function(){graph.autoRotate=false;btn.textContent="停止";clearTimeout(rt);rt=setTimeout(function(){graph.autoRotate=true;btn.textContent="自动旋转"},3000)});
  ce.addEventListener("mousemove",function(e){var t=document.getElementById("tooltip");t.style.left=(e.clientX+16)+"px";t.style.top=(e.clientY+16)+"px"});

  var btn=document.getElementById("btn-auto");
  btn.onclick=function(){graph.autoRotate=!graph.autoRotate;this.textContent=graph.autoRotate?"自动旋转":"停止"};

  var searchBox=document.getElementById("search-box");
  function doSearch(q){
    if(!q){resetFocus();return[]}
    var ql=q.toLowerCase(),match={};
    gd.nodes.forEach(function(n){if(n.name.toLowerCase().indexOf(ql)>=0)match[n.id]=true});
    gd.nodes.forEach(function(n){setOpacity(n,match[n.id]?.98:.08)});
    return gd.nodes.filter(function(n){return match[n.id]});
  }
  searchBox.oninput=function(){doSearch(this.value)};
  searchBox.onkeydown=function(e){
    if(e.key!=="Enter")return;
    var ms=doSearch(this.value);
    if(ms.length){var f=ms[0];focusedId=f.id;focusedGroup=f.group;updateLegend();applyStyles();graph.centerAt(f.x||0,f.y||0,600);graph.zoom(2.5,600)}
  };
  searchBox.addEventListener("keydown",function(e){if(e.key==="Escape"){searchBox.value="";resetFocus()}});

  document.getElementById("loading").classList.add("hidden");
  graph.cameraPosition({x:0,y:0,z:520},{x:0,y:0,z:0},0);
  setTimeout(function(){graph.zoomToFit(600,80)},500);
  setTimeout(function(){graph.zoomToFit(600,80)},1800);
  setTimeout(function(){graph.zoomToFit(600,80)},3500);
  graph.onEngineStop(function(){graph.zoomToFit(600,80)});
  window.addEventListener("resize",function(){setTimeout(function(){graph.width(window.innerWidth).height(window.innerHeight);graph.zoomToFit(400,80)},100)});
}).catch(function(err){
  var el=document.getElementById("loading");
  if(el){el.innerHTML="<div style='color:#f72585;font-size:14px;padding:20px;text-align:left;max-width:500px'><b>图谱加载出错</b><br>"+err.message+"<br><br><i>按 F12 查看控制台详情</i><br><br><a href='graph.html' style='color:#4cc9f0'>重试</a> | <a href='index.html' style='color:#4cc9f0'>返回</a></div>";}
  console.error("Graph error:",err);
});
