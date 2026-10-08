(()=>{
const D=JSON.parse(document.getElementById('data').textContent), G=JSON.parse(document.getElementById('geo').textContent);
const K=7,T=24,NS='http://www.w3.org/2000/svg',$=s=>document.querySelector(s);
const NAMES=['Столичное ядро','Дальний Восток и Север','Промышленные центры роста','Северные и уральские города','Автомобильная периферия','Малые города центра','Аграрная периферия'];
const DESC=['Москва, Санкт-Петербург и ближайшие города. Самые высокие траты, меньше всего уходит на еду, больше всего — на кафе и рестораны.',
'Якутия, Сахалин, Камчатка, Чукотка и другие дальние территории. Высокие траты, но самые резкие сезонные колебания и самая низкая доля маркетплейсов.',
'Крупные городские округа с быстро растущими расходами: нефтегазовый Север, промышленные города Урала и Подмосковья.',
'Города Мурманской области, Карелии, Свердловской области и Ханты-Мансийска. Средне-высокие траты, заметная доля маркетплейсов.',
'Преимущественно сельские районы с самой высокой долей транспорта среди типов с низкими тратами и редкими кафе.',
'Малые города и районы Центральной России и Поволжья: почти половина трат на еду, маркетплейсы растут быстрее среднего.',
'Аграрные районы Алтая, Саратовской, Волгоградской, Тамбовской областей. Самые низкие траты, больше всего уходит на еду и маркетплейсы.'];
const CATS=[['food','Продукты'],['health','Здоровье'],['cater','Кафе и рестораны'],['transp','Транспорт'],['mkt','Маркетплейсы'],['other','Прочее']];
const CATCOL=['#5B6B7A','#9AA7B3','#D6334F','#E6A300','#0A93B0','#C6D2DB'];
const MN=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const ML=D.months.map(m=>MN[+m.slice(5)-1]+' '+m.slice(0,4));
const fmt=(x,d=0)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}).format(x);
const pct=(x,d=0)=>fmt(x,d)+'%';
let COL=[];const cv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const refreshCol=()=>{COL=[...Array(K).keys()].map(k=>cv('--t'+k))};refreshCol();
const byId={};D.mo.forEach(m=>byId[m.id]=m);
const st={layer:'type',mi:23,filter:null,sel:null,play:null};
const TRN={stable:'Устойчивая',border:'Пограничная',moved:'Сменила тип',partial:'Мало данных'};
function el(t,a={},h=''){const e=document.createElement(t);for(const k in a)e.setAttribute(k,a[k]);e.innerHTML=h;return e}
function sv(t,a={},h=''){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(h)e.innerHTML=h;return e}
function lerpC(stops,t){t=Math.max(0,Math.min(1,t));const n=stops.length-1,i=Math.min(n-1,Math.floor(t*n)),f=t*n-i;const a=stops[i],b=stops[i+1];
 return '#'+[0,1,2].map(j=>{const x=Math.round(parseInt(a.slice(1+2*j,3+2*j),16)*(1-f)+parseInt(b.slice(1+2*j,3+2*j),16)*f);return x.toString(16).padStart(2,'0')}).join('')}
const SEQ=['#F3E7B8','#58A9C6','#1B2A6B'], SEQ2=['#F6E3A1','#E68B3C','#8F1B3A'];

