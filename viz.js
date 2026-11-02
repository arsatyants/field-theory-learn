(function(){
function getCanvas(id){ return document.getElementById(id); }
function sizeCanvas(cv){
  if (!cv) return null;
  var rect = cv.getBoundingClientRect();
  cv.width = Math.max(320, Math.floor(rect.width * window.devicePixelRatio || 1));
  cv.height = Math.floor(cv.width * 0.56);
  return cv.getContext('2d');
}

function grid(w,h,ctx,fn,colorFn,levels){
  ctx.clearRect(0,0,w,h);
  var sx=w/40, sy=h/40;
  // heatmap
  for(var y=0;y<h;y+=2){
    for(var x=0;x<w;x+=2){
      var u=(x-w/2)/(w/4), v=(h/2-y)/(h/4);
      var val=fn(u,v);
      ctx.fillStyle=colorFn(val);
      ctx.fillRect(x,y,2,2);
    }
  }
  // contour lines
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1;
  if(levels){
    levels.forEach(function(L){
      ctx.beginPath();
      for(var y=0;y<h;y+=2){
        for(var x=0;x<w;x+=2){
          var u=(x-w/2)/(w/4), v=(h/2-y)/(h/4);
          var f0=fn(u,v), f1=fn(u+0.05,v), f2=fn(u,v-0.05);
          if((f0-L)*(f1-L)<0){ ctx.moveTo(x+1,y); ctx.lineTo(x+1,y+2); }
          if((f0-L)*(f2-L)<0){ ctx.moveTo(x,y+1); ctx.lineTo(x+2,y+1); }
        }
      }
      ctx.stroke();
      if (L===1.5){
        ctx.strokeStyle='rgba(247,201,72,0.6)';
        ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.25)';
      }
    });
  }
}

function colorBowl(v){ var t=Math.max(-1,Math.min(1,v)); var r=Math.floor(20+t*60), g=Math.floor(20+t*120), b=Math.floor(40-t*60); return 'rgb('+r+','+g+','+b+')'; }
function colorHill(v){ var t=Math.max(-1,Math.min(1,v)); var r=Math.floor(20+t*120), g=Math.floor(20+t*180), b=Math.floor(40+t*40); return 'rgb('+r+','+g+','+b+')'; }

function drawScalarMap(cv, type){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  var fn = type==='bowl' ? function(u,v){return u*u+v*v-1;} :
           type==='saddle' ? function(u,v){return u*u-v*v;} :
           function(u,v){return 0.7*u+0.5*v;};
  var cf = type==='bowl' ? colorBowl : (type==='saddle'?function(v){var t=Math.max(-1,Math.min(1,v));return 'rgb('+(80+t*120)+','+(40)+','+(80-t*60)+')';}:function(v){var t=Math.max(-1,Math.min(1,v));return 'rgb('+(40+t*80)+','+(60+t*100)+','+(80+t*60)+')';});
  grid(w,h,ctx,fn,cf,[-0.8,-0.4,0,0.4,0.8,1.5]);
}

function drawGradField(cv, type){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  drawScalarMap(cv, type);
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); for(var i=1;i<10;i++){var x=i*w/10; ctx.moveTo(x,0); ctx.lineTo(x,h);} for(var i=1;i<10;i++){var y=i*h/10; ctx.moveTo(0,y); ctx.lineTo(w,y);} ctx.stroke();
  var fx=type==='bowl'?function(u,v){return [2*u,2*v];}:type==='saddle'?function(u,v){return [2*u,-2*v];}:function(u,v){return [0.7,0.5];};
  for(var gy=1;gy<10;gy+=1.2){
    for(var gx=1;gx<10;gx+=1.2){
      var x=gx*w/10, y=gy*h/10;
      var u=(x-w/2)/(w/4), v=(h/2-y)/(h/4);
      var g=fx(u,v);
      var len=Math.sqrt(g[0]*g[0]+g[1]*g[1]);
      if(len<0.05) continue;
      var scl=12/len;
      ctx.strokeStyle='#3ecf8e'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+g[0]*scl, y-g[1]*scl); ctx.stroke();
      ctx.fillStyle='#3ecf8e'; ctx.beginPath(); ctx.arc(x+g[0]*scl, y-g[1]*scl, 2,0,Math.PI*2); ctx.fill();
    }
  }
}

function arrow(ctx,x,y,ux,uy,color){
  var len=Math.sqrt(ux*ux+uy*uy); if(len<0.001) return;
  ux/=len; uy/=len;
  ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+ux*len, y-uy*len); ctx.stroke();
  ctx.fillStyle=color; ctx.beginPath();
  ctx.arc(x+ux*len, y-uy*len, 2.5,0,Math.PI*2); ctx.fill();
}

