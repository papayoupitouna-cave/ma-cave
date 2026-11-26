/* Ma Cave — application de gestion de cave à vins.
   Données : IndexedDB sur l'appareil + fichier ma-cave-donnees.json dans Google Drive.
   Aucun serveur, aucun compte tiers : tout appartient à l'utilisateur. */
'use strict';
{
const Y = new Date().getFullYear();
const TYPES = [['blanc','Blanc','#e2c046',0],['doux','Blanc doux','#d18f22',0],['rose','Rosé','#e88ca3',0],['rouge','Rouge','#7a1f3d',0],['eff_blanc','Effervescent blanc','#cbb24a',1],['eff_rose','Effervescent rosé','#d6688a',1],['eff_rouge','Effervescent rouge','#5a1530',1]];
const TY = Object.fromEntries(TYPES.map(t=>[t[0],t]));
const FORMATS = ['37,5 cl','50 cl','75 cl','Magnum 150 cl','Jéroboam 300 cl','Autre'];
const GUIDE = {'':'—',cite:'Cité','1':'★','2':'★★','3':'★★★'};
const OCC = [['quotidien','Au quotidien'],['budget','Petit budget'],['aperitif','Apéritif'],['amis','Dîner entre amis'],['fete','Fête, Noël, réveillon'],['barbecue','Barbecue, été'],['exception','Grande occasion'],['cadeau','À offrir']];
const APP = window.APPELLATIONS || {};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : ''; };
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const euro = n => n ? Math.round(n).toLocaleString('fr-FR') + ' €' : '';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
function toast(t){ const e=$('#toast'); e.textContent=t; e.classList.add('on'); clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove('on'),2600); }