/* ---------- карта ---------- */
const svg=$('#map'),box=$('#mapbox');const g=sv('g');svg.appendChild(g);const P={};
const area=m=>{const b=G.mobox[m.id];return b?(b[2]-b[0])*(b[3]-b[1]):0};
[...D.mo].sort((a,b)=>area(b)-area(a)).forEach(m=>{const p=sv('path',{d:G.paths[m.id]});p.dataset.id=m.id;g.appendChild(p);P[m.id]=p});
const selP=sv('path',{class:'sel'});g.appendChild(selP);
const [bx0,by0,bx1,by1]=G.bbox;let vb={x:bx0,y:by0,w:bx1-bx0,h:by1-by0},home=null;
function aspect(){const r=svg.getBoundingClientRect();return r.width>0&&r.height>0?r.width/r.height:1.8}
function fitBox(b,pad=1.12){const a=aspect(),bw=b[2]-b[0],bh=b[3]-b[1];let w=Math.max(bw,bh*a)*pad,h=w/a;return {x:(b[0]+b[2])/2-w/2,y:(b[1]+b[3])/2-h/2,w,h}}
function setVB(){svg.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`)}
function goHome(){home=fitBox(G.bbox,1.04);vb={...home};setVB()}
function zoomAt(f,cx,cy){const r=svg.getBoundingClientRect();const px=(cx-r.left)/(r.width||1),py=(cy-r.top)/(r.height||1);
 const nw=Math.max(home.w/400,Math.min(home.w*1.2,vb.w*f)),nh=nw*vb.h/vb.w;vb={x:vb.x+(vb.w-nw)*px,y:vb.y+(vb.h-nh)*py,w:nw,h:nh};setVB()}
function zoomCenter(f){const r=svg.getBoundingClientRect();zoomAt(f,r.left+r.width/2,r.top+r.height/2)}
svg.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY>0?1.25:0.8,e.clientX,e.clientY)},{passive:false});
let drag=null;
svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y,moved:false};svg.setPointerCapture(e.pointerId)});
svg.addEventListener('pointermove',e=>{if(!drag){hover(e);return}const r=svg.getBoundingClientRect(),dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;if(drag.moved){vb.x=drag.vx-dx/r.width*vb.w;vb.y=drag.vy-dy/r.height*vb.h;setVB();$('#tip').style.display='none'}});
svg.addEventListener('pointerup',e=>{const d=drag;drag=null;if(d&&!d.moved){const t=document.elementFromPoint(e.clientX,e.clientY);if(t&&t.dataset&&t.dataset.id)select(+t.dataset.id,true)}});
svg.addEventListener('pointerleave',()=>{$('#tip').style.display='none'});
$('#zin').onclick=()=>zoomCenter(.7);$('#zout').onclick=()=>zoomCenter(1.4);$('#zres').onclick=()=>{goHome();$('#regsel').value=''};
Object.keys(G.regbox).sort((a,b)=>a.localeCompare(b,'ru')).forEach(r=>$('#regsel').appendChild(el('option',{value:r},r)));
$('#regsel').onchange=e=>{const v=e.target.value;if(!v){goHome();return}vb=fitBox(G.regbox[v],1.15);setVB()};
function hover(e){const t=e.target;if(!t.dataset||!t.dataset.id){$('#tip').style.display='none';return}const m=byId[t.dataset.id];
 const ty=m.L[st.mi]==='-'?null:+m.L[st.mi];const tip=$('#tip'),r=box.getBoundingClientRect();
 tip.innerHTML=`<b>${m.n}</b>${m.r}<br>${ty===null?'нет данных за месяц':`<span style="color:${COL[ty]}">●</span> ${NAMES[ty]}`}<br>${fmt(m.v[0])} ₽ на жителя в месяц`;
 tip.style.display='block';let x=e.clientX-r.left+14,y=e.clientY-r.top+14;if(x>r.width-270)x-=290;if(y>r.height-110)y-=120;tip.style.left=x+'px';tip.style.top=y+'px'}

/* ---------- слои ---------- */
const noneC=()=>cv('--none');
function colorOf(m){
 switch(st.layer){
  case'type':{const c=m.L[st.mi];return c==='-'?noneC():COL[+c]}
  case'level':return lerpC(SEQ,(m.v[1]+0.4)/1.2);
  case'traj':return {stable:COL[1],border:COL[2],moved:COL[4],partial:noneC()}[m.tr];
  case'conf':return m.cf==null?noneC():lerpC(SEQ2,1-(m.cf-0.4)/0.6);
  case'ma':return m.ma==null?noneC():lerpC(SEQ,(Math.log10(m.ma+1)-0.3)/2.7);
 }}
function paint(){
 D.mo.forEach(m=>{const p=P[m.id];p.setAttribute('fill',colorOf(m));
  const dim=st.layer==='type'&&st.filter!==null&&m.L[st.mi]!==String(st.filter);p.classList.toggle('dim',dim)});
 $('#mlabel').textContent=ML[st.mi];$('#monthbar').style.display=st.layer==='type'?'flex':'none';legend()}
function legend(){const L=$('#legend'),S=$('#scale');L.innerHTML='';S.innerHTML='';
 if(st.layer==='type'){const cnt=D.cnt[st.mi];for(let k=0;k<K;k++){const b=el('button',{class:'chip','aria-pressed':st.filter===k},`<i style="background:${COL[k]}"></i>${NAMES[k]} <small class="num">${cnt[k]}</small>`);
   b.onclick=()=>{st.filter=st.filter===k?null:k;paint()};L.appendChild(b)}
  if(st.filter!==null)L.appendChild(el('span',{class:'sub'},'Нажмите ещё раз, чтобы снять фильтр'))}
 else if(st.layer==='traj'){const c=D.trajcnt;[['stable','Устойчивая: ≥85% месяцев в одном типе',COL[1]],['border','Пограничная: тип колеблется между соседними',COL[2]],['moved','Сменила тип за период',COL[4]],['partial','Мало данных (<12 месяцев)',noneC()]].forEach(([k,t,col])=>L.appendChild(el('span',{class:'chip'},`<i style="background:${col}"></i>${t} <small class="num">${c[k]||0}</small>`)))}
 else{const cfg={level:['Траты ниже типичных','Траты выше типичных',SEQ,'Траты на жителя относительно медианной МО в тот же месяц'],conf:['Тип неуверен','Тип надёжен',[...SEQ2].reverse(),'Доля из 40 перезапусков с шумом, где МО остаётся в своём типе'],ma:['Периферия','Близко к большим рынкам',SEQ,'Индекс доступности рынков СберИндекса (0–1000, логарифмическая шкала)']}[st.layer];
  S.innerHTML=`<div class="scale"><span>${cfg[0]}</span><i style="background:linear-gradient(90deg,${cfg[2].join(',')})"></i><span>${cfg[1]}</span></div><p class="sub">${cfg[3]}</p>`}}
document.querySelectorAll('.layers button').forEach(b=>b.onclick=()=>{st.layer=b.dataset.layer;stopPlay();document.querySelectorAll('.layers button').forEach(x=>x.setAttribute('aria-pressed',x===b));paint()});
const sl=$('#mslider');sl.oninput=()=>{st.mi=+sl.value;stopPlay();paint()};
function stopPlay(){if(st.play){clearInterval(st.play);st.play=null;$('#play').textContent='▶'}}
$('#play').onclick=()=>{if(st.play){stopPlay();return}if(st.mi>=T-1){st.mi=0}$('#play').textContent='❚❚';
 st.play=setInterval(()=>{st.mi++;sl.value=st.mi;paint();if(st.mi>=T-1)stopPlay()},650)};

/* ---------- выбор территории ---------- */
const card=el('div',{class:'tip',style:'left:auto;right:56px;top:10px;pointer-events:auto;display:none'});box.appendChild(card);
function select(id,fromMap){st.sel=id;const m=byId[id];selP.setAttribute('d',G.paths[id]);
 Object.values(P).forEach(p=>p.classList.remove('sim'));m.sim.forEach(s=>P[s]&&P[s].classList.add('sim'));
 const t=m.f;card.style.display='block';card.innerHTML=`<b>${m.n}</b>${m.r}<br><span style="color:${COL[t]}">●</span> ${NAMES[t]}<br><a href="#passport" id="gop">Открыть паспорт</a>`;
 renderPass(m);if(fromMap===false){}}
/* ---------- типы ---------- */
function comps(v){return [v[2],v[3],v[4],v[5],v[6],v[7]]}
(function(){const L=$('#tlist');const rv=comps([D.russia.share_food,D.russia.share_health,D.russia.share_cater,D.russia.share_transp,D.russia.share_mkt,D.russia.share_other]);
 for(let k=0;k<K;k++){const p=D.prof[k],c=comps([0,0,p.share_food,p.share_health,p.share_cater,p.share_transp,p.share_mkt,p.share_other]);
  const bar=a=>`<div class="stack">${a.map((x,i)=>`<span style="width:${x}%;background:${CATCOL[i]}" title="${CATS[i][1]} ${fmt(x,1)}%"></span>`).join('')}</div>`;
  const lv=(Math.exp(p.level_log)-1)*100,ctx=p.ctx;
  const row=el('div',{class:'trow',id:'type'+k},`
   <div><div class="tmark" style="background:${COL[k]}">${k+1}</div></div>
   <div><h3>${NAMES[k]}</h3><p style="margin:0 0 8px">${DESC[k]}</p><div class="ex">Примеры: ${p.examples.slice(0,3).join('; ')}</div>
     <div class="ex">Чаще всего: ${Object.keys(p.regions).slice(0,3).join(', ')}</div></div>
   <div><div class="sub" style="margin-bottom:2px">Структура трат: тип / вся Россия</div>${bar(c)}${bar(rv)}
     <div class="cl">${CATS.map((x,i)=>`<em><i style="background:${CATCOL[i]}"></i>${x[1]} ${fmt(c[i],1)}%</em>`).join('')}</div></div>
   <div><div class="facts"><div><b class="num">${p.n}</b><span>МО в типе</span></div><div><b class="num">${fmt(p.total_rub)} ₽</b><span>в месяц на жителя</span></div>
     <div><b class="num">${lv>0?'+':''}${fmt(lv)}%</b><span>к типичной МО</span></div><div><b class="num">${pct(p.nominal_growth_pct,1)}</b><span>рост трат за год</span></div>
     <div><b class="num">${fmt(p.volatility,1)}</b><span>колебания (в России ${fmt(D.russia.volatility,1)})</span></div><div><b class="num">${pct(p.share_mkt,1)}</b><span>маркетплейсы</span></div></div>
     <div class="ex" style="margin-top:8px">В их регионах: безработица ${fmt(ctx.unemp,1)}%, городского населения ${fmt(ctx.urban)}%</div>
     <button class="btn-link" data-k="${k}">Показать на карте</button></div>`);
  L.appendChild(row)}
 L.querySelectorAll('.btn-link').forEach(b=>b.onclick=()=>{st.layer='type';st.filter=+b.dataset.k;st.mi=23;sl.value=23;document.querySelectorAll('.layers button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.layer==='type'));paint();$('#map-sec').scrollIntoView()})})();

/* ---------- графики ---------- */
function lineChart(series,o){const W=o.w||520,H=o.h||260,m={l:44,r:o.rm||90,t:10,b:26};const xs=i=>m.l+i*(W-m.l-m.r)/(T-1);
 let all=series.flatMap(s=>s.v.filter(x=>x!=null));let lo=o.lo!=null?o.lo:Math.min(...all),hi=o.hi!=null?o.hi:Math.max(...all);const pad=(hi-lo)*.08;if(o.lo==null)lo-=pad;if(o.hi==null)hi+=pad;
 const ys=v=>m.t+(1-(v-lo)/(hi-lo))*(H-m.t-m.b);const s=sv('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',role:'img','aria-label':o.label||'график'});
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,y=ys(v);s.appendChild(sv('line',{x1:m.l,x2:W-m.r,y1:y,y2:y,stroke:cv('--line'),'stroke-width':.6}));s.appendChild(sv('text',{x:m.l-6,y:y+4,'text-anchor':'end'},(o.yf||(x=>fmt(x,1)))(v)))}
 [0,6,12,18,23].forEach(i=>s.appendChild(sv('text',{x:xs(i),y:H-8,'text-anchor':i===0?'start':i===23?'end':'middle'},ML[i])));
 series.forEach(se=>{let d='';se.v.forEach((x,i)=>{if(x!=null)d+=(d&&se.v[i-1]!=null?'L':'M')+xs(i).toFixed(1)+' '+ys(x).toFixed(1)});
  s.appendChild(sv('path',{d,fill:'none',stroke:se.c,'stroke-width':se.w||2,'stroke-dasharray':se.dash||'','stroke-linejoin':'round'}));
  if(se.lab){const lv=[...se.v].reverse().find(x=>x!=null);if(lv!=null)s.appendChild(sv('text',{x:W-m.r+6,y:ys(lv)+4,style:`fill:${se.c};font-weight:600`},se.lab))}});return s}
const STABS=[['mkt','Маркетплейсы, % трат',x=>fmt(x,0)+'%',null],['food','Продукты, % трат',x=>fmt(x,0)+'%',null],['cater','Кафе и рестораны, % трат',x=>fmt(x,1)+'%',null],['transp','Транспорт, % трат',x=>fmt(x,1)+'%',null],['tot','Траты на жителя, ₽ в месяц',x=>fmt(x/1000)+' тыс.',null]];
function schart(key){const t=STABS.find(x=>x[0]===key);const se=D.tser.map((s,k)=>({c:COL[k],v:s[key],lab:String(k+1),w:2}));
 if(D.rus[key])se.push({c:cv('--mut'),v:D.rus[key],dash:'5 4',w:1.5,lab:'РФ'});
 const c=$('#schart');c.innerHTML='';c.appendChild(lineChart(se,{yf:t[2],h:300,rm:34,label:t[1]}));
 const r=D.rus.mkt;$('#snote').textContent=key==='mkt'?`Цифры справа — номера типов. В среднем по России доля маркетплейсов выросла с ${fmt(r[0],1)}% до ${fmt(r[23],1)}%. Рост идёт во всех типах, но сильнее всего в периферийных, поэтому часть их МО со временем смещается в соседние по профилю типы.`:'Цифры справа — номера типов. Пунктир — среднее по России, где оно есть.'}
STABS.forEach((t,i)=>{const b=el('button',{'aria-pressed':i===0},t[1]);b.onclick=()=>{document.querySelectorAll('#stabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));schart(t[0])};$('#stabs').appendChild(b)});schart('mkt');

(function(){const tr=D.trans,c=$('#tmat');c.className='tm';c.style.gridTemplateColumns='90px repeat(7,1fr)';let h='<div class="h">2023 → 2024</div>'+[...Array(K).keys()].map(k=>`<div class="h"><b style="color:${COL[k]}">●</b> ${k+1}</div>`).join('');
 tr.forEach((row,i)=>{const s=row.reduce((a,b)=>a+b,0)||1;h+=`<div class="h" style="justify-content:start;display:flex;align-items:center;gap:6px"><b style="color:${COL[i]}">●</b> тип ${i+1}</div>`+row.map((x,j)=>`<div style="background:color-mix(in srgb,${COL[j]} ${Math.round(x/s*100)}%,transparent);${i===j?'font-weight:700;outline:1px solid var(--ink)':''}" title="${NAMES[i]} → ${NAMES[j]}: ${x} МО">${x||''}</div>`).join('')});c.innerHTML=h;
 let best=[0,0,0];tr.forEach((r,i)=>r.forEach((x,j)=>{if(i!==j&&x>best[0])best=[x,i,j]}));const diag=tr.reduce((a,r,i)=>a+r[i],0)/tr.flat().reduce((a,b)=>a+b,0);
 const modal=(L)=>{const a=[...L].filter(c=>c!=='-').map(Number);return a.length?a.reduce((r,x)=>(r[x]++,r),Array(K).fill(0)).reduce((b,x,i,r)=>x>r[b]?i:b,0):-1};
 const mv=D.mo.filter(m=>modal(m.L.slice(6,12))===best[1]&&modal(m.L.slice(18))===best[2]),sy=D.mo.filter(m=>modal(m.L.slice(6,12))===best[1]&&modal(m.L.slice(18))===best[1]);
 const avg=(L,i)=>{const a=L.map(m=>m.v[i]).filter(x=>x!=null);return a.reduce((x,y)=>x+y,0)/(a.length||1)};
 $('#dynlede').innerHTML=`Распределение по типам почти не меняется, но внутри него идёт движение. Между декабрём 2023 и декабрём 2024 тот же тип сохранили ${fmt(D.nsame*100)}% территорий, а при сравнении полугодий — ${fmt(diag*100)}%. Самый крупный поток — из типа «${NAMES[best[1]]}» в тип «${NAMES[best[2]]}»: ${best[0]} МО. Те, кто перешёл, в среднем росли медленнее (${fmt(avg(mv,11),1)}% за год против ${fmt(avg(sy,11),1)}% у оставшихся), а доля маркетплейсов у них росла быстрее (+${fmt(avg(mv,10),1)} против +${fmt(avg(sy,10),1)} п.п.). Типы — это положение относительно страны в данный месяц, поэтому территория меняет тип, когда её профиль сдвигается быстрее среднего. Территории образуют непрерывный ряд, и границы между типами условны.`})();
(function(){const c=D.trajcnt,tot=Object.values(c).reduce((a,b)=>a+b,0);const cols={stable:COL[1],border:COL[2],moved:COL[4],partial:noneC()};
 $('#trajbar').innerHTML=`<div class="cbar">${['stable','border','moved','partial'].map(k=>`<div style="width:${c[k]/tot*100}%;background:${cols[k]}" title="${TRN[k]}">${c[k]}</div>`).join('')}</div>`;
 $('#trajnote').innerHTML=`<b>Устойчивые</b> (${c.stable}) — не менее 85% месяцев в одном типе. <b>Пограничные</b> (${c.border}) — стоят на стыке двух соседних типов и чередуют их. <b>Сменили тип</b> (${c.moved}) — во втором полугодии 2023 в одном типе, во втором полугодии 2024 в другом. <b>Мало данных</b> (${c.partial}) — менее года наблюдений. Большая доля пограничных — не ошибка метода, а свойство данных: SW около 0,2 говорит о континууме.`})();

/* ---------- паспорт ---------- */
const CTXL={unemp:['Безработица в регионе','%',1],employ:['Занятость в регионе','%',1],urban:['Городское население региона','%',0],paid_svc_pc:['Платные услуги в регионе','₽/мес на жителя',0],invest_pc:['Инвестиции в регионе, 2023','₽ на жителя',0],housing_price:['Вторичное жильё в регионе, 2023','₽/м²',0],housing_new:['Ввод жилья в регионе','м² на 1000 чел.',1]};
function renderPass(m){const b=$('#pbody'),t=m.f,p=D.prof[t],V=m.v;const mk=(l,v,mean)=>`<div class="hbar"><span>${l}</span><div class="tr"><i style="width:${Math.min(100,v/0.6)}%;background:${COL[t]}"></i><u style="left:${Math.min(100,mean/0.6)}%"></u></div><span class="num">${fmt(v,1)}%</span></div>`;
 const ct=[p.share_food,p.share_health,p.share_cater,p.share_transp,p.share_mkt,p.share_other],cm=comps(V);
 const lv=(Math.exp(V[1])-1)*100,cf=m.cf;
 const ser=lineChart([{c:cv('--mut'),v:D.rus.tot,dash:'5 4',w:1.5,lab:'РФ'},{c:COL[t],v:D.tser[t].tot,w:1.5,lab:'тип'},{c:cv('--ink'),v:m.ser,w:2.6,lab:'МО'}],{h:200,yf:x=>fmt(x/1000)+' тыс.',rm:40,label:'Траты на жителя'});
 b.innerHTML=`<h3 style="font-size:26px">${m.n}</h3><p class="sub" style="margin:4px 0 10px">${m.r}, ${m.ot}</p>
  <span class="pill" style="background:${COL[t]}">${t+1}. ${NAMES[t]}</span><span class="pill" style="background:var(--mut)">${TRN[m.tr]}</span>
  <div class="tl" title="Тип по месяцам">${[...m.L].map((c,i)=>`<i style="background:${c==='-'?noneC():COL[+c]}" title="${ML[i]}: ${c==='-'?'нет данных':NAMES[+c]}"></i>`).join('')}</div>
  <div class="sub" style="display:flex;justify-content:space-between"><span>${ML[0]}</span><span>тип по месяцам</span><span>${ML[23]}</span></div>
  <p style="margin-top:12px">${cf!=null?`В ${fmt(cf*100)}% из 40 перезапусков с шумом территория остаётся в этом типе. Ближайший соседний тип — «${NAMES[m.sec]}».`:`Наблюдений: ${m.mo} из 24 месяцев. Граф для этой МО не строился: тип определён по ближайшему центру кластера в каждом наблюдаемом месяце.`}${m.sw>0?` Смена типа между соседними месяцами: ${m.sw} за период.`:''}</p>
  <div class="two" style="gap:28px"><div><h3 style="font-size:15px;margin-bottom:6px">Структура трат</h3><div class="sub" style="margin-bottom:4px">Полоса — территория, чёрточка — средний профиль типа</div>${CATS.map((c,i)=>mk(c[1],cm[i],ct[i])).join('')}
   <h3 style="font-size:15px;margin:18px 0 6px">Траты на жителя в месяц</h3>${ser.outerHTML}</div>
  <div><h3 style="font-size:15px;margin-bottom:6px">Показатели</h3><table>
   <tr><td>Траты на жителя</td><td class="num">${fmt(V[0])} ₽</td></tr><tr><td>Относительно типичной МО</td><td class="num">${lv>0?'+':''}${fmt(lv)}%</td></tr>
   <tr><td>Рост за год (2024 к 2023)</td><td class="num">${V[11]==null?'—':pct(V[11],1)}</td></tr><tr><td>Колебания месяц к месяцу</td><td class="num">${fmt(V[8],1)} (РФ ${fmt(D.russia.volatility,1)})</td></tr>
   <tr><td>Сезонность</td><td class="num">${fmt(V[9],1)} (РФ ${fmt(D.russia.seasonality,1)})</td></tr><tr><td>Рост доли маркетплейсов</td><td class="num">${V[10]==null?'—':'+'+fmt(V[10],1)+' п.п.'}</td></tr>
   <tr><td>Доступность рынков</td><td class="num">${m.ma==null?'нет сообщения':fmt(m.ma,0)}</td></tr><tr><td>Среднее расстояние до 5 ближайших МО</td><td class="num">${fmt(m.iso)} км</td></tr><tr><td>Железная дорога</td><td class="num">${m.rail?'есть':'нет'}</td></tr></table>
   <h3 style="font-size:15px;margin:18px 0 6px">Регион: контекст Росстата</h3><table>${D.ctxcols.map((k,i)=>m.ctx[i]==null?'':`<tr><td>${CTXL[k][0]}</td><td class="num">${fmt(m.ctx[i],CTXL[k][2])} ${CTXL[k][1]}</td></tr>`).join('')}</table>
   <p class="sub" style="margin-top:6px">Показатели Росстата заданы на уровне региона, поэтому одинаковы для всех МО региона.</p></div></div>
  ${m.sim.length?`<h3 style="font-size:15px;margin:22px 0 4px">Похожие территории по профилю трат</h3><div class="chips">${m.sim.map(s=>{const o=byId[s];return `<button data-s="${s}"><i style="background:${COL[o.f]}"></i>${o.n}, ${o.r}</button>`}).join('')}</div>`:''}`;
 b.querySelectorAll('[data-s]').forEach(x=>x.onclick=()=>{select(+x.dataset.s);});}
const qi=$('#q'),sr=$('#sres');
qi.oninput=()=>{const q=qi.value.trim().toLowerCase();if(q.length<2){sr.style.display='none';return}
 const r=D.mo.filter(m=>m.n.toLowerCase().includes(q)||m.r.toLowerCase().includes(q)).slice(0,9);sr.innerHTML=r.map(m=>`<button data-i="${m.id}">${m.n} <small>${m.r}</small></button>`).join('')||'<button disabled>Ничего не найдено</button>';sr.style.display='block';
 sr.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{select(+b.dataset.i);sr.style.display='none';qi.value=''})};
document.addEventListener('click',e=>{if(!e.target.closest('.search'))sr.style.display='none'});
$('#pcards').innerHTML='<p class="sub" style="margin-top:14px">Попробуйте:</p><div class="chips" id="pex"></div>';
for(let k=0;k<K;k++){const m=D.mo.filter(x=>x.f===k&&x.mo===24).sort((a,b)=>b.v[0]-a.v[0])[Math.min(3,k)];if(!m)continue;const b=el('button',{},`<i style="background:${COL[k]}"></i>${m.n}`);b.onclick=()=>select(m.id);$('#pex').appendChild(b)}

/* ---------- метод ---------- */
const NETN={cos:'Косинус профиля',rbf:'RBF-ядро профиля',corr:'Корреляция траекторий',dtw:'DTW-траектории',road:'Дорожное расстояние',hybrid:'Профиль × расстояние',multi:'Мульти: профиль + траектории'};
const METN={kmeans:'k-means',ward:'Уорд',spectral:'Спектральный',sgc:'Сглаживание по графу',fused:'Граф ⊕ признаки',leiden:'Лейден'};
(function(){const gr=D.grid,W=520,H=330,m={l:48,r:12,t:12,b:40};const sx=Math.min(...gr.map(r=>r.SW))-0.02,ex=Math.max(...gr.map(r=>r.SW))+0.02,sy=Math.min(...gr.map(r=>r.ANUI))-0.03,ey=Math.max(...gr.map(r=>r.ANUI))+0.03;
 const X=v=>m.l+(v-sx)/(ex-sx)*(W-m.l-m.r),Y=v=>m.t+(1-(v-sy)/(ey-sy))*(H-m.t-m.b);const s=sv('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',role:'img','aria-label':'Сравнение сетей и методов'});
 s.appendChild(sv('rect',{x:X(sx),y:Y(ey),width:X(0.05)-X(sx),height:Y(sy)-Y(ey),fill:COL[4],opacity:.1}));s.appendChild(sv('text',{x:X(sx)+6,y:Y(ey)+14,style:`fill:${COL[4]}`},'Ловушка: хорошие сетевые индексы, нет сходства профилей'));
 for(let i=0;i<=4;i++){const v=sy+(ey-sy)*i/4;s.appendChild(sv('line',{x1:m.l,x2:W-m.r,y1:Y(v),y2:Y(v),stroke:cv('--line'),'stroke-width':.5}));s.appendChild(sv('text',{x:m.l-5,y:Y(v)+4,'text-anchor':'end'},fmt(v,2)));
  const u=sx+(ex-sx)*i/4;s.appendChild(sv('text',{x:X(u),y:H-20,'text-anchor':'middle'},fmt(u,2)))}
 s.appendChild(sv('text',{x:W/2,y:H-4,'text-anchor':'middle'},'SW: близость внутри кластера в пространстве профилей →'));s.appendChild(sv('text',{x:12,y:H/2,transform:`rotate(-90 12 ${H/2})`,'text-anchor':'middle'},'ANUI: чёткость кластеров в сети →'));
 const nets=Object.keys(NETN),nc=[COL[0],COL[1],COL[2],COL[3],COL[4],COL[5],cv('--ink')];
 gr.forEach(r=>{const i=nets.indexOf(r.net),ch=r.net==='multi'&&r.method==='sgc';const c=sv('circle',{cx:X(r.SW),cy:Y(r.ANUI),r:ch?7:5,fill:nc[i],stroke:ch?cv('--ink'):'none','stroke-width':2.2,opacity:.9});c.appendChild(sv('title',{},`${NETN[r.net]} + ${METN[r.method]}: SW ${fmt(r.SW,2)}, ANUI ${fmt(r.ANUI,2)}`));s.appendChild(c)});
 s.appendChild(sv('text',{x:X(0.205)+10,y:Y(0.83)-10,style:`fill:${cv('--ink')};font-weight:600`},'наш выбор'));
 const sc=$('#scatter');sc.appendChild(s);sc.appendChild(el('div',{class:'legend'},nets.map((n,i)=>`<span class="chip" style="cursor:default"><i style="background:${nc[i]}"></i>${NETN[n]}</span>`).join('')));
 const rs=gr.find(r=>r.net==='road'&&r.method==='spectral'),hs=gr.find(r=>r.net==='hybrid'&&r.method==='spectral');
 $('#trapnote').innerHTML=`Мы сравнили 7 способов построить сеть и 6 алгоритмов кластеризации на трёх месяцах при k = 4, 6, 8, 10 — всего 504 разбиения. Оказалось, что сетевые индексы сами по себе вводят в заблуждение: дорожная сеть со спектральным методом даёт ANUI ${fmt(rs.ANUI,2)}, но SW ${fmt(rs.SW,2)}. Такое разбиение режет страну на соседние регионы, а не на типы поведения: территории в группе близки на карте, но не похожи по тратам. Поэтому мы выбираем конфигурацию, которая сильна по обоим семействам индексов одновременно.`;
 const rows=nets.map(n=>{const a=gr.filter(r=>r.net===n);const av=k=>a.reduce((s,r)=>s+r[k],0)/a.length;return [n,av('SW'),av('ANUI'),av('balance')]});
 $('#gridnote').textContent='Среднее по шести методам, трём месяцам и четырём k.';$('#gtable').innerHTML=`<table><tr><th>Сеть</th><th>SW</th><th>ANUI</th><th>Баланс размеров</th></tr>${rows.map(r=>`<tr><td>${NETN[r[0]]}</td><td class="num">${fmt(r[1],3)}</td><td class="num">${fmt(r[2],3)}</td><td class="num">${fmt(r[3],2)}</td></tr>`).join('')}</table>`})();
(function(){const ks=D.kscan.filter(r=>r.cfg==='multi/sgc/evo');const mk=key=>ks.map(r=>r[key]);const se=[{c:COL[0],v:mk('SW'),lab:'SW'},{c:COL[2],v:mk('ANUI'),lab:'ANUI'},{c:COL[1],v:mk('ari_adj'),lab:'ARI мес.'},{c:COL[4],v:mk('ari_noise'),lab:'ARI шум'}];
 const W=520,H=300,m={l:40,r:62,t:10,b:30},n=ks.length;const xs=i=>m.l+i*(W-m.l-m.r)/(n-1),ys=v=>m.t+(1-(v-0.1)/0.9)*(H-m.t-m.b);const s=sv('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',role:'img','aria-label':'Выбор числа кластеров'});
 for(let v=0.1;v<=1.01;v+=0.3){s.appendChild(sv('line',{x1:m.l,x2:W-m.r,y1:ys(v),y2:ys(v),stroke:cv('--line'),'stroke-width':.5}));s.appendChild(sv('text',{x:m.l-5,y:ys(v)+4,'text-anchor':'end'},fmt(v,1)))}
 ks.forEach((r,i)=>s.appendChild(sv('text',{x:xs(i),y:H-10,'text-anchor':'middle'},String(r.k))));const i7=ks.findIndex(r=>r.k===7);s.appendChild(sv('rect',{x:xs(i7)-14,y:m.t,width:28,height:H-m.t-m.b,fill:cv('--ink'),opacity:.08}));
 se.forEach(q=>{s.appendChild(sv('path',{d:q.v.map((v,i)=>(i?'L':'M')+xs(i).toFixed(1)+' '+ys(v).toFixed(1)).join(''),fill:'none',stroke:q.c,'stroke-width':2}));s.appendChild(sv('text',{x:W-m.r+6,y:ys(q.v[n-1])+4,style:`fill:${q.c};font-weight:600`},q.lab))});
 s.appendChild(sv('text',{x:W/2,y:H-0,'text-anchor':'middle'},'число кластеров k'));$('#kchart').appendChild(s);
 const g=k=>D.kscan.filter(r=>r.cfg===k).reduce((a,r)=>a+r.ari_adj,0)/10,k7=ks[i7];
 $('#knote').innerHTML=`<p>При k = 7 индекс ANUI максимален (${fmt(k7.ANUI,3)}), модулярность Q (${fmt(k7.Q,3)}) близка к максимуму, S_Dbw равен ${fmt(k7.S_Dbw,2)}. Разбиение устойчиво к шуму в признаках: ARI = ${fmt(k7.ari_noise,2)}. При k = 3–4 SW выше, но группы получаются слишком грубыми, а при k ≥ 11 появляются кластеры меньше 3% территорий.</p>
 <p><b>Сглаживание во времени.</b> Месячные данные шумные, поэтому признаки мягко подтягиваются к предыдущему месяцу с автоматически подбираемым весом (в среднем ${fmt(D.alphas.slice(1).reduce((a,b)=>a+b,0)/23,2)}). Согласованность типов между соседними месяцами выросла с ARI ${fmt(g('multi/sgc/raw'),2)} до ${fmt(g('multi/sgc/evo'),2)}, а качество кластеров не упало.</p>`})();
(function(){const I=D.icvi,keys=[['SW','Silhouette (SW)','↑'],['CH','Calinski–Harabasz (CH)','↑'],['DBI','Davies–Bouldin (DBI)','↓'],['S_Dbw','S_Dbw','↓'],['Q','Модулярность (Q)','↑'],['MQ','Mancoridis (MQ)','↑'],['AVI','Средняя изолируемость (AVI)','↑'],['AVU','Средняя унифицируемость (AVU)','↑'],['ANUI','ANUI','↑']];
 const st=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return [m,Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length)]};
 $('#icvitable').innerHTML=`<table><tr><th>Индекс</th><th>Лучше</th><th>Среднее за 24 месяца</th><th>Разброс по месяцам</th></tr>${keys.map(k=>{const [m,s]=st(I.map(r=>r[k[0]]));return `<tr><td>${k[1]}</td><td>${k[2]}</td><td class="num">${fmt(m,k[0]==='CH'?0:3)}</td><td class="num">±${fmt(s,k[0]==='CH'?0:3)}</td></tr>`}).join('')}</table><p class="sub" style="margin-top:8px">AVI, AVU и ANUI реализованы нами по описанию статьи в Expert Systems with Applications (2017): изолируемость — доля веса связей, остающаяся внутри кластера; унифицируемость — нормированная внутренняя плотность. Точные формулы организаторов стоит сверить перед отправкой.</p>`})();

/* ---------- ограничения, подвал ---------- */
$('#limlist').innerHTML=[
 'Это безналичные траты по картам Сбера, оценённые моделью СберИндекса. Наличные и покупки у клиентов других банков в данных не видны, поэтому уровень трат отражает не доход, а банковскую активность жителей.',
 'Данных о населении муниципалитетов в наборе нет: все МО входят с равным весом, а тип нельзя пересчитать на число жителей.',
 'Показатели Росстата доступны только на уровне регионов. Мы используем их для описания типов, а не для кластеризации, иначе все МО региона получили бы одинаковые признаки. Связь типа с региональной статистикой — описательная, не причинная.',
 'Профили трат образуют континуум: SW около 0,2, около половины территорий пограничные. Границы между соседними типами условны, а значит, переход МО из типа в тип часто означает небольшой сдвиг профиля, а не смену модели поведения.',
 'Первые три месяца 2023 года менее надёжны: окно сглаживания и траекторий ещё не набрало 12 месяцев. Для переходов мы сравниваем июль–декабрь 2023 и 2024.',
 `Кластеризация строилась по ${D.mo.filter(m=>m.mo===24).length} МО с полными 24 месяцами. Остальные ${D.mo.filter(m=>m.mo<24).length} МО с неполными рядами получили тип по ближайшему центру, но без построения графа, и показаны с пометкой.`,
 'Данные о покупательской мобильности есть только для одного региона, поэтому мы не использовали их.',
 'Все метки типов, названия и описания — наша интерпретация. Они опираются на показанные числа, но другое разумное название тоже возможно.'].map(t=>`<li>${t}</li>`).join('');
$('#foot').innerHTML='Данные: СберИндекс — потребительские безналичные расходы по МО, индекс доступности рынков, автодорожные и железнодорожные связи, границы и справочник МО (CC BY-SA 4.0); Росстат — региональные показатели. Анализ выполнен для конкурса СберИндекса, трек «Кластеризация». Цитирование: СберИндекс, https://sberindex.ru/ru/research/data-sense-opisanie-nabora-dannikh-khakatona-sberindeksa-po-munitsipalnim-dannim.';
$('#k3').textContent=fmt(D.nsame*100)+'%';
$('#theme').onclick=()=>{const r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=dark?'light':'dark';refreshCol();paint();schart(document.querySelector('#stabs [aria-pressed=true]')?STABS[[...document.querySelectorAll('#stabs button')].findIndex(b=>b.getAttribute('aria-pressed')==='true')][0]:'mkt');if(st.sel)renderPass(byId[st.sel])};
document.addEventListener('click',e=>{if(e.target.id==='gop'){}});
window.addEventListener('resize',()=>{});
goHome();paint();renderPass(D.mo.find(m=>/Арбат/.test(m.n)));
})();