function drawPartialSlice(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  var P={x:w*0.55, y:h*0.45};
  // heatmap f=x^2*y
  for(var y=0;y<h;y+=2)for(var x=0;x<w;x+=2){var u=(x-w/2)/(w/5), v=(h/2-y)/(h/5); var f=Math.max(0,Math.min(1,(u*u*v+1)/2)); ctx.fillStyle='rgb('+(20+f*80)+','+(20+f*120)+','+(40+f*80)+')'; ctx.fillRect(x,y,2,2);}
  // slices
  ctx.strokeStyle='rgba(247,201,72,0.7)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,P.y); ctx.lineTo(w,P.y); ctx.stroke();
  ctx.strokeStyle='rgba(232,112,180,0.7)'; ctx.beginPath(); ctx.moveTo(P.x,0); ctx.lineTo(P.x,h); ctx.stroke();
  // point
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(P.x,P.y,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='12px JetBrains Mono,monospace'; ctx.fillText('P', P.x+8, P.y-8);
}

function drawSteepest(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  drawScalarMap(cv, 'bowl');
  var P={x:w*0.55, y:h*0.55};
  var u=(P.x-w/2)/(w/4), v=(h/2-P.y)/(h/4);
  var gx=2*u, gy=2*v;
  arrow(ctx,P.x,P.y,gx,gy,'#3ecf8e');
  arrow(ctx,P.x,P.y,-gx,-gy,'#f76e6e');
  // tangent to level line (perp to grad)
  var tx=-gy, ty=gx, tl=Math.sqrt(tx*tx+ty*ty); tx*=40/tl; ty*=40/tl;
  ctx.strokeStyle='rgba(247,201,72,0.8)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(P.x-tx,P.y+ty); ctx.lineTo(P.x+tx,P.y-ty); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(P.x,P.y,4,0,Math.PI*2); ctx.fill();
}

function drawDirectional(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  var cx=w/2, cy=h/2, R=Math.min(w,h)*0.28;
  // circle
  ctx.strokeStyle='rgba(139,124,248,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
  // grad arrow
  var ang=Math.PI/6, gx=Math.cos(ang)*R, gy=Math.sin(ang)*R;
  arrow(ctx,cx,cy,gx,-gy,'#3ecf8e');
  // direction e
  var eang=-Math.PI/4, ex=Math.cos(eang)*R, ey=Math.sin(eang)*R;
  arrow(ctx,cx,cy,ex,-ey,'#f7c948');
  // projection
  var proj=gx*ex+gy*ey;
  ctx.strokeStyle='rgba(62,142,247,0.9)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+proj*ex/R, cy-proj*ey/R); ctx.stroke();
  if(proj<0){
    ctx.strokeStyle='rgba(247,110,110,0.9)'; ctx.beginPath(); ctx.moveTo(cx+proj*ex/R, cy-proj*ey/R); ctx.lineTo(cx,cy); ctx.stroke();
  }
  ctx.fillStyle='#7a7f9a'; ctx.font='12px JetBrains Mono,monospace'; ctx.fillText('∂f/∂e', cx+10, cy+20);
}

// 02 divergence
function drawVField(cv, type){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  var fx=type==='source'?function(x,y){return [(x-w/2)*0.02,(y-h/2)*0.02];}:
         type==='sink'?function(x,y){return [-(x-w/2)*0.02,-(y-h/2)*0.02];}:
         type==='saddle'?function(x,y){return [0.03*(x-w/2),-0.03*(y-h/2)];}:
         function(x,y){return [0.015*(h/2-y),0.015*(x-w/2)];};
  for(var gy=30;gy<h;gy+=45){
    for(var gx=30;gx<w;gx+=45){
      var v=fx(gx,gy); arrow(ctx,gx,gy,v[0]*3,-v[1]*3, type==='source'?'#3ecf8e':(type==='sink'?'#f76e6e':'#3e8ef7'));
    }
  }
}
function drawDivBox(cv){ drawVField(cv,'source'); }
function drawParticles(cv){ drawVField(cv,'source'); ctx=cv.getContext('2d'); ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='12px JetBrains Mono'; ctx.fillText('частицы разлетаются из центра', 20, cv.height-20); }
function drawDivHeat(cv){ drawVField(cv,'source'); }
function drawSolenoidal(cv){ drawVField(cv,'rot'); }

// 03 curl
function drawPaddle(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  // circular flow
  for(var a=0;a<Math.PI*2;a+=Math.PI/8){
    var x=w/2+Math.cos(a)*w*0.35, y=h/2-Math.sin(a)*h*0.35;
    arrow(ctx, x, y, -Math.sin(a)*25, -Math.cos(a)*25, '#f7c948');
  }
  // paddle wheel
  ctx.strokeStyle='#eceef5'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(w/2,h/2,18,0,Math.PI*2); ctx.stroke();
  for(var a=0;a<Math.PI*2;a+=Math.PI/4){
    ctx.beginPath(); ctx.moveTo(w/2,h/2); ctx.lineTo(w/2+Math.cos(a)*30, h/2-Math.sin(a)*30); ctx.stroke();
  }
  // curl axis
  arrow(ctx,w/2,h/2,0,-h*0.35,'#f7c948');
}
function drawRighthand(cv){ drawPaddle(cv); }
function drawCirculation(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(247,201,72,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(w/2,h/2,w*0.3,0,Math.PI*2); ctx.stroke();
  for(var a=0;a<Math.PI*2;a+=Math.PI/6){
    var x=w/2+Math.cos(a)*w*0.3, y=h/2-Math.sin(a)*h*0.3;
    arrow(ctx,x,y,-Math.sin(a)*20,-Math.cos(a)*20,'#f7c948');
  }
}
function drawIrrot(cv){ drawCirculation(cv); }

// 04 flux
function drawScalarFlux(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  drawScalarMap(cv,'bowl');
  // surface patch
  ctx.strokeStyle='#3e8ef7'; ctx.lineWidth=2; ctx.strokeRect(w*0.35,h*0.35,w*0.3,h*0.25);
  ctx.fillStyle='rgba(62,142,247,0.15)'; ctx.fillRect(w*0.35,h*0.35,w*0.3,h*0.25);
}
function drawFluxAngle(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#3e8ef7'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(w*0.2,h*0.7); ctx.lineTo(w*0.8,h*0.7); ctx.lineTo(w*0.9,h*0.5); ctx.stroke();
  ctx.fillStyle='rgba(62,142,247,0.12)'; ctx.beginPath(); ctx.moveTo(w*0.2,h*0.7); ctx.lineTo(w*0.8,h*0.7); ctx.lineTo(w*0.9,h*0.5); ctx.fill();
  arrow(ctx,w*0.55,h*0.55,60,-30,'#f7c948');
  arrow(ctx,w*0.55,h*0.55,0,-40,'#eceef5');
}
function drawMobius(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(232,112,180,0.8)'; ctx.lineWidth=2;
  ctx.beginPath(); for(var t=0;t<Math.PI*2;t+=0.05){var x=w/2+Math.cos(t)*w*0.3+Math.cos(2*t)*w*0.08; var y=h/2-Math.sin(t)*h*0.3; ctx.lineTo(x,y);} ctx.stroke();
  ctx.fillStyle='#7a7f9a'; ctx.font='12px JetBrains Mono'; ctx.fillText('Лента Мёбиуса: неориентируемая', 20, h-20);
}
function drawClosedFlux(cv){ drawFluxAngle(cv); }

// 05 gauss
function drawGaussCells(cv){
  var ctx=cv.getContext('2d'); var w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#3ecf8e'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(w/2,h/2,w*0.3,0,Math.PI*2); ctx.stroke();
  for(var a=0;a<Math.PI*2;a+=Math.PI/8){
    var x=w/2+Math.cos(a)*w*0.3, y=h/2-Math.sin(a)*h*0.3;
    arrow(ctx,x,y,Math.cos(a)*25,-Math.sin(a)*25,'#3ecf8e');
  }
}
function drawGaussSphere(cv){ drawGaussCells(cv); }
function drawGaussDrag(cv){ drawGaussCells(cv); }

// dispatch
var renderers={
  'fig-scalar-map':function(cv){drawScalarMap(cv,'bowl');},
  'fig-grad-field':function(cv){drawGradField(cv,'bowl');},
  'fig-partial-slice':drawPartialSlice,
  'fig-steepest':drawSteepest,
  'fig-directional':drawDirectional,
  'fig-vfields':function(cv){drawVField(cv,'source');},
  'fig-div-box':function(cv){drawVField(cv,'source');},
  'fig-particles':function(cv){drawVField(cv,'source'); cv.getContext('2d').fillStyle='rgba(255,255,255,0.7)'; cv.getContext('2d').font='12px JetBrains Mono'; cv.getContext('2d').fillText('particles diverge from centre',20,cv.height-20);},
  'fig-div-heat':function(cv){drawVField(cv,'source');},
  'fig-solenoidal':function(cv){drawVField(cv,'rot');},
  'fig-paddle':drawPaddle,
  'fig-righthand':drawRighthand,
  'fig-circulation':drawCirculation,
  'fig-irrot':drawIrrot,
  'fig-scalar-flux':drawScalarFlux,
  'fig-flux-angle':drawFluxAngle,
  'fig-mobius':drawMobius,
  'fig-closed-flux':drawClosedFlux,
  'fig-gauss-cells':drawGaussCells,
  'fig-gauss-sphere':drawGaussSphere,
  'fig-gauss-drag':drawGaussDrag
};

function renderAll(){
  Object.keys(renderers).forEach(function(id){
    var cv=document.getElementById(id);
    if(!cv) return;
    sizeCanvas(cv);
    renderers[id](cv);
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', renderAll);
else renderAll();
window.addEventListener('resize', function(){ clearTimeout(window._vizT); window._vizT=setTimeout(renderAll,200); });
})();