/* ================= Stockage local (IndexedDB) ================= */
const idb = {
  db: null,
  open(){ return new Promise((ok,ko)=>{ const r=indexedDB.open('ma-cave',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>{this.db=r.result;ok()}; r.onerror=()=>ko(r.error); }); },
  get(k){ return new Promise((ok,ko)=>{ const t=this.db.transaction('kv').objectStore('kv').get(k); t.onsuccess=()=>ok(t.result); t.onerror=()=>ko(t.error); }); },
  set(k,v){ return new Promise((ok,ko)=>{ const tx=this.db.transaction('kv','readwrite'); tx.objectStore('kv').put(v,k); tx.oncomplete=()=>ok(); tx.onerror=()=>ko(tx.error); }); }
};
const DEF_R = {budget:15, exception:40, caves:['Cave principale'], majLe:''};
let S = {vins:[], degustations:[], reglages:{...DEF_R}};
const vins = () => S.vins.filter(v=>!v.supprime);
const degs = () => S.degustations.filter(d=>!d.supprime);
const R = () => S.reglages;
async function persist(sync=true){ await idb.set('state', S); if(sync) Sync.schedule(); }

async function saveVin(id, data){
  data.majLe = now();
  if(id){ const v=S.vins.find(x=>x.id===id); Object.assign(v,data); }
  else { id = uid(); S.vins.push({id, creeLe:data.majLe, ...data}); }
  await persist(); renderAll(); return id;
}
async function delVin(id){
  const i=S.vins.findIndex(v=>v.id===id); if(i<0) return;
  S.vins[i] = {id, supprime:true, majLe:now()};
  S.degustations = S.degustations.map(d=>d.vinId===id?{id:d.id,supprime:true,majLe:now()}:d);
  await persist(); renderAll();
}
async function addDeg(d){ S.degustations.push({id:uid(), majLe:now(), ...d}); await persist(); }
async function saveR(){ R().majLe = now(); await persist(); renderAll(); }

/* ================= Fusion (synchronisation et import) ================= */
function mergeArr(a,b){ const m=new Map(a.map(x=>[x.id,x])); for(const x of b||[]){ if(!x||!x.id) continue; const y=m.get(x.id); if(!y||String(x.majLe||'')>String(y.majLe||'')) m.set(x.id,x); } return [...m.values()]; }
function merge(other){
  S.vins = mergeArr(S.vins, other.vins);
  S.degustations = mergeArr(S.degustations, other.degustations);
  if(other.reglages && String(other.reglages.majLe||'') > String(R().majLe||'')) S.reglages = {...DEF_R, ...other.reglages};
}
const payload = () => ({app:'ma-cave', version:1, date:now(), reglages:S.reglages, vins:S.vins, degustations:S.degustations});

/* ================= Google Drive ================= */
const Sync = {
  FILE:'ma-cave-donnees.json', SCOPE:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
  token:null, exp:0, timer:null, busy:false,
  cid(){ return (localStorage.getItem('mc_cid')||'542423062328-qjc7nc5v36f9kbe5p10agt7lk132fuce.apps.googleusercontent.com').trim(); },
  valid(){ return this.token && Date.now() < this.exp; },
  restore(){ try{ const t=JSON.parse(localStorage.getItem('mc_tok')||'null'); if(t&&t.exp>Date.now()){this.token=t.token;this.exp=t.exp;} }catch(e){} },
  status(kind, txt){ const b=$('#syncBtn'); b.className='sync '+(kind||''); $('#syncTxt').textContent=txt; },
  loadGis(){ if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve();
    return new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.onload=ok; s.onerror=()=>ko(new Error('Google est injoignable (hors ligne ?)')); document.head.appendChild(s); }); },
  async connect(){
    if(!this.cid()) throw new Error('Collez d’abord votre identifiant client Google dans Réglages.');
    await this.loadGis();
    await new Promise((ok,ko)=>{
      const tc = google.accounts.oauth2.initTokenClient({client_id:this.cid(), scope:this.SCOPE,
        callback:r=>{ if(r.error) return ko(new Error(r.error_description||r.error)); this.token=r.access_token; this.exp=Date.now()+((+r.expires_in||3600)-120)*1000;
          try{localStorage.setItem('mc_tok',JSON.stringify({token:this.token,exp:this.exp}))}catch(e){} localStorage.setItem('mc_linked','1'); ok(); },
        error_callback:e=>ko(new Error(e&&e.type==='popup_closed'?'Fenêtre Google fermée':'Connexion Google refusée'))});
      tc.requestAccessToken({prompt: localStorage.getItem('mc_linked') ? '' : 'consent'});
    });
    await this.sync();
  },
  async api(url, opt={}){
    const r = await fetch(url, {...opt, headers:{...(opt.headers||{}), Authorization:'Bearer '+this.token}});
    if(r.status===401){ this.token=null; localStorage.removeItem('mc_tok'); throw new Error('reconnect'); }
    if(!r.ok) throw new Error('Google Drive a répondu '+r.status);
    return r;
  },
  async find(name){ const q=encodeURIComponent(`name='${name}' and trashed=false`);
    const j=await (await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`)).json(); return (j.files||[])[0]; },
  async create(name, text, mime='application/json', target){
    const b='mcb'+Date.now(), meta={name, mimeType: target||mime};
    const body=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}; charset=UTF-8\r\n\r\n${text}\r\n--${b}--`;
    return (await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body})).json(); },
  async update(id, text){ await this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,{method:'PATCH',headers:{'Content-Type':'application/json; charset=UTF-8'},body:text}); },
  schedule(){ if(!this.cid()||!localStorage.getItem('mc_linked')) return; this.status('run','Modifié'); clearTimeout(this.timer); this.timer=setTimeout(()=>this.sync(),2500); },
  async sync(){
    if(!this.cid()||!localStorage.getItem('mc_linked')){ this.status('','Drive non relié'); return; }
    if(!navigator.onLine){ this.status('run','Hors ligne'); return; }
    if(!this.valid()){ this.status('err','Toucher pour reconnecter'); return; }
    if(this.busy){ this.schedule(); return; }
    this.busy=true; this.status('run','Synchronisation…');
    try{
      const f = await this.find(this.FILE);
      let remoteTxt='';
      if(f){ remoteTxt = await (await this.api(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).text();
        try{ merge(JSON.parse(remoteTxt)); }catch(e){} }
      await this.boite();
      const mine = JSON.stringify(payload());
      const strip = t => { try{ const o=JSON.parse(t); delete o.date; return JSON.stringify(o); }catch(e){ return ''; } };
      if(!f) await this.create(this.FILE, mine);
      else if(strip(mine)!==strip(remoteTxt)) await this.update(f.id, mine);
      const mois = today().slice(0,7), nom = `ma-cave-sauvegarde-${mois}.json`;
      if(localStorage.getItem('mc_mois')!==mois){ if(!(await this.find(nom))) await this.create(nom, mine); localStorage.setItem('mc_mois',mois); }
      await persist(false); localStorage.setItem('mc_last', now());
      this.status('ok','Drive à jour'); renderAll();
    }catch(e){
      this.status('err', e.message==='reconnect' ? 'Toucher pour reconnecter' : 'Échec de synchro');
      if(e.message!=='reconnect') $('#gMsg').textContent = e.message;
    }finally{ this.busy=false; }
  },
  async boite(){ // fichiers ma-cave-ajout*.json déposés par votre caviste dans Drive
    try{ const q=encodeURIComponent("name contains 'ma-cave-ajout' and trashed=false");
      const j=await (await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=200`)).json();
      const deja=new Set(R().importes||[]); let nouv=0, vus=0;
      for(const fi of j.files||[]){ if(deja.has(fi.id)) continue;
        try{ const o=JSON.parse(await (await this.api(`https://www.googleapis.com/drive/v3/files/${fi.id}?alt=media`)).text()); if(o&&Array.isArray(o.vins)){ const avant=vins().length; merge(o); nouv+=vins().length-avant; } deja.add(fi.id); vus++; }catch(e){ if(e.message==='reconnect') throw e; } }
      if(vus){ R().importes=[...deja]; R().majLe=now(); }
      if(nouv) setTimeout(()=>toast(nouv+' vin'+(nouv>1?'s':'')+' ajouté'+(nouv>1?'s':'')+' par votre caviste'),300);
    }catch(e){ if(e.message==='reconnect') throw e; } },
  async sheet(){
    if(!this.valid()) await this.connect();
    const r = await this.create('Ma Cave — '+today(), csv(), 'text/csv', 'application/vnd.google-apps.spreadsheet');
    return 'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(r.id);
  }
};

/* ================= Règles de caviste ================= */
const label = v => [v.nom,v.cuvee].filter(Boolean).join(' · ') || 'Vin sans nom';
const dot = v => { const t=TY[v.type]||TY.rouge; return `<span class="dot${t[3]?' eff':''}" style="background:${t[2]}" title="${esc(t[1])}"></span>`; };
function prixRef(v){ const p=v.expert&&v.expert.prix; if(p&&(+p.min||+p.max)){ const a=+p.min||+p.max, b=+p.max||+p.min; return (a+b)/2; } return +v.prix||0; }
function statut(v){ const de=+v.de||0, ap=+v.apogee||0, ju=+v.jusqua||0;
  if(!de&&!ap&&!ju) return {k:'inconnu',t:'Garde à préciser',o:5};
  if(ju&&ju<Y) return {k:'passe',t:'À boire d’urgence',o:0};
  if(ju&&ju===Y) return {k:'urgent',t:'Dernière année',o:1};
  if(de&&de>Y) return {k:'attendre',t:'À attendre ('+de+')',o:4};
  if(ap&&Math.abs(ap-Y)<=1) return {k:'apogee',t:'À son apogée',o:2};
  return {k:'pret',t:'Prêt à boire',o:3}; }
const isExc = v => v.guideNote==='3' || v.guideCC || prixRef(v) >= (+R().exception||40);
const isBudget = v => { const p=prixRef(v); return p>0 && p<=(+R().budget||15); };
const PLATS = [
  [/hu[iî]tre|fruits de mer|coquillage|crustac|langoust|homard|crevette|sushi/i, ['blanc','eff_blanc'], 'les fruits de mer'],
  [/poisson|sole|bar\b|saumon|cabillaud|turbot|truite/i, ['blanc','eff_blanc','rose'], 'le poisson'],
  [/foie gras/i, ['doux','eff_blanc','blanc'], 'le foie gras'],
  [/dessert|g[aâ]teau|tarte|chocolat|b[ûu]che|fruit/i, ['doux','eff_rose','eff_blanc'], 'le dessert'],
  [/fromage|comt[ée]|ch[eè]vre|roquefort|brie|camembert/i, ['blanc','rouge','doux'], 'le fromage'],
  [/gibier|chevreuil|sanglier|li[eè]vre|daube|civet/i, ['rouge'], 'le gibier'],
  [/b[œo]euf|entrec[ôo]te|c[ôo]te de|agneau|gigot|magret|canard|grillade|barbecue/i, ['rouge'], 'la viande rouge'],
  [/volaille|poulet|dinde|chapon|pintade|veau|porc/i, ['rouge','blanc'], 'la viande blanche ou la volaille'],
  [/ap[ée]ro|ap[ée]ritif|amuse/i, ['eff_blanc','eff_rose','blanc','rose'], 'l’apéritif'],
  [/salade|l[ée]gume|v[ée]g[ée]tarien|asiatique|[ée]pic/i, ['blanc','rose'], 'ce plat'],
];
function suggere(occ, plat){
  const pri={passe:6,urgent:5,apogee:4,pret:2,inconnu:1,attendre:-9};
  const okPlat = PLATS.find(p=>p[0].test(plat||''));
  const mots = (plat||'').toLowerCase().split(/[^a-zà-ÿœ]+/).filter(m=>m.length>3);
  return vins().filter(v=>+v.qte>0).map(v=>{
    const s=statut(v), p=prixRef(v), exc=isExc(v), eff=String(v.type).startsWith('eff');
    let sc=pri[s.k]||0; const pq=[];
    if(s.o<=1) pq.push('à boire en priorité'); else if(s.k==='apogee') pq.push('à son apogée');
    switch(occ){
      case 'quotidien': if(exc) sc-=8; if(isBudget(v)||!p) sc+=3; break;
      case 'budget': if(!isBudget(v)) sc-=8; else { sc+=4-p/10; pq.push(euro(p)); } break;
      case 'aperitif': if(eff){sc+=5;pq.push('les bulles ouvrent l’appétit');} else if(['blanc','rose'].includes(v.type)) sc+=3; else sc-=3; if(exc) sc-=3; break;
      case 'amis': if(exc) sc-=1; if(p>=(+R().budget||15)) sc+=2; break;
      case 'fete': if(eff){sc+=5;pq.push('des bulles pour la fête');} if(exc){sc+=3;pq.push('une bouteille d’exception');} break;
      case 'barbecue': if(['rouge','rose'].includes(v.type)) sc+=3; else sc-=2; if(exc) sc-=4; break;
      case 'exception': if(exc){sc+=6;pq.push('une bouteille d’exception');} else sc-=6; break;
      case 'cadeau': sc+= (exc?5:0) + (v.guideNote>='2'||v.guideCC?3:0); if(s.k==='attendre') sc+=9; break;
    }
    if(okPlat){ const i=okPlat[1].indexOf(v.type); if(i>=0){ sc+=4-i; pq.push('accord classique avec '+okPlat[2]); } else sc-=4; }
    const acc=[v.accords, v.expert&&Array.isArray(v.expert.accords)?v.expert.accords.join(' '):''].join(' ').toLowerCase();
    if(mots.some(m=>acc.includes(m))){ sc+=4; pq.push('accord noté sur la fiche'); }
    if(v.guideCC) sc+=1;
    return {v, sc, pq};
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,3);
}

/* ================= Rendu ================= */
let f={cave:'',type:'',stat:''}, occSel='quotidien', current=null;
function stats(){ const L=vins(), n=L.reduce((s,v)=>s+(+v.qte||0),0), val=L.reduce((s,v)=>s+(+v.qte||0)*prixRef(v),0), urg=L.filter(v=>v.qte>0&&statut(v).o<=1).length;
  $('#stats').textContent=`${n} bouteille${n>1?'s':''} · ${L.length} référence${L.length>1?'s':''}${val?' · valeur estimée '+euro(val):''}${urg?' · '+urg+' à boire vite':''}`; }
function chips(el,items,cur,cb){ el.innerHTML=items.map(([k,l])=>`<button class="chip${k===cur?' on':''}" data-k="${esc(k)}">${esc(l)}</button>`).join(''); el.onclick=e=>{const b=e.target.closest('.chip'); if(b) cb(b.dataset.k)}; }
const okImg = s => typeof s==='string' && s.startsWith('data:image/');
function card(v){ const s=statut(v);
  return `<div class="card" role="button" tabindex="0" data-id="${esc(v.id)}">${okImg(v.photo)?`<img src="${esc(v.photo)}" alt="">`:dot(v)}
  <div><b>${esc(label(v))}${v.millesime?' '+esc(v.millesime):''}</b><small>${esc([v.appellation,v.region].filter(Boolean).join(' · '))}</small><small>${esc([v.cave,v.emplacement].filter(Boolean).join(' — '))}</small></div>
  <div class="right"><div class="qrow"><button class="qb" data-q="-1" data-id="${esc(v.id)}" aria-label="Sortir une bouteille" ${+v.qte?'':'disabled'}>−</button><span class="qte">${+v.qte||0}</span><button class="qb" data-q="1" data-id="${esc(v.id)}" aria-label="Ajouter une bouteille">+</button></div><span class="badge b-${s.k}">${esc(+v.qte?s.t:'Épuisé')}</span></div></div>`; }
function renderCave(){ const L0=vins(), caves=[...new Set([...R().caves,...L0.map(v=>v.cave).filter(Boolean)])];
  chips($('#fCave'),[['','Toutes les caves'],...caves.map(c=>[c,c])],f.cave,k=>{f.cave=k;renderCave()});
  chips($('#fType'),[['','Toutes couleurs'],...TYPES.map(t=>[t[0],t[1]])],f.type,k=>{f.type=k;renderCave()});
  chips($('#fStat'),[['','Tous'],['urg','À boire vite'],['apogee','Apogée'],['pret','Prêts'],['attendre','À attendre'],['vide','Épuisés']],f.stat,k=>{f.stat=k;renderCave()});
  const q=$('#q').value.trim().toLowerCase(), tri=$('#tri').value;
  let L=L0.filter(v=>(!f.cave||v.cave===f.cave)&&(!f.type||v.type===f.type));
  if(f.stat==='vide') L=L.filter(v=>!(+v.qte)); else { L=L.filter(v=>+v.qte>0); if(f.stat==='urg') L=L.filter(v=>statut(v).o<=1); else if(f.stat) L=L.filter(v=>statut(v).k===f.stat); }
  if(q) L=L.filter(v=>[v.nom,v.cuvee,v.producteur,v.appellation,v.region,v.cepages,v.millesime,v.emplacement,v.lieuAchat].join(' ').toLowerCase().includes(q));
  const by={urgence:(a,b)=>statut(a).o-statut(b).o||(+a.jusqua||9999)-(+b.jusqua||9999),nom:(a,b)=>label(a).localeCompare(label(b),'fr'),mill:(a,b)=>(+a.millesime||0)-(+b.millesime||0),prix:(a,b)=>prixRef(b)-prixRef(a),qte:(a,b)=>(+b.qte||0)-(+a.qte||0)};
  L.sort(by[tri]);
  $('#liste').innerHTML = L.length ? L.map(card).join('') : (L0.length ? '<div class="empty"><h3>Aucun vin ici</h3>Changez la recherche ou les filtres.</div>' : '<div class="empty"><h3>Votre cave est vide</h3>Touchez <b>+ Ajouter</b> pour saisir vos premières bouteilles, ou importez un tableau.</div>'); }
function renderBoire(){ chips($('#occ'),OCC,occSel,k=>{occSel=k;renderBoire();occasion()});
  const d=vins().filter(v=>+v.qte>0);
  const S2=[['À boire d’urgence','Leur fenêtre de garde se referme : ouvrez-les avant de les perdre.',d.filter(v=>statut(v).o<=1)],
   ['À leur apogée','Le meilleur moment pour les servir, c’est maintenant.',d.filter(v=>statut(v).k==='apogee')],
   ['Au quotidien, petit budget',`Prêts à boire, jusqu'à ${R().budget} € la bouteille.`,d.filter(v=>isBudget(v)&&statut(v).k!=='attendre'&&statut(v).k!=='inconnu')],
   ['Vins d’exception prêts',`★★★, coups de cœur ou plus de ${R().exception} € — pour les grands moments.`,d.filter(v=>isExc(v)&&statut(v).k!=='attendre'&&statut(v).k!=='inconnu')],
   ['À laisser dormir','Trop jeunes : patience.',d.filter(v=>statut(v).k==='attendre')],
   ['Garde à préciser','Renseignez la fenêtre de garde (ou demandez-la à Claude) pour recevoir des alertes.',d.filter(v=>statut(v).k==='inconnu')]];
  $('#boireListes').innerHTML = S2.map(([t,ds,L])=>L.length?`<h2 class="sec">${esc(t)} <span class="note">(${L.length})</span></h2><p class="lead">${esc(ds)}</p><div class="list">${L.sort((a,b)=>(+a.jusqua||9999)-(+b.jusqua||9999)).map(card).join('')}</div>`:'').join('') || '<div class="empty">Ajoutez des bouteilles pour recevoir des conseils.</div>'; }
function occasion(){ const res=suggere(occSel,$('#plat').value.trim()), occ=OCC.find(o=>o[0]===occSel)[1];
  $('#occRes').innerHTML = `<div class="expert" style="margin-top:14px"><h3 style="font-size:24px">Pour « ${esc(occ)} »</h3>${res.length?`<div class="list">${res.map(x=>card(x.v)+`<p style="margin:0 0 6px" class="note">${esc(x.pq.join(' · ')||'bon choix pour l’occasion')}${x.v.temp?' · servir à '+esc(x.v.temp):''}${x.v.carafe?' · '+esc(x.v.carafe):''}</p>`).join('')}</div>`:'<p>Rien dans la cave ne convient vraiment à cette occasion.</p>'}</div>`; }
function renderR(){ $('#cavesList').innerHTML=R().caves.map(c=>`<span class="chip">${esc(c)} <button data-c="${esc(c)}" aria-label="Retirer ${esc(c)}" style="border:0;background:none;cursor:pointer;color:var(--mut)">×</button></span>`).join('');
  $('#sBudget').value=R().budget; $('#sExc').value=R().exception; if(document.activeElement!==$('#cid')) $('#cid').value=Sync.cid();
  const last=localStorage.getItem('mc_last'); if(last&&!$('#gMsg').textContent) $('#gMsg').textContent='Dernière synchronisation : '+new Date(last).toLocaleString('fr-FR');
  const n=vins().length, linked=localStorage.getItem('mc_linked');
  $('#alerte').innerHTML = n>=3&&!linked ? '<p class="warn">Vos vins ne sont que sur cet appareil. Reliez Google Drive dans Réglages pour ne jamais les perdre.</p>' : ''; }
function renderAll(){ stats(); renderCave(); renderBoire(); renderR(); }

/* ================= +1 / −1 et Annuler ================= */
(()=>{ const st=document.createElement('style'); st.textContent=`.qrow{display:flex;align-items:center;gap:6px}
.qb{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--soft);color:var(--ink);font-size:22px;font-weight:600;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}
.qb:disabled{opacity:.35;cursor:default}.qb.big{width:64px;height:64px;font-size:34px;background:var(--wine);color:#fff;border:0}.qb.big:disabled{background:var(--line)}
.lnk{border:0;background:none;color:var(--wine2);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
#undo{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:6px 6px 6px 16px;border-radius:14px;font-size:14px;z-index:41;display:none;align-items:center;gap:4px;width:min(94vw,420px);box-shadow:0 6px 20px rgba(0,0,0,.25)}
#undo.on{display:flex}#undo span{flex:1}#undo button{border:0;background:transparent;color:var(--gold);font-weight:700;padding:8px 10px;min-height:40px;cursor:pointer;font-size:14px;white-space:nowrap}`; document.head.appendChild(st); })();
function undoBar(msg, actions){ let e=$('#undo'); if(!e){ e=document.createElement('div'); e.id='undo'; e.setAttribute('role','status'); document.body.appendChild(e); }
  e.innerHTML=`<span>${esc(msg)}</span>`+actions.map((a,i)=>`<button data-u="${i}">${esc(a[0])}</button>`).join(''); e.classList.add('on');
  e.onclick=ev=>{ const b=ev.target.closest('[data-u]'); if(!b) return; e.classList.remove('on'); actions[+b.dataset.u][1](); };
  clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove('on'),8000); }
async function quick(id,d){ const v=vins().find(x=>x.id===id); if(!v) return; const old={qte:v.qte,qteEntree:v.qteEntree}; let degId=null;
  if(d<0){ if(!(+v.qte)) return; degId=uid(); S.degustations.push({id:degId,majLe:now(),vinId:id,vin:label(v)+(v.millesime?' '+v.millesime:''),date:today(),motif:'Dégustée'}); await saveVin(id,{qte:(+v.qte)-1}); }
  else await saveVin(id,{qte:(+v.qte||0)+1,qteEntree:(+v.qteEntree||+v.qte||0)+1});
  const open=()=>{ if(current===id&&!$('#sheet').hidden) openFiche(id); }; open(); const n=+v.qte||0;
  undoBar(d<0?`Bouteille sortie · il en reste ${n}`:`Bouteille ajoutée · ${n} en cave`,[['Annuler',async()=>{ const x=S.vins.find(y=>y.id===id); Object.assign(x,old,{majLe:now()});
    if(degId){ const i=S.degustations.findIndex(y=>y.id===degId); if(i>=0) S.degustations[i]={id:degId,supprime:true,majLe:now()}; } await persist(); renderAll(); open(); toast('Annulé'); }],
    ...(degId?[['Noter',()=>openSortie(id,degId)]]:[])]); }

/* ================= Fiche ================= */
function openSheet(h){ $('#sb').innerHTML=h; $('#sheet').hidden=false; $('.sheet-in').scrollTop=0; }
function closeSheet(){ $('#sheet').hidden=true; current=null; }
function frise(v){ const de=+v.de, ju=+v.jusqua; if(!de||!ju||ju<de) return ''; const a=Math.min(de,Y)-1, b=Math.max(ju,Y)+1, pc=x=>((x-a)/(b-a)*100).toFixed(1)+'%';
  return `<div class="frise" aria-label="Fenêtre de garde"><div class="bar" style="left:${pc(de)};width:calc(${pc(ju)} - ${pc(de)})"></div><div class="now" style="left:${pc(Y)}"></div>
  <span class="lab" style="left:${pc(de)}">${de}</span>${+v.apogee&&+v.apogee!==de&&+v.apogee!==ju?`<span class="lab" style="left:${pc(+v.apogee)}">apogée ${+v.apogee}</span>`:''}<span class="lab" style="left:${pc(ju)}">${ju}</span></div>`; }
function dl(rows){ const r=rows.filter(x=>x[1]!==''&&x[1]!==undefined&&x[1]!==null&&x[1]!==false); return r.length?`<dl>${r.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:'<p class="note">Non renseigné.</p>'; }
function openFiche(id){ const v=vins().find(x=>x.id===id); if(!v) return closeSheet(); current=id; const s=statut(v), e=v.expert, qq=encodeURIComponent([label(v),v.millesime].filter(Boolean).join(' '));
  const mem=degs().filter(d=>d.vinId===id).sort((a,b)=>String(b.date).localeCompare(a.date));
  openSheet(`<div class="fiche-h">${okImg(v.photo)?`<img src="${esc(v.photo)}" alt="Étiquette">`:''}<div><p class="note" style="margin:0">${dot(v)} ${esc((TY[v.type]||TY.rouge)[1])}${v.format?' · '+esc(v.format):''}</p><h2>${esc(label(v))}</h2><p style="margin:4px 0">${esc([v.millesime,v.appellation,v.region].filter(Boolean).join(' · '))}</p><span class="badge b-${s.k}">${esc(s.t)}</span></div></div>
  <div class="stepper"><button class="qb big" data-q="-1" data-id="${esc(id)}" aria-label="Sortir une bouteille" ${+v.qte?'':'disabled'}>−</button><div style="text-align:center;flex:1"><span class="qte">${+v.qte||0}</span><br><span class="note">bouteille${(+v.qte||0)>1?'s':''} en cave</span></div><button class="qb big" data-q="1" data-id="${esc(id)}" aria-label="Ajouter une bouteille">+</button></div><p class="note" style="text-align:center;margin:-4px 0 8px">− quand vous en buvez une · + quand vous en rachetez · <button class="lnk" id="fNoter">sortir avec des notes</button></p>
  ${frise(v)}
  <div class="row"><button class="btn ghost" id="fEdit">Modifier</button><button class="btn ghost" id="fDup">Dupliquer</button><button class="btn" id="fExp">${e?'Mettre à jour la fiche Claude':'Fiche Claude'}</button></div>
  <fieldset><legend>Identité</legend>${dl([['Producteur',v.producteur],['Cépages',v.cepages],['Degré',v.degre?v.degre+' %':'']])}</fieldset>
  <fieldset><legend>Achat</legend>${dl([['Lieu',v.lieuAchat],['Date',v.dateAchat],['Prix',v.prix?euro(v.prix):''],['Contact',v.contact]])}</fieldset>
  <fieldset><legend>Gestion</legend>${dl([['Cave',v.cave],['Emplacement',v.emplacement],['À boire',[v.de&&'dès '+v.de,v.apogee&&'apogée '+v.apogee,v.jusqua&&'jusqu’en '+v.jusqua].filter(Boolean).join(' · ')],['Entrées',v.qteEntree],['Service',[v.temp,v.carafe].filter(Boolean).join(' — ')],['Accords',v.accords]])}</fieldset>
  <fieldset><legend>Dégustation</legend>${dl([['Guide Hachette',(v.guideNote?GUIDE[v.guideNote]:'')+(v.guideCC?' ♥ coup de cœur':'')+(v.guideEdition?' (éd. '+v.guideEdition+')':'')],['Commentaire du Guide',v.guideComment],['Ma note',v.maNote?'★'.repeat(+v.maNote):''],['Mes commentaires',v.mesComments]])}</fieldset>
  ${e?`<div class="expert"><h3 style="font-size:24px">L’avis du caviste</h3><p class="note">Fiche du ${esc(e.date||'')}${e.fiabilite?' · fiabilité '+esc(e.fiabilite):''}</p>
   ${e.presentation?`<p>${esc(e.presentation)}</p>`:''}${e.avis?`<p><b>Ce qu’on en dit :</b> ${esc(e.avis)}</p>`:''}${e.degustation?`<p><b>En bouche :</b> ${esc(e.degustation)}</p>`:''}
   ${Array.isArray(e.accords)?`<p><b>Accords :</b> ${esc(e.accords.join(' · '))}</p>`:''}${e.aEviter?`<p><b>À éviter :</b> ${esc(e.aEviter)}</p>`:''}
   ${e.prix&&(e.prix.min||e.prix.max)?`<p><b>Prix moyen :</b> ${esc(e.prix.min)}–${esc(e.prix.max)} € ${e.prix.commentaire?'<span class="note">('+esc(e.prix.commentaire)+')</span>':''}</p>`:''}
   ${e.temperature||e.carafe?`<p><b>Service :</b> ${esc([e.temperature,e.carafe].filter(Boolean).join(' — '))}</p>`:''}</div>`:''}
  <div class="links"><span class="note">En ligne :</span><a href="https://www.wine-searcher.com/find/${qq}" target="_blank" rel="noopener">Prix (Wine-Searcher)</a><a href="https://www.vivino.com/search/wines?q=${qq}" target="_blank" rel="noopener">Avis (Vivino)</a><a href="https://www.google.com/search?q=${qq}+site%3Ahachette-vins.com" target="_blank" rel="noopener">Guide Hachette</a><a href="https://www.google.com/search?q=${qq}+accords+mets+vins" target="_blank" rel="noopener">Accords</a></div>
  <fieldset><legend>Mémoire gourmande</legend>${mem.length?mem.map(d=>`<div class="memo"><b>${esc(d.date)}</b> <small>${esc(d.motif||'Dégustée')}</small>${d.note?' '+'★'.repeat(+d.note):''}<br>${esc([d.qui&&'avec '+d.qui,d.quoi&&'sur '+d.quoi].filter(Boolean).join(', '))}${d.appreciation?`<br><small>${esc(d.appreciation)}</small>`:''}</div>`).join(''):'<p class="note">Aucune bouteille ouverte pour l’instant.</p>'}</fieldset>
  <button class="btn danger" id="fDel" style="margin-top:18px">Supprimer la fiche (erreur de saisie)</button>`);
  $('#fNoter').onclick=()=>openSortie(id); $('#fEdit').onclick=()=>openForm(v);
  $('#fDup').onclick=()=>{ const c={...v}; delete c.id; delete c.creeLe; c.millesime=''; c.emplacement=''; openForm(c,'Dupliquer : changez le millésime, la quantité ou l’emplacement'); };
  $('#fExp').onclick=()=>openClaude([v]);
  $('#fDel').onclick=()=>{ const b=$('#fDel'); if(b.dataset.ok){ const before=JSON.parse(JSON.stringify(S.vins.find(x=>x.id===id))), dsv=S.degustations.filter(d=>d.vinId===id).map(d=>JSON.parse(JSON.stringify(d))); closeSheet(); delVin(id).then(()=>undoBar('Fiche supprimée',[['Annuler',async()=>{ const t=now(); const i=S.vins.findIndex(x=>x.id===id); S.vins[i]={...before,majLe:t}; for(const d of dsv){ const j=S.degustations.findIndex(x=>x.id===d.id); if(j>=0) S.degustations[j]={...d,majLe:t}; } await persist(); renderAll(); toast('Fiche restaurée'); }]])); } else { b.dataset.ok=1; b.textContent=`Oui, effacer définitivement la fiche${+v.qte?' et ses '+(+v.qte)+' bouteille'+(+v.qte>1?'s':''):''}`; const w=document.createElement('p'); w.className='warn'; w.textContent='Pour une bouteille bue, utilisez plutôt le bouton −. Supprimer efface la fiche entière et son historique.'; b.before(w); } }; }
function openSortie(id,degId){ const v=vins().find(x=>x.id===id);
  openSheet(`<h2 style="font-size:30px">${degId?'Noter cette bouteille':'Sortir une bouteille'}</h2><p class="lead">${esc(label(v))} ${esc(v.millesime||'')} — reste ${+v.qte||0}</p>
  <form id="sf" class="grid2"><label>Motif<select name="motif"><option>Dégustée</option><option>Offerte</option><option>Vendue</option><option>Perdue (bouchonnée, cassée…)</option></select></label>
  <label>Servi le<input type="date" name="date" value="${today()}"></label><label>Avec qui<input name="qui"></label><label>Avec quoi<input name="quoi" placeholder="Le plat"></label>
  <label style="grid-column:1/-1">Appréciation<textarea name="appreciation" placeholder="Comment était-il ? Prêt, fermé, à son sommet ?"></textarea></label>
  <label>Note<select name="note"><option value="">—</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${'★'.repeat(n)}</option>`).join('')}</select></label>
  <div class="row" style="grid-column:1/-1"><button class="btn">Enregistrer</button><button type="button" class="btn sec" id="sBack">Annuler</button></div></form>`);
  $('#sBack').onclick=()=>openFiche(id);
  $('#sf').onsubmit=async e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); d.vinId=id; d.vin=label(v)+(v.millesime?' '+v.millesime:'');
    if(degId){ const g=S.degustations.find(x=>x.id===degId); if(g) Object.assign(g,d,{majLe:now()}); await persist(); }
    else { await addDeg(d); await saveVin(id,{qte:Math.max(0,(+v.qte||0)-1)}); }
    toast('Souvenir enregistré'); openFiche(id); }; }

