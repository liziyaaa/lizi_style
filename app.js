'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const STORE = 'bijian-v1';
  const COLORS = ['#73836e', '#c6a48e', '#7d8e9c', '#525965'];
  const COLOR_NAMES = ['鼠尾草绿', '暖杏色', '雾蓝色', '石墨灰'];
  const STYLE_NAMES = {daily:'日常简约',fit:'贴身基础',sport:'休闲运动',smart:'通勤约会'};
  const SHAPE_NAMES = {balanced:'自然匀称',soft:'柔和轮廓',athletic:'运动轮廓',curvy:'腰胯明显'};
  const defaults = () => ({male:{height:178,weight:72,style:'daily',shape:'balanced',color:0,shoe:0},female:{height:163,weight:53,style:'daily',shape:'balanced',color:1,shoe:0},gap:12,view:'front',ruler:true,swapped:false});
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v,a,b,f) => Number.isFinite(Number(v)) ? clamp(Number(v),a,b) : f;
  const round = v => Math.round(v*10)/10;
  function sanitize(raw) {
    const d=defaults();
    if (!raw || typeof raw !== 'object') return d;
    for (const sex of ['male','female']) {
      const p=raw[sex]; if (!p || typeof p!=='object') continue;
      d[sex]={height:round(num(p.height,130,210,d[sex].height)),weight:round(num(p.weight,35,160,d[sex].weight)),shoe:round(num(p.shoe,0,10,0)),color:Math.round(num(p.color,0,3,d[sex].color)),style:Object.hasOwn(STYLE_NAMES,p.style)?p.style:'daily',shape:Object.hasOwn(SHAPE_NAMES,p.shape)?p.shape:'balanced'};
    }
    d.gap=Math.round(num(raw.gap,0,45,12));
    d.view=['front','side','silhouette'].includes(raw.view)?raw.view:'front';
    d.ruler=raw.ruler!==false;d.swapped=raw.swapped===true;
    return d;
  }
  let state=defaults(), saved=[], storageOK=true, loadedSaved=false;
  try {
    const raw=JSON.parse(localStorage.getItem(STORE)||'null');
    if(raw){state=sanitize(raw.state);loadedSaved=Array.isArray(raw.saved);saved=loadedSaved?raw.saved.slice(0,12).filter(p=>p&&typeof p.name==='string'&&p.state).map(p=>({name:p.name.slice(0,24),state:sanitize(p.state)})):[];}
  } catch {storageOK=false;}
  if (!loadedSaved) saved=[
    {name:'初见 · 15 cm',state:defaults()},
    {name:'靠近一点 · 8 cm',state:{...defaults(),female:{...defaults().female,height:170,weight:58}}},
    {name:'并肩 · 同样高',state:{...defaults(),female:{...defaults().female,height:178,weight:64}}}
  ];
  let toastTimer;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
  let storageWarned=false;
  function persist(){try{localStorage.setItem(STORE,JSON.stringify({state,saved}));storageOK=true;}catch{storageOK=false;if(!storageWarned){toast('当前浏览器无法保存数据，仍可正常预览和导出');storageWarned=true;}}}
  function options(map,selected){return Object.entries(map).map(([k,v])=>`<option value="${k}" ${selected===k?'selected':''}>${v}</option>`).join('');}
  function renderControls(){
    $('person-controls').innerHTML=['male','female'].map(sex=>{
      const p=state[sex],label=sex==='male'?'男生':'女生';
      return `<section class="person-card" data-person="${sex}" aria-label="${label}设置">
        <div class="person-heading"><div class="person-id"><span class="person-dot">${sex==='male'?'♂':'♀'}</span>${label}</div><span class="model-tag">亚洲青年风格</span></div>
        <div class="metric-row">${[['height','身高',130,210,'cm'],['weight','体重',35,160,'kg']].map(([key,title,min,max,unit])=>`<div><label class="field-label" for="${sex}-${key}">${title}</label><div class="number-field"><input type="number" id="${sex}-${key}" data-field="${key}" inputmode="decimal" min="${min}" max="${max}" step="0.1" value="${p[key]}" aria-label="${label}${title}"><span>${unit}</span></div><input type="range" class="range" data-field="${key}" min="${min}" max="${max}" step="0.1" value="${p[key]}" aria-label="调整${label}${title}"></div>`).join('')}</div>
        <div class="select-row"><div><label class="field-label" for="${sex}-shape">身形轮廓</label><select id="${sex}-shape" data-field="shape" aria-label="${label}身形轮廓">${options(SHAPE_NAMES,p.shape)}</select></div><div><label class="field-label" for="${sex}-style">穿搭风格</label><select id="${sex}-style" data-field="style" aria-label="${label}穿搭风格">${options(STYLE_NAMES,p.style)}</select></div></div>
        <div class="bottom-settings"><div class="color-options" role="group" aria-label="${label}衣服颜色"><span class="swatch-label">配色</span>${COLORS.map((c,i)=>`<button class="swatch ${i===p.color?'selected':''}" style="background:${c}" data-color="${i}" aria-label="${label}${COLOR_NAMES[i]}" aria-pressed="${i===p.color}" title="${COLOR_NAMES[i]}"></button>`).join('')}</div><label class="shoe-field" for="${sex}-shoe">鞋底增高 <input id="${sex}-shoe" data-field="shoe" type="number" min="0" max="10" step="0.5" inputmode="decimal" value="${p.shoe}" aria-label="${label}鞋底增高">cm</label></div>
      </section>`;
    }).join('');
    $('gap').value=state.gap;$('ruler').checked=state.ruler;
    updateViewButtons();
  }
  function updateViewButtons(){document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});}
  // All geometry below is in centimetres on a 180 cm reference figure.
  // The group scale is height/180, never separate x/y scaling for height.
  // Width is an illustrative continuous function, not a fitted population model.
  function measures(p,sex){
    const b=p.weight/(p.height/100)**2;
    const t=clamp(Math.sqrt(b/22),.72,1.85),male=sex==='male';
    const athletic=p.shape==='athletic',soft=p.shape==='soft',curvy=p.shape==='curvy';
    return {
      shoulder:(male?22:19.1)*(.9+.1*t)+(athletic?2.1:0),
      chest:(male?17.1:16)*t+(athletic?1.5:0)+(curvy?1.2:0),
      waist:(male?13.7:11.8)*Math.pow(t,1.3)+(soft?2:0)-(curvy?1.6:0),
      hip:(male?16.4:18.2)*t+(curvy?2:0)+(soft?1:0),
      arm:(male?4.3:3.7)*t+(athletic?1:0),
      thigh:(male?6.5:6.6)*t+(athletic?.8:0)+(curvy?.5:0),
      calf:(male?4.4:4.1)*t+(athletic?.6:0),
      depth:(male?10.5:10)*Math.pow(t,1.4)+(soft?1.6:0),head:7.7+clamp((t-1)*.65,-.2,.7),t
    };
  }
  const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
  const ellipse=(cx,cy,rx,ry,fill,extra='')=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
  function gradient(id,color){return `<linearGradient id="${id}" x1="0" x2="1"><stop stop-color="${color}"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".78"/></linearGradient>`;}
  function figureDefs(sex,p){return `<defs>
    <linearGradient id="skin-${sex}" x1="0" x2="1"><stop stop-color="#cda68b"/><stop offset=".48" stop-color="#edc8aa"/><stop offset="1" stop-color="#d5ad90"/></linearGradient>
    <linearGradient id="face-${sex}" x1="0" x2="1"><stop stop-color="#d9b295"/><stop offset=".55" stop-color="#f0ceb2"/><stop offset="1" stop-color="#dfb89a"/></linearGradient>
    <linearGradient id="hair-${sex}" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#41423c"/><stop offset=".45" stop-color="#262d2b"/><stop offset="1" stop-color="#343b35"/></linearGradient>
    ${gradient('top-'+sex,COLORS[p.color])}${gradient('bottom-'+sex,p.style==='sport'?'#838b7c':sex==='male'?'#505c55':p.style==='smart'?'#7c8274':'#d7cebb')}
    </defs>`;}
  function frontFigure(p,sex){
    const m=measures(p,sex),male=sex==='male',sil=state.view==='silhouette';
    const skin=sil?'#80917d':`url(#skin-${sex})`,hair=sil?skin:`url(#hair-${sex})`,face=sil?skin:`url(#face-${sex})`;
    const top=sil?skin:`url(#top-${sex})`,bottom=sil?skin:`url(#bottom-${sex})`;
    const detail=sil?'transparent':'#354939',light=sil?'transparent':'#ffffff';
    const {shoulder:s,chest:c,waist:w,hip:h,arm:a,thigh:t,calf:k}=m;
    let out=figureDefs(sex,p),line=`stroke="${detail}" stroke-opacity=".15" stroke-width=".55" stroke-linejoin="round"`;
    // Rear hair sits behind shoulders; face and skull do not extend above y=0.
    if(!male)out+=path(`M -${m.head} 11 Q -${m.head+3} 1 0 0 Q ${m.head+5} 0 ${m.head+4} 22 L ${m.head+6} 42 Q 7 46 4 39 L -8 40 Q -14 28 -${m.head} 11`,hair);
    // Legs. Their width changes independently from the vertical height scale.
    for(const sign of [-1,1]){
      out+=`<g transform="scale(${sign} 1)">`;
      out+=path(`M 2.5 93 Q ${h} 91 ${h} 103 Q ${h+1} 114 ${t+8} 129 Q ${k+8} 139 ${k+7.5} 150 L ${k+6.5} 174 Q 7 177 3.5 173 L 3.2 151 Q 1 136 3.5 129 L 2.5 93`,skin);
      const wide=p.style==='daily'?2.1:p.style==='smart'?1.3:.4;
      if(!(p.style==='smart'&&!male))out+=path(`M 1 94 Q ${h+1} 91 ${h+1} 103 Q ${h+2} 116 ${t+9+wide} 131 L ${k+7.7+wide} 171 Q 8 173 3 171 L 2.2 134 Q .4 119 1 94`,bottom,line);
      if(!sil&&!(p.style==='smart'&&!male))out+=path(`M 6 108 Q 7 131 7 166`,'none',`stroke="${light}" stroke-opacity=".10" stroke-width=".6"`);
      const lift=p.shoe*180/p.height;
      out+=path(`M 3.5 172 Q 7 175 ${k+7.2} 172 L ${k+8} 175 Q ${k+13} 176 ${k+12} ${179+lift} Q 9 ${180+lift} 2.7 ${179.6+lift} Z`,sil?skin:'#ebe9dd',`stroke="${sil?skin:'#a9b0a1'}" stroke-width=".4"`);
      if(!sil){out+=path(`M 4.2 ${178+lift} L ${k+11} ${178+lift}`,'none','stroke="#a5ad9c" stroke-width=".5"');out+=path(`M 9 175 L 12 176 M 11 174.9 L 14 176`,'none','stroke="#9aa393" stroke-width=".45"');}
      out+='</g>';
    }
    // Arms, relaxed at each side. Hand tips remain above the knee.
    for(const sign of [-1,1]){
      out+=`<g transform="scale(${sign} 1)">`;
      out+=path(`M ${s-4} 32 Q ${s+3} 32 ${s+a} 42 L ${s+a+3} 67 Q ${s+a+5} 77 ${s+a+3} 86 L ${s+a+2} 104 Q ${s+a+2} 110 ${s+a-1} 111 Q ${s+a-4} 110 ${s+a-5} 106 L ${s+a-4} 98 L ${s-1} 75 Q ${s-4} 67 ${s-5} 56 L ${s-4} 32`,skin,line);
      if(!sil)out+=path(`M ${s+a+.2} 101 L ${s+a-.5} 108 M ${s+a-2} 100 L ${s+a-2} 107`,'none','stroke="#b9967b" stroke-width=".35"');
      out+='</g>';
    }
    // Torso: shoulders, chest, waist, hips each respond to the chosen build.
    out+=path(`M -5.5 27 L -${s-4} 31 Q -${s+1} 35 -${c+2} 51 Q -${c} 64 -${w} 75 Q -${w} 84 -${h} 97 L ${h} 97 Q ${w} 84 ${w} 75 Q ${c} 64 ${c+2} 51 Q ${s+1} 35 ${s-4} 31 L 5.5 27 Z`,skin,line);
    const loose=p.style==='daily'?2.6:p.style==='sport'?3.8:p.style==='smart'?2.5:.5;
    const longSleeve=(!male&&p.style==='daily')||p.style==='sport'||p.style==='smart';
    const hem=p.style==='sport'?99:p.style==='smart'?100:p.style==='daily'?100:97;
    // Sleeves follow arms, leaving the relaxed hands visible.
    for(const sign of [-1,1]){
      out+=`<g transform="scale(${sign} 1)">`;
      out+=path(longSleeve?`M ${s-5} 31 Q ${s+4} 31 ${s+a+1.5} 43 L ${s+a+5} 71 L ${s+a+3} 98 L ${s+a-5.2} 98 L ${s-1} 76 Q ${s-6} 64 ${s-7} 47 Z`:`M ${s-5} 31 Q ${s+3} 32 ${s+a+2} 45 L ${s+a+3} 56 L ${s-4} 58 L ${s-7} 45 Z`,top,line);
      if(!sil)out+=path(longSleeve?`M ${s+a-5} 95 L ${s+a+3} 95`:`M ${s-4} 55 L ${s+a+2} 53`,'none',`stroke="${detail}" stroke-opacity=".16" stroke-width=".65"`);
      out+='</g>';
    }
    out+=path(`M -5.5 28 L -${s-3} 31 Q -${s+1+loose} 35 -${c+loose} 52 L -${w+loose} 75 L -${h+loose} ${hem} Q 0 ${hem+2} ${h+loose} ${hem} L ${w+loose} 75 L ${c+loose} 52 Q ${s+1+loose} 35 ${s-3} 31 L 5.5 28 Z`,top,line);
    if(!sil){
      out+=path(`M -${w+loose-1} ${hem-2} Q 0 ${hem} ${w+loose-1} ${hem-2}`,'none',`stroke="${detail}" stroke-opacity=".18" stroke-width=".55"`);
      out+=path(`M -${c-1} 57 Q -${w-1} 68 -${w} 76 M ${c-1} 60 Q ${w+1} 72 ${w+2} 79`,'none',`stroke="${light}" stroke-opacity=".14" stroke-width=".7"`);
    }
    if(p.style==='smart'){
      if(!male)out+=path(`M -${h} 86 Q 0 88 ${h} 86 L ${h+8} 132 Q 0 137 -${h+8} 132 Z`,bottom,line);
      if(!sil){out+=path('M -5 29 L -10 38 L -5 43 L -12 52 L -1 75 L 0 36 Z','#e3ddce',line);out+=path('M 5 29 L 10 38 L 5 43 L 12 52 L 1 75 L 0 36 Z','#ddd8ca',line);out+=path(`M 0 57 L 0 ${hem-1}`,'none','stroke="#394d3d" stroke-opacity=".3" stroke-width=".55"');for(const y of [66,78,88])out+=ellipse(1.2,y,.65,.65,'#445543');}
    }
    if(p.style==='sport'&&!sil){out+=path('M -5 30 Q -16 26 -13 37 L -5 45 L 0 38 L 5 45 L 13 37 Q 16 26 5 30','#b3baaa',line);out+=path('M -4 41 L -4 57 M 4 41 L 4 57','none','stroke="#e8ebde" stroke-width=".6"');out+=path(`M -10 77 L -13 87 Q 0 90 13 87 L 10 77`,'none',`stroke="${detail}" stroke-opacity=".18" stroke-width=".6"`);}
    // Neck and head. Hair top is the height reference; no styled lift is added.
    out+=path('M -4.4 19 L -4.5 28 Q 0 34 4.5 28 L 4.3 19 Z',skin);
    if(!sil&&p.style!=='smart')out+=path('M -5.8 29 Q 0 36 5.8 29','none',`stroke="${detail}" stroke-opacity=".3" stroke-width="1.2"`);
    out+=ellipse(-m.head,13,1.2,2.4,skin)+ellipse(m.head,13,1.2,2.4,skin);
    out+=path(`M -${m.head} 8 Q -${m.head} 1 0 .8 Q ${m.head} 1 ${m.head} 8 L ${m.head-.4} 16 Q ${m.head-1} 21 0 24 Q -${m.head-1} 21 -${m.head-.4} 16 Z`,face);
    if(male)out+=path(`M -${m.head} 13 Q -${m.head-1} 6 -${m.head+1} 7 Q -${m.head+1} 0 -1 0 Q ${m.head} -.1 ${m.head+.8} 6 L ${m.head-.2} 14 L ${m.head-1.4} 9 Q 3 8 3 5 Q -1 8 -5.8 8 L -${m.head-1.1} 14 Z`,hair);
    else{out+=path(`M -${m.head} 14 Q -${m.head+2} 5 -3 1 Q 3 -1 ${m.head} 3 Q ${m.head+3} 9 ${m.head-.4} 20 Q ${m.head+.1} 7 1 5 Q -4 9 -${m.head-1} 10 L -${m.head} 22 Z`,hair);if(!sil)out+=path('M 0 2 Q -5 5 -6 11','none','stroke="#737365" stroke-width=".45" stroke-opacity=".45"');}
    if(!sil){
      out+=path('M -5.5 11.2 Q -3.8 10.7 -2 11.3 M 2 11.3 Q 3.8 10.7 5.5 11.2','none','stroke="#585345" stroke-width=".65" stroke-linecap="round"');
      out+=path('M -5.1 13 Q -3.7 12.2 -2.3 13 M 2.3 13 Q 3.7 12.2 5.1 13','none','stroke="#3c4439" stroke-width=".5" stroke-linecap="round"');
      out+=ellipse(-3.7,13,.5,.55,'#333d34')+ellipse(3.7,13,.5,.55,'#333d34');
      out+=path('M .2 13.8 L -.7 17 L 1.1 17.3','none','stroke="#b38c71" stroke-width=".42" stroke-linecap="round"');
      out+=path('M -2 20 Q 0 20.6 2 20','none',`stroke="${male?'#a97f6a':'#b27f70'}" stroke-width=".55" stroke-linecap="round"`);
      if(!male){out+=ellipse(-5,17.8,1.4,.8,'#ca9480','opacity=".18"')+ellipse(5,17.8,1.4,.8,'#ca9480','opacity=".18"');out+=ellipse(-8,17,.55,.75,'#d7c39b');}
    }
    return out;
  }
  function sideFigure(p,sex){
    const m=measures(p,sex),male=sex==='male',skin=`url(#skin-${sex})`,hair=`url(#hair-${sex})`,top=`url(#top-${sex})`,bottom=`url(#bottom-${sex})`,d=m.depth,lift=p.shoe*180/p.height;
    const loose=p.style==='sport'?3:p.style==='daily'?2:0.6,skirt=p.style==='smart'&&!male;
    let out=figureDefs(sex,p),stroke='stroke="#394a3b" stroke-width=".5" stroke-opacity=".17" stroke-linejoin="round"';
    out+=ellipse(-2,13,7.5,12,hair);
    if(!male)out+=path('M -8 6 Q -13 16 -11 42 L 2 42 L 3 13 Z',hair);
    for(const shift of [-2.5,2]){
      out+=`<g transform="translate(${shift} 0)">`;
      out+=path(`M -${d} 95 Q ${d} 92 ${d} 105 Q ${d+1} 116 5 133 L 5 171 L -3 173 L -5 139 Q -${d} 117 -${d} 95`,skin,stroke);
      if(!skirt)out+=path(`M -${d+1} 94 Q ${d+1} 93 ${d+1} 107 Q ${d+2} 121 6.5 134 L 6 172 L -4.5 172 L -6.5 137 Q -${d+2} 118 -${d+1} 94`,bottom,stroke);
      out+=path(`M -4 172 L 5 173 Q 10 176 15 176 L 15 ${179+lift} L -5 ${180+lift} Z`,'#e9e8dc',stroke);
      out+='</g>';
    }
    out+=path(`M -4 28 Q -${d+3+loose} 30 -${d+2+loose} 43 Q -${d+loose} 65 -${d+loose} 81 L -${d+3+loose} 95 L ${d+5+loose} 95 Q ${d+2+loose} 80 ${d+1+loose} 76 Q ${d+4+loose} 65 ${d+2+loose} 53 Q ${d+6+loose} 42 6 30 Z`,top,stroke);
    if(skirt)out+=path(`M -${d+2} 87 L ${d+4} 87 L ${d+9} 133 Q 0 136 -${d+7} 133 Z`,bottom,stroke);
    const a=m.arm;
    out+=path(`M -${a+2} 34 Q 3 29 6 39 L 10 67 L 7.5 102 Q 9 110 5 111 Q 2 111 1 105 L 0 74 L -${a+4} 46 Z`,skin,stroke);
    const long=p.style==='sport'||p.style==='smart'||(!male&&p.style==='daily');
    out+=path(long?`M -${a+3} 34 Q 3 29 7 39 L 11 69 L 8 98 L -.5 98 L -1 74 L -${a+5} 46 Z`:`M -${a+3} 34 Q 3 29 7 39 L 9 54 L -${a+2} 56 L -${a+5} 46 Z`,top,stroke);
    out+=path('M -3 19 L -4 28 Q -2 32 5 30 L 5 20 Z',skin);
    out+=path('M -6 4 Q 0 -1 5 3 Q 8 6 7 11 L 10 15 L 7 16 L 7.5 19 L 5 22 Q 2 25 -2 22 L -6 17 Z',`url(#face-${sex})`);
    out+=path(male?'M -7 16 Q -12 4 -5 1 Q 1 -2 6 2 Q 8 5 7 8 L 2 7 L -1 9 L -3 17 Z':'M -7 20 Q -13 7 -6 1 Q 1 -2 6 3 L 7 7 Q 1 3 -2 11 L -3 26 L -10 39 Z',hair);
    out+=ellipse(-2,14,1.3,2,skin);
    out+=path('M 4 11.8 L 6.4 12.2 M 4.7 13.5 L 6.2 13.6','none','stroke="#4b5141" stroke-width=".55" stroke-linecap="round"');
    out+=path('M 6 19 L 7.2 19','none','stroke="#ae7f69" stroke-width=".5"');
    return out;
  }
  const SCALE=2.5,FLOOR=570;
  function alignment(){
    const a=state.male,b=state.female;
    const ah=a.height+a.shoe,bh=b.height+b.shoe;
    if(Math.abs(ah-bh)<.5)return '彼此的头顶';
    const tall=ah>bh?a:b,relative=Math.abs(ah-bh)/tall.height;
    if(relative<.045)return '对方的额头';
    if(relative<.085)return '对方的眼睛';
    if(relative<.112)return '对方的鼻尖';
    if(relative<.145)return '对方的下巴';
    if(relative<.205)return '对方的肩膀';
    if(relative<.34)return '对方的上胸';
    return '对方的胸前';
  }
  function renderStage(){
    const a=state.male,b=state.female;
    const heights={male:a.height+a.shoe,female:b.height+b.shoe};
    const top={male:FLOOR-heights.male*SCALE,female:FLOOR-heights.female*SCALE};
    const left=state.swapped?'female':'male',right=state.swapped?'male':'female';
    const extent=sex=>{const p=state[sex],m=measures(p,sex);return (state.view==='side'?m.depth+10:Math.max(m.shoulder+m.arm+5,m.hip+8))*p.height/180;};
    const centerDistance=(extent(left)+extent(right)+state.gap)*SCALE;
    const center=450,pos={[left]:center-centerDistance/2,[right]:center+centerDistance/2};
    let svg=`<title>比肩：男生 ${a.height} cm、${a.weight} kg，女生 ${b.height} cm、${b.weight} kg</title><desc>等比例${state.view==='side'?'侧面':state.view==='silhouette'?'剪影':'正面'}示意，裸足身高差 ${round(Math.abs(a.height-b.height))} 厘米。体型为近似模拟。</desc><defs><radialGradient id="bg"><stop stop-color="#f7f8ef"/><stop offset="1" stop-color="#edf1e9"/></radialGradient><filter id="shadow"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="880" height="650" fill="url(#bg)"/>`;
    if(state.ruler){
      for(let cm=0;cm<=220;cm+=5){const y=FLOOR-cm*SCALE;svg+=`<path d="M ${cm%10===0?83:91} ${y} H 100" stroke="#b7c4af" stroke-width="${cm%10===0?1:.6}"/>`;if(cm%20===0){svg+=`<text x="71" y="${y+4}" text-anchor="end" fill="#93a08a" font-size="11" font-family="sans-serif">${cm}</text>`;if(cm>0)svg+=`<path d="M 105 ${y} H 790" stroke="#bac8b0" stroke-width=".6" opacity=".26"/>`;}}
      svg+='<text x="84" y="12" fill="#8e9e84" font-size="10" font-family="sans-serif">cm</text>';
    }
    svg+='<path d="M 100 570 H 790" stroke="#b6c3ad" stroke-width="1"/>';
    for(const sex of [left,right]){
      const p=state[sex],x=pos[sex],y=top[sex],h=heights[sex];
      svg+=ellipse(x,FLOOR+1,extent(sex)*SCALE*.95,5,'#7b8d6e','opacity=".17" filter="url(#shadow)"');
      // Mutually oriented profiles face one another; front figures are symmetric.
      const mirror=state.view==='side'&&sex===right?-1:1;
      svg+=`<g transform="translate(${x} ${y}) scale(${mirror*SCALE*p.height/180} ${SCALE*p.height/180})">${state.view==='side'?sideFigure(p,sex):frontFigure(p,sex)}</g>`;
      const color=sex==='male'?'#6f8568':'#b5917c';
      svg+=`<path d="M ${x-24} ${y} H ${x+24}" stroke="${color}" opacity=".55" stroke-width=".8"/>`;
      svg+=`<text x="${x}" y="${y-17}" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="17" font-weight="500">${round(h)}<tspan font-size="10" dx="3">cm</tspan></text>`;
      const label=sex==='male'?'男生':'女生';
      svg+=`<text x="${x}" y="601" fill="${color}" text-anchor="middle" font-family="sans-serif" font-size="12">${label}<tspan dx="9" font-size="11" fill="#9aa58f">${p.weight} kg</tspan></text>`;
      if(p.shoe)svg+=`<text x="${x}" y="620" fill="#96a18c" text-anchor="middle" font-family="sans-serif" font-size="9">裸足 ${p.height} cm ＋ 鞋底 ${p.shoe} cm</text>`;
    }
    const high=Math.min(top.male,top.female),low=Math.max(top.male,top.female),diff=round(Math.abs(heights.male-heights.female));
    const bracket=Math.min(788,Math.max(pos.male+extent('male')*SCALE,pos.female+extent('female')*SCALE)+30);
    if(diff>.1){
      svg+=`<path d="M ${pos.male+30} ${top.male} H ${bracket} M ${pos.female+30} ${top.female} H ${bracket}" stroke="#a7b29c" stroke-width=".8" stroke-dasharray="3 5" opacity=".7"/>`;
      svg+=`<path d="M ${bracket-5} ${high} H ${bracket+5} M ${bracket} ${high} V ${low} M ${bracket-5} ${low} H ${bracket+5}" stroke="#819975" stroke-width="1"/>`;
      svg+=`<rect x="${bracket+9}" y="${(high+low)/2-11}" width="59" height="22" rx="11" fill="#e2e9d9"/><text x="${bracket+38}" y="${(high+low)/2+4}" fill="#728668" font-size="11" font-family="sans-serif" text-anchor="middle">${diff} cm</text>`;
    }
    const narrow=window.matchMedia('(max-width:500px)').matches;
    const bodyLeft=Math.min(pos.male-extent('male')*SCALE,pos.female-extent('female')*SCALE);
    const cameraLeft=narrow?Math.max(40,Math.min(210,bodyLeft-75)):0;
    const cameraRight=narrow?Math.max(750,bracket+72):880;
    // Crop empty horizontal space on small screens, while preserving one common scale.
    // The ruler shifts with the camera; its vertical centimetre spacing never changes.
    if(narrow&&state.ruler){
      const rulerShift=cameraLeft-50;
      svg=svg.replace(/M (83|91) ([\d.]+) H 100/g,(_,x,y)=>`M ${Number(x)+rulerShift} ${y} H ${100+rulerShift}`)
        .replace(/x="71"/g,`x="${71+rulerShift}"`).replace('x="84" y="12"',`x="${84+rulerShift}" y="12"`)
        .replace(/M 105 ([\d.]+) H 790/g,(_,y)=>`M ${105+rulerShift} ${y} H 790`);
    }
    $('stage').setAttribute('viewBox',`${cameraLeft} 0 ${cameraRight-cameraLeft} 650`);
    $('stage').parentElement.style.aspectRatio=`${cameraRight-cameraLeft} / 650`;
    $('stage').innerHTML=svg;
    $('height-diff').innerHTML=`${round(Math.abs(a.height-b.height))}<small>cm</small>`;
    $('visual-diff').innerHTML=`${diff}<small>cm</small>`;
    $('alignment').textContent=alignment();$('gap-value').textContent=state.gap+' cm';
  }
  function renderPresets(){
    const root=$('presets');root.replaceChildren();
    saved.forEach((p,i)=>{
      const wrap=document.createElement('div');wrap.className='preset-wrapper';
      const card=document.createElement('button');card.className='preset-card';card.setAttribute('aria-label','加载方案 '+p.name);
      const a=p.state.male,b=p.state.female;
      card.innerHTML=`<span class="preset-mini" aria-hidden="true"><i class="mini-human" style="height:${a.height*.23}px"></i><i class="mini-human" style="height:${b.height*.23}px"></i></span><span><span class="preset-title">${esc(p.name)}</span><span class="preset-data">♂ ${a.height} cm · ${a.weight} kg<br>♀ ${b.height} cm · ${b.weight} kg</span></span>`;
      card.addEventListener('click',()=>{state=sanitize(p.state);renderControls();renderStage();persist();toast('已切换至「'+p.name+'」');});
      const del=document.createElement('button');del.className='preset-delete';del.textContent='×';del.setAttribute('aria-label','删除方案 '+p.name);
      del.addEventListener('click',()=>{saved.splice(i,1);persist();renderPresets();toast('已删除收藏');});
      wrap.append(card,del);root.append(wrap);
    });
    if(!saved.length){const empty=document.createElement('p');empty.className='collection-hint';empty.textContent='还没有收藏，先调出一组喜欢的比例吧。';root.append(empty);}
  }
  $('person-controls').addEventListener('input',e=>{
    const input=e.target,key=input.dataset.field,card=input.closest('[data-person]');if(!key||!card)return;
    const sex=card.dataset.person;
    if(['height','weight','shoe'].includes(key)){
      if(input.value===''||!input.validity.valid)return;
      state[sex][key]=round(Number(input.value));
      card.querySelectorAll(`[data-field="${key}"]`).forEach(other=>{if(other!==input)other.value=input.value;});
    } else if(['shape','style'].includes(key)){state[sex][key]=input.value;}
    renderStage();persist();
  });
  $('person-controls').addEventListener('change',e=>{
    const input=e.target,key=input.dataset.field,card=input.closest('[data-person]');if(!card||!['height','weight','shoe'].includes(key))return;
    const value=round(num(input.value===''?NaN:input.value,Number(input.min),Number(input.max),state[card.dataset.person][key]));
    state[card.dataset.person][key]=value;
    card.querySelectorAll(`[data-field="${key}"]`).forEach(other=>other.value=value);
    renderStage();persist();
  });
  $('person-controls').addEventListener('click',e=>{
    const btn=e.target.closest('[data-color]');if(!btn)return;
    const card=btn.closest('[data-person]');state[card.dataset.person].color=Number(btn.dataset.color);
    card.querySelectorAll('[data-color]').forEach(el=>{const on=el===btn;el.classList.toggle('selected',on);el.setAttribute('aria-pressed',on);});
    renderStage();persist();
  });
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;updateViewButtons();renderStage();persist();}));
  $('gap').addEventListener('input',e=>{state.gap=Number(e.target.value);renderStage();persist();});
  $('ruler').addEventListener('change',e=>{state.ruler=e.target.checked;renderStage();persist();});
  $('swap').addEventListener('click',()=>{state.swapped=!state.swapped;renderStage();persist();});
  $('reset').addEventListener('click',()=>{state=defaults();renderControls();renderStage();persist();toast('人物设定已恢复，收藏仍然保留');});
  for(const id of ['help','about'])$(id).addEventListener('click',()=>$('about-dialog').showModal());
  for(const id of ['close-about','understood'])$(id).addEventListener('click',()=>$('about-dialog').close());
  $('save-preset').addEventListener('click',()=>{
    if(saved.length>=12){toast('最多保留 12 组，请先删除一组');return;}
    $('preset-name').value=`${state.male.height} ＆ ${state.female.height}`;$('save-dialog').showModal();$('preset-name').select();
  });
  $('close-save').addEventListener('click',()=>$('save-dialog').close());
  $('save-form').addEventListener('submit',e=>{
    e.preventDefault();const name=$('preset-name').value.trim();
    if(!name){$('preset-name').setCustomValidity('请输入方案名称');$('preset-name').reportValidity();return;}
    if(saved.length>=12)return;
    saved.push({name:name.slice(0,24),state:JSON.parse(JSON.stringify(state))});persist();renderPresets();$('save-dialog').close();toast(storageOK?'已收藏这组比例':'已在本次页面中收藏，关闭后可能丢失');
  });
  $('preset-name').addEventListener('input',()=>$('preset-name').setCustomValidity(''));
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  $('export').addEventListener('click',async()=>{
    const btn=$('export');btn.disabled=true;
    try{
      const a=state.male,b=state.female;
      const source=$('stage').innerHTML;
      const footer=`<rect y="650" width="880" height="112" fill="#f7f6f2"/><text x="42" y="690" font-size="21" fill="#365e50" font-family="sans-serif">比肩 · SIDE BY SIDE</text><text x="42" y="719" font-size="13" fill="#7a8972" font-family="sans-serif">♂ ${a.height} cm / ${a.weight} kg　♀ ${b.height} cm / ${b.weight} kg　裸足身高差 ${round(Math.abs(a.height-b.height))} cm</text><text x="42" y="744" font-size="10" fill="#929d89" font-family="sans-serif">亚洲青年风格参数化示意 · 体型为近似模拟，不代表真人外形 · 头顶数字含所设鞋底增高</text>`;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1760" height="1524" viewBox="0 0 880 762">${source}${footer}</svg>`;
      const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
      const image=new Image();
      try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('image render'));image.src=url;});}finally{URL.revokeObjectURL(url);}
      const canvas=document.createElement('canvas');canvas.width=1760;canvas.height=1524;
      const context=canvas.getContext('2d');if(!context)throw new Error('canvas');context.drawImage(image,0,0);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('export');
      const link=document.createElement('a'),pngURL=URL.createObjectURL(blob);link.href=pngURL;link.download=`比肩_${a.height}cm_${b.height}cm.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(pngURL),10000);toast('对比图已生成，下载后可以分享');
    }catch{toast('图片生成失败，请换用最新版浏览器重试');}finally{btn.disabled=false;}
  });
  window.addEventListener('resize',renderStage);
  renderControls();renderStage();renderPresets();
})();