/* ================= Formulaire ================= */
const inp=(k,l,v,t='text',x='')=>`<label>${l}<input name="${k}" type="${t}" value="${esc(v??'')}" ${t==='number'?'inputmode="decimal" step="any"':''} ${x}></label>`;
function openForm(v={},titre){ v={type:'rouge',format:'75 cl',qte:1,cave:R().derniereCave||R().caves[0],...v}; const id=v.id;
  const prev=k=>[...new Set(vins().map(x=>x[k]).filter(Boolean))];
  openSheet(`<h2 style="font-size:30px">${id?'Modifier le vin':'Nouveau vin'}</h2>${titre?`<p class="lead">${esc(titre)}</p>`:''}
  <form id="vf">${okImg(v.photo)?`<img src="${esc(v.photo)}" alt="Étiquette" style="width:90px;border-radius:10px">`:''}<fieldset><legend>Identité du vin</legend>
  <div class="types">${TYPES.map(t=>`<label><input type="radio" name="type" value="${t[0]}" ${v.type===t[0]?'checked':''}><span class="dot${t[3]?' eff':''}" style="background:${t[2]}"></span>${t[1]}</label>`).join('')}</div>
  <div class="grid2">${inp('nom','Nom du vin / domaine *',v.nom,'text','required list="dlNom"')}${inp('cuvee','Cuvée',v.cuvee)}${inp('millesime','Millésime',v.millesime,'number')}${inp('producteur','Producteur',v.producteur,'text','list="dlProd"')}
  ${inp('appellation','Appellation',v.appellation,'text','list="dlApp" id="fApp"')}${inp('region','Région / Pays',v.region,'text','id="fReg"')}${inp('cepages','Cépages',v.cepages)}
  <label>Format<select name="format">${FORMATS.map(x=>`<option ${x===v.format?'selected':''}>${x}</option>`).join('')}</select></label></div></fieldset>
  <datalist id="dlApp">${Object.keys(APP).map(a=>`<option value="${esc(a)}">`).join('')}</datalist>
  <datalist id="dlNom">${prev('nom').map(a=>`<option value="${esc(a)}">`).join('')}</datalist><datalist id="dlProd">${prev('producteur').map(a=>`<option value="${esc(a)}">`).join('')}</datalist>
  <fieldset><legend>Gestion</legend><div class="grid2">${inp('qte','Quantité en cave',v.qte,'number','min="0"')}
  <label>Cave<input name="cave" list="dlc" value="${esc(v.cave||'')}"><datalist id="dlc">${R().caves.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>${inp('emplacement','Emplacement (casier, rangée…)',v.emplacement)}
  ${inp('de','À boire à partir de',v.de,'number')}${inp('apogee','Apogée',v.apogee,'number')}${inp('jusqua','À boire jusqu’en',v.jusqua,'number')}</div></fieldset>
  <fieldset><legend>Achat</legend><div class="grid2">${inp('prix','Prix unitaire (€)',v.prix,'number')}${inp('dateAchat','Date d’achat',v.dateAchat||(id?'':today()),'date')}${inp('lieuAchat','Lieu d’achat',v.lieuAchat,'text','list="dlLieu"')}${inp('contact','Contact',v.contact)}</div>
  <datalist id="dlLieu">${prev('lieuAchat').map(a=>`<option value="${esc(a)}">`).join('')}</datalist></fieldset>
  <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center">Dégustation, Guide Hachette, service</summary>
  <div class="grid2" style="margin-top:10px"><label>Note du Guide<select name="guideNote">${Object.entries(GUIDE).map(([k,l])=>`<option value="${k}" ${(v.guideNote||'')===k?'selected':''}>${l}</option>`).join('')}</select></label>
  <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" name="guideCC" ${v.guideCC?'checked':''}> ♥ Coup de cœur</label>${inp('guideEdition','Édition du Guide',v.guideEdition,'number')}
  <label>Ma note<select name="maNote"><option value="">—</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${+v.maNote===n?'selected':''}>${'★'.repeat(n)}</option>`).join('')}</select></label>
  ${inp('degre','Degré (%)',v.degre,'number')}${inp('temp','Température de service',v.temp)}${inp('carafe','Carafage',v.carafe)}${inp('accords','Accords',v.accords)}</div>
  <label style="margin-top:12px">Commentaires du Guide<textarea name="guideComment">${esc(v.guideComment||'')}</textarea></label>
  <label style="margin-top:12px">Mes commentaires<textarea name="mesComments">${esc(v.mesComments||'')}</textarea></label></details>
  <div class="row" style="margin-top:18px"><button class="btn">Enregistrer</button>${id?'':'<button type="button" class="btn sec" id="saveSim">Enregistrer et saisir un similaire</button>'}</div></form>`);
  $('#fApp').addEventListener('change',()=>{ const a=APP[$('#fApp').value.trim()]; if(!a) return; if(!$('#fReg').value) $('#fReg').value=a[0];
    if(!id&&!v.typeManuel){ const r=document.querySelector(`#vf [name=type][value="${a[1]}"]`); if(r) r.checked=true; } });
  document.querySelectorAll('#vf [name=type]').forEach(r=>r.addEventListener('change',()=>v.typeManuel=true));
  const go=async sim=>{ const fm=$('#vf'); if(!fm.reportValidity()) return; const d={};
    for(const el of fm.querySelectorAll('[name]')){ if(el.type==='radio'){ if(el.checked) d[el.name]=el.value; } else if(el.type==='checkbox') d[el.name]=el.checked; else if(el.type==='number') d[el.name]=num(el.value); else d[el.name]=el.value.trim(); }
    d.qte=Math.max(0,parseInt(d.qte)||0); if(!id){ d.qteEntree=d.qte; if(v.photo) d.photo=v.photo; if(v.expert) d.expert=v.expert; }
    if(d.cave&&!R().caves.includes(d.cave)) R().caves.push(d.cave); if(R().derniereCave!==d.cave){ R().derniereCave=d.cave; R().majLe=now(); }
    const nid=await saveVin(id,d); toast(id?'Fiche mise à jour':'Vin ajouté à la cave');
    if(sim){ const c={...d}; delete c.photo; delete c.expert; c.millesime=''; c.qte=1; c.emplacement=''; openForm(c,'Même vin : changez le millésime, la quantité ou l’emplacement'); } else openFiche(nid); };
  $('#vf').onsubmit=e=>{ e.preventDefault(); go(false); }; const s=$('#saveSim'); if(s) s.onclick=()=>go(true); }

/* ================= Photo ================= */
function vignette(file){ return new Promise((ok,ko)=>{ const url=URL.createObjectURL(file), img=new Image();
  img.onload=()=>{ const m=320, s=Math.min(1,m/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg',.72)); };
  img.onerror=()=>ko(new Error('Image illisible')); img.src=url; }); }

/* ================= Claude (hors appli) ================= */
const SCHEMA='{"fiches":[{"id":"identifiant reçu","presentation":"2-3 phrases sur le domaine, l’appellation, le style","avis":"synthèse de ce qu’en disent guides et critiques, sans inventer de note précise","degustation":"profil attendu pour ce millésime","accords":["4 à 6 plats précis"],"aEviter":"accords à éviter","prix":{"min":0,"max":0,"commentaire":"prix public moyen constaté en France"},"garde":{"de":0,"apogee":0,"jusqua":0},"temperature":"ex. 15-16 °C","carafe":"conseil","fiabilite":"haute, moyenne ou faible"}]}';
function demande(L){ return `Tu es caviste et œnologue français expert, dans l'esprit du Guide Hachette des Vins. Nous sommes en ${Y}. Si tu peux chercher sur le web, vérifie les avis et les prix actuels.
Pour chacun des vins ci-dessous, rédige une fiche. Tiens compte du format pour la garde.
Vins : ${JSON.stringify(L.map(v=>({id:v.id,vin:label(v),producteur:v.producteur||'',millesime:v.millesime||'',couleur:(TY[v.type]||[])[1],appellation:v.appellation||'',region:v.region||'',cepages:v.cepages||'',format:v.format||''})))}
Réponds UNIQUEMENT par ce JSON, sans texte autour :
${SCHEMA}`; }
function openClaude(L){ if(!L.length){ toast('Toutes vos fiches sont déjà complètes'); return; }
  const txt=demande(L);
  openSheet(`<h2 style="font-size:30px">Compléter avec Claude</h2>
  <ol class="guide"><li>Copiez la demande (${L.length} vin${L.length>1?'s':''}).</li><li>Collez-la dans Claude (application ou claude.ai).</li><li>Copiez la réponse de Claude et collez-la ci-dessous.</li></ol>
  <pre class="prompt">${esc(txt)}</pre><div class="row"><button class="btn sec" id="cCopy">Copier la demande</button><a class="btn ghost" href="https://claude.ai/new" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;align-items:center">Ouvrir Claude</a></div>
  <label style="margin-top:14px">Réponse de Claude<textarea id="cRep" placeholder='{"fiches":[ … ]}'></textarea></label>
  <button class="btn" id="cGo" style="margin-top:10px">Enregistrer les fiches</button>`);
  $('#cCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(txt); toast('Demande copiée'); }catch(e){ toast('Copie impossible : sélectionnez le texte'); } };
  $('#cGo').onclick=async()=>{ try{ const n=await importerFiches($('#cRep').value); toast(n+' fiche(s) enregistrée(s)'); L.length===1?openFiche(L[0].id):closeSheet(); }catch(e){ toast('Réponse illisible : collez tout le JSON'); } }; }
async function importerFiches(t){ const a=t.indexOf('{'), b=t.lastIndexOf('}'); const j=JSON.parse(t.slice(a,b+1)); const L=Array.isArray(j.fiches)?j.fiches:[j]; let n=0;
  for(const x of L){ const v=S.vins.find(y=>y.id===x.id&&!y.supprime); if(!v) continue; const {id,...e}=x; e.date=today();
    const u={expert:e}; if(e.garde&&!v.de){ u.de=num(e.garde.de); u.apogee=num(e.garde.apogee); u.jusqua=num(e.garde.jusqua); }
    if(!v.temp&&e.temperature) u.temp=e.temperature; if(!v.carafe&&e.carafe) u.carafe=e.carafe; if(!v.accords&&Array.isArray(e.accords)) u.accords=e.accords.join(', ');
    Object.assign(v,u,{majLe:now()}); n++; }
  await persist(); renderAll(); return n; }

/* ================= Fichiers ================= */
const COLS=['nom','cuvee','millesime','type','producteur','appellation','region','cepages','format','degre','cave','emplacement','qte','prix','dateAchat','lieuAchat','contact','de','apogee','jusqua','guideNote','guideCC','guideEdition','guideComment','maNote','mesComments','temp','carafe','accords'];
const ENTETES={nom:'Nom',cuvee:'Cuvée',millesime:'Millésime',type:'Couleur',producteur:'Producteur',appellation:'Appellation',region:'Région',cepages:'Cépages',format:'Format',degre:'Degré',cave:'Cave',emplacement:'Emplacement',qte:'Quantité',prix:'Prix',dateAchat:'Date achat',lieuAchat:'Lieu achat',contact:'Contact',de:'Boire dès',apogee:'Apogée',jusqua:'Boire jusqu’en',guideNote:'Note Guide',guideCC:'Coup de cœur',guideEdition:'Édition Guide',guideComment:'Commentaire Guide',maNote:'Ma note',mesComments:'Mes commentaires',temp:'Température',carafe:'Carafage',accords:'Accords'};
const cell=x=>{ x=x===undefined||x===null||x===false?'':x===true?'oui':String(x); return /[";\n\r]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x; };
function csv(){ return [COLS.map(k=>ENTETES[k]).join(';'),...vins().map(v=>COLS.map(k=>k==='type'?(TY[v[k]]||[])[1]:k==='guideNote'?(v[k]?GUIDE[v[k]]:''):v[k]).map(cell).join(';'))].join('\n'); }
function parseCsv(t){ t=t.replace(/^﻿/,''); const sep=(t.split('\n')[0].match(/;/g)||[]).length>=(t.split('\n')[0].match(/,/g)||[]).length?';':','; const rows=[]; let row=[],c='',q=false;
  for(let i=0;i<t.length;i++){ const ch=t[i]; if(q){ if(ch==='"'){ if(t[i+1]==='"'){c+='"';i++;} else q=false; } else c+=ch; }
    else if(ch==='"') q=true; else if(ch===sep){ row.push(c); c=''; } else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&t[i+1]==='\n') i++; row.push(c); rows.push(row); row=[]; c=''; } else c+=ch; }
  if(c||row.length){ row.push(c); rows.push(row); } return rows.filter(r=>r.some(x=>x.trim())); }
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,'');
async function importCsv(file){ const rows=parseCsv(await file.text()); if(rows.length<2) throw new Error('Tableau vide');
  const idx={}; rows[0].forEach((h,i)=>{ const n=norm(h); const k=COLS.find(c=>norm(c)===n||norm(ENTETES[c])===n); if(k) idx[k]=i; });
  if(idx.nom===undefined) throw new Error('Colonne « Nom » introuvable');
  const tyByLabel=Object.fromEntries(TYPES.map(t=>[norm(t[1]),t[0]])), gByLabel=Object.fromEntries(Object.entries(GUIDE).map(([k,l])=>[l,k]));
  let n=0;
  for(const r of rows.slice(1)){ const g=k=>idx[k]!==undefined?(r[idx[k]]||'').trim():''; if(!g('nom')) continue;
    const v={}; for(const k of COLS){ const x=g(k); if(x==='') continue; v[k]=['millesime','degre','qte','prix','de','apogee','jusqua','guideEdition','maNote'].includes(k)?num(x):x; }
    v.type=tyByLabel[norm(v.type||'')]||TY[v.type]&&v.type||(APP[v.appellation]||[])[1]||'rouge';
    if(!v.region&&APP[v.appellation]) v.region=APP[v.appellation][0];
    v.guideNote=gByLabel[v.guideNote]??(GUIDE[v.guideNote]!==undefined?v.guideNote:''); v.guideCC=/^(oui|1|x|true|vrai|♥)/i.test(String(v.guideCC||''));
    v.qte=Math.max(0,parseInt(v.qte)||1); v.qteEntree=v.qte; if(!FORMATS.includes(v.format)) v.format='75 cl'; if(!v.cave) v.cave=R().caves[0];
    if(!R().caves.includes(v.cave)){ R().caves.push(v.cave); R().majLe=now(); }
    const t=now(); S.vins.push({id:uid(),creeLe:t,majLe:t,...v}); n++; }
  await persist(); renderAll(); return n; }
function telecharger(nom, texte, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([texte],{type})); a.download=nom; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000); }

/* ================= Navigation et événements ================= */
const VIEWS=['cave','boire','ajout','reglages'];
function show(v){ if(!VIEWS.includes(v)) v='cave'; document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v)); document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v)); if(location.hash!=='#'+v) history.replaceState(null,'','#'+v); scrollTo(0,0); if(v==='boire') occasion(); }
document.querySelector('.tabs').onclick=e=>{ const b=e.target.closest('button'); if(b) show(b.dataset.v); };
addEventListener('hashchange',()=>show(location.hash.slice(1)));
document.addEventListener('click',e=>{ const q=e.target.closest('.qb[data-q]'); if(q){ e.stopPropagation(); if(!q.disabled) quick(q.dataset.id,+q.dataset.q); return; } const c=e.target.closest('.card[data-id]'); if(c) openFiche(c.dataset.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.matches&&e.target.matches('.card[data-id]')) openFiche(e.target.dataset.id); });
$('#xs').onclick=closeSheet; $('#sheet').onclick=e=>{ if(e.target.id==='sheet') closeSheet(); };
addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#sheet').hidden) closeSheet(); });
$('#q').oninput=()=>{ show('cave'); renderCave(); }; $('#tri').onchange=renderCave;
$('#tForm').onclick=()=>openForm();
$('#tClaude').onclick=()=>openClaude(vins().filter(v=>!v.expert));
$('#photo').onchange=async e=>{ const fl=e.target.files[0]; e.target.value=''; if(!fl) return; try{ openForm({photo:await vignette(fl)},'Photo ajoutée : complétez la fiche'); }catch(er){ toast(er.message); } };
$('#csvF').onchange=async e=>{ const fl=e.target.files[0]; e.target.value=''; if(!fl) return; try{ const n=await importCsv(fl); $('#ajRes').innerHTML=`<p class="warn">${n} vin(s) importé(s).</p>`; toast(n+' vin(s) importé(s)'); }catch(er){ $('#ajRes').innerHTML=`<p class="warn">${esc(er.message)}</p>`; } };
$('#modele').onclick=()=>telecharger('modele-ma-cave.csv','﻿'+COLS.map(k=>ENTETES[k]).join(';')+'\nDomaine Bernard Baudry;Les Grézeaux;2019;Rouge;Bernard Baudry;Chinon;Loire, France;Cabernet franc;75 cl;13;Cave principale;Casier B2;6;18;2024-03-10;Cave du marché;;2023;2027;2032;★★;non;;;;;15-16 °C;1 h en carafe;Agneau, volaille rôtie\n','text/csv');
$('#goOcc').onclick=occasion; $('#plat').onkeydown=e=>{ if(e.key==='Enter') occasion(); };
$('#addCave').onclick=async()=>{ const c=$('#newCave').value.trim(); if(c&&!R().caves.includes(c)){ R().caves.push(c); $('#newCave').value=''; await saveR(); toast('Cave ajoutée'); } };
$('#cavesList').onclick=async e=>{ const b=e.target.closest('[data-c]'); if(!b) return; if(R().caves.length<2){ toast('Gardez au moins une cave'); return; } R().caves=R().caves.filter(c=>c!==b.dataset.c); await saveR(); };
$('#saveS').onclick=async()=>{ R().budget=num($('#sBudget').value)||15; R().exception=num($('#sExc').value)||40; await saveR(); toast('Réglages enregistrés'); };
$('#cid').onchange=()=>{ localStorage.setItem('mc_cid',$('#cid').value.trim()); toast('Identifiant enregistré'); };
const gErr=e=>{ $('#gMsg').textContent=e.message; Sync.status('err','Drive : erreur'); };
$('#gConn').onclick=()=>{ localStorage.setItem('mc_cid',$('#cid').value.trim()); Sync.connect().then(()=>toast('Google Drive relié')).catch(gErr); };
$('#gSync').onclick=()=>{ (Sync.valid()?Sync.sync():Sync.connect()).catch(gErr); };
$('#syncBtn').onclick=()=>{ if(!Sync.cid()){ show('reglages'); return; } (Sync.valid()?Sync.sync():Sync.connect()).catch(gErr); };
$('#gSheet').onclick=async()=>{ try{ const u=await Sync.sheet(); $('#gMsg').innerHTML=`Copie créée : <a href="${esc(u)}" target="_blank" rel="noopener">ouvrir dans Google Sheets</a>`; }catch(e){ gErr(e); } };
$('#dJson').onclick=()=>{ telecharger(`ma-cave-sauvegarde-${today()}.json`,JSON.stringify(payload()),'application/json'); $('#fMsg').textContent='Sauvegarde téléchargée.'; };
$('#dCsv').onclick=()=>telecharger(`ma-cave-${today()}.csv`,'﻿'+csv(),'text/csv');
$('#share').onclick=async()=>{ const fl=new File([JSON.stringify(payload())],`ma-cave-sauvegarde-${today()}.json`,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[fl]})){ try{ await navigator.share({files:[fl],title:'Sauvegarde Ma Cave'}); }catch(e){} } else $('#fMsg').textContent='Le partage de fichier n’est pas disponible ici : utilisez « Sauvegarde complète ».'; };
$('#impF').onchange=async e=>{ const fl=e.target.files[0]; e.target.value=''; if(!fl) return;
  try{ const j=JSON.parse(await fl.text()); if(!Array.isArray(j.vins)) throw new Error('Fichier non reconnu');
    const t=now(); (j.vins||[]).forEach(v=>{ if(!v.majLe) v.majLe=t; }); (j.degustations||[]).forEach(d=>{ if(!d.majLe) d.majLe=t; });
    const avant=vins().length; merge(j); await persist(); renderAll(); $('#fMsg').textContent=`Fusion faite : ${vins().length-avant} nouveau(x) vin(s), fiches plus récentes mises à jour.`; }
  catch(er){ $('#fMsg').textContent='Restauration impossible : '+er.message; } };
addEventListener('online',()=>Sync.sync());
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ const l=localStorage.getItem('mc_last'); if(!l||Date.now()-new Date(l)>60000) Sync.sync(); } });

/* ================= Démarrage ================= */
(async()=>{
  try{ await idb.open(); const st=await idb.get('state'); if(st) S={vins:st.vins||[],degustations:st.degustations||[],reglages:{...DEF_R,...(st.reglages||{})}}; }
  catch(e){ $('#alerte').innerHTML='<p class="warn">Stockage indisponible sur ce navigateur (navigation privée ?) : rien ne sera conservé.</p>'; }
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  Sync.restore(); show(location.hash.slice(1)||'cave'); renderAll(); Sync.sync();
  if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
}
