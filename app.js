let currentDay='day1', currentPhotoStep='general';
const photoURLCache=new Map();

async function init(){
  await openDB();
  renderTabs();
  renderApp();
  await loadFreeSteps();
  await showDay((await kvGet('currentDay'))||'day1');
  await updateStats();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
function renderTabs(){
 const tabs=document.getElementById('tabs'); tabs.innerHTML='';
 [...DATA.map(d=>[d.id,d.label]),['lexique','Lexique'],['infos','Infos']].forEach(([id,label])=>{
  const b=document.createElement('button'); b.textContent=label; b.onclick=()=>showDay(id); b.id='tab-'+id; tabs.appendChild(b);
 });
}
function renderApp(){
 const app=document.getElementById('app'); app.innerHTML='';
 DATA.forEach(day=>app.appendChild(renderDay(day)));
 app.appendChild(renderLexique());
 app.appendChild(renderInfos());
}
function renderDay(day){
 const sec=document.createElement('section'); sec.className='day'; sec.id=day.id;
 sec.innerHTML=`<div class="card"><h2>${esc(day.title)}</h2>${day.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}<div class="note">${esc(day.note)}</div></div><div class="timeline" id="tl-${day.id}"></div>`;
 const tl=sec.querySelector('.timeline');
 day.steps.forEach(st=>tl.appendChild(renderStep(st,day.id,false)));
 return sec;
}
function renderStep(st,dayId,manual){
 const div=document.createElement('div'); div.className='step'+(manual?' manual':''); div.dataset.id=st.id; div.dataset.day=dayId;
 div.innerHTML=`<div class="time">${esc(st.time||'')}</div><div class="stepBox">
  <div class="stepHead"><div class="stepTitle">${esc(st.title)}</div><input class="check" type="checkbox"></div>
  <div class="meta">${esc(st.meta||'')}</div>
  <div class="actions">
   ${(st.actions||[]).map(a=>`<a class="btn ${a[2]==='site'?'secondary':''}" target="_blank" href="${a[1]}">${esc(a[0])}</a>`).join('')}
   ${st.tour?`<button class="btn info" onclick="openTour('${st.tour}')">ℹ️ Infos tourisme</button>`:''}
   <button class="btn secondary" onclick="openPhotos('${st.id}')">📸 Photo</button>
   ${manual?`<button class="btn danger" onclick="deleteManualStep('${st.id}')">Supprimer</button>`:''}
  </div>
  <div class="photoStrip" id="strip-${st.id}"></div>
  <div class="comment"><label>📝 Commentaire souvenir</label><textarea placeholder="Note personnelle sur cette étape..."></textarea></div>
 </div>`;
 const cb=div.querySelector('.check');
 const ta=div.querySelector('textarea');
 hydrateStepState(st.id, div, cb, ta);
 cb.onchange=async()=>{await kvSet('done-'+st.id,cb.checked);div.classList.toggle('done',cb.checked);await updateStats();};
 ta.oninput=debounce(async()=>{await kvSet('comment-'+st.id,ta.value);await updateStats();},250);
 renderStrip(st.id);
 return div;
}
async function hydrateStepState(id, div, cb, ta){
 const done=await kvGet('done-'+id,false); cb.checked=!!done; div.classList.toggle('done',!!done);
 ta.value=await kvGet('comment-'+id,'');
}
function renderLexique(){
 const sec=document.createElement('section'); sec.className='day'; sec.id='lexique';
 sec.innerHTML='<div class="card"><h2>Lexique français / italien</h2><div class="note">Phrases courantes à montrer ou lire sur place.</div><div id="lexList"></div></div>';
 sec.querySelector('#lexList').innerHTML=LEXIQUE.map(p=>`<div class="phrase"><div class="fr">${esc(p[0])}</div><div class="it">${esc(p[1])}</div>${p[2]?`<div class="pron">${esc(p[2])}</div>`:''}</div>`).join('');
 return sec;
}
function renderInfos(){
 const sec=document.createElement('section'); sec.className='day'; sec.id='infos';
 sec.innerHTML='<div class="card"><h2>Infos pratiques</h2><h3>Stockage photos</h3><p>Les photos sont stockées dans IndexedDB sous forme de Blob, beaucoup plus adapté que localStorage sur mobile.</p><h3>Stationnement</h3><p>🟦 Lignes bleues : payant · ⬜ lignes blanches : gratuit ou limité · 🟨 lignes jaunes : réservé.</p><h3>Sans gluten</h3><p><b>Avete opzioni senza glutine?</b> = Avez-vous des options sans gluten ?</p></div>';
 return sec;
}
async function showDay(id){currentDay=id;document.querySelectorAll('.day').forEach(x=>x.classList.remove('active'));document.getElementById(id)?.classList.add('active');document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));document.getElementById('tab-'+id)?.classList.add('active');await kvSet('currentDay',id);window.scrollTo(0,0)}
async function openMenu(){await updateStats();menuOverlay.classList.add('open')}
function closeMenu(){menuOverlay.classList.remove('open')}
async function updateStats(){
 const kv=await idbAll('kv');
 const done=kv.filter(x=>x.key.startsWith('done-')&&x.value).length;
 const notes=kv.filter(x=>x.key.startsWith('comment-')&&String(x.value||'').trim()).length;
 const photos=(await idbAll('photos')).length;
 stDone.textContent=done;stPhotos.textContent=photos;stNotes.textContent=notes;
}
async function openPhotos(id){currentPhotoStep=id;photoTitle.textContent=id==='general'?'Photos souvenir du voyage':'Photos de cette étape';await renderPhotoGrid();photoModal.classList.add('open')}
function closePhotos(){photoModal.classList.remove('open')}
function pickCamera(){cameraInput.onchange=()=>handleFiles(cameraInput.files);cameraInput.value='';cameraInput.click()}
function pickGallery(){galleryInput.onchange=()=>handleFiles(galleryInput.files);galleryInput.value='';galleryInput.click()}
async function handleFiles(files){
 if(!files?.length)return;
 for(const f of files){
  const blob=await compressToBlob(f,1200,.78);
  await idbPut('photos',{id:'photo-'+Date.now()+'-'+Math.random().toString(16).slice(2),stepId:currentPhotoStep,blob,date:new Date().toISOString(),favorite:false,name:f.name||'photo.jpg'});
 }
 await renderPhotoGrid(); await renderStrip(currentPhotoStep); await updateStats();
}
function compressToBlob(file,max,quality){
 return new Promise((res,rej)=>{
  const r=new FileReader(); r.onload=()=>{const img=new Image(); img.onload=()=>{
   let w=img.width,h=img.height;if(Math.max(w,h)>max){const ratio=max/Math.max(w,h);w=Math.round(w*ratio);h=Math.round(h*ratio)}
   const c=document.createElement('canvas'); c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
   c.toBlob(b=>res(b),'image/jpeg',quality);
  }; img.onerror=rej; img.src=r.result}; r.onerror=rej; r.readAsDataURL(file);
 });
}
function objectURL(photo){if(photoURLCache.has(photo.id))return photoURLCache.get(photo.id);const url=URL.createObjectURL(photo.blob);photoURLCache.set(photo.id,url);return url}
async function getPhotos(stepId){return (await idbIndexAll('photos','stepId',stepId)).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
async function renderStrip(stepId){
 const el=document.getElementById('strip-'+stepId); if(!el)return;
 const arr=(await getPhotos(stepId)).slice(-10);
 el.innerHTML=arr.map(p=>`<img class="thumb ${p.favorite?'favorite':''}" src="${objectURL(p)}">`).join('');
}
async function renderPhotoGrid(){
 const arr=await getPhotos(currentPhotoStep);
 photoGrid.innerHTML=arr.length?'':'<div class="note">Aucune photo.</div>';
 arr.forEach((p,i)=>{
  const c=document.createElement('div'); c.className='photoCard';
  c.innerHTML=`<img src="${objectURL(p)}"><div class="actions"><button class="btn secondary ${p.favorite?'photoFav':''}">${p.favorite?'⭐ Favorite':'☆ Favorite'}</button><button class="btn danger">Supprimer</button></div>`;
  c.querySelectorAll('button')[0].onclick=async()=>{for(const x of arr){x.favorite=(x.id===p.id);await idbPut('photos',x)} await renderPhotoGrid(); await renderStrip(currentPhotoStep)};
  c.querySelectorAll('button')[1].onclick=async()=>{await idbDelete('photos',p.id); await renderPhotoGrid(); await renderStrip(currentPhotoStep); await updateStats()};
  photoGrid.appendChild(c);
 });
}
function openStepModal(){newStepDay.value=currentDay.startsWith('day')?currentDay:'day4';newStepTitle.value='';newStepComment.value='';stepModal.classList.add('open')}
function closeStepModal(){stepModal.classList.remove('open')}
async function addManualStep(){
 const title=newStepTitle.value.trim(); if(!title)return alert('Nom de l’étape obligatoire.');
 const st={id:'free-'+Date.now(),dayId:newStepDay.value,time:newStepTime.value.trim(),title,meta:newStepComment.value.trim()||'Étape ajoutée manuellement.',actions:[],manual:true};
 await idbPut('steps',st);
 document.getElementById('tl-'+st.dayId).appendChild(renderStep(st,st.dayId,true));
 if(newStepComment.value.trim())await kvSet('comment-'+st.id,newStepComment.value.trim());
 closeStepModal(); await showDay(st.dayId); await updateStats();
}
async function loadFreeSteps(){const all=await idbAll('steps');all.forEach(st=>document.getElementById('tl-'+st.dayId)?.appendChild(renderStep(st,st.dayId,true)))}
async function deleteManualStep(id){if(!confirm('Supprimer cette étape ?'))return;document.querySelector(`.step[data-id="${id}"]`)?.remove();await idbDelete('steps',id);await kvSet('comment-'+id,'');const photos=await getPhotos(id);for(const p of photos)await idbDelete('photos',p.id);await updateStats()}
function openTour(k){const t=TOURS[k];if(!t)return;tourTitle.textContent=t.title;tourIntro.textContent=t.intro;tourBody.innerHTML=t.blocks.map(b=>`<div class="tourBlock"><p>${esc(b)}</p></div>`).join('');tourModal.classList.add('open')}
function closeTour(){tourModal.classList.remove('open')}
async function buildExport(){
 const steps=[...document.querySelectorAll('.step')];
 const checked=[];
 for(const st of steps){ if(await kvGet('done-'+st.dataset.id,false)) checked.push(st); }
 if(!checked.length)return alert('Coche au moins une étape.');
 const gen=await getPhotos('general');
 let out=`<div class="cover"><h1>Lac de Côme</h1><p>29 juillet → 2 août 2026</p><p>Camping Magic Lake – Dongo</p><p>${checked.length} étapes réalisées</p>`;
 if(gen.length){out+='<div class="exportSouvenirs">'; for(const p of gen.slice(0,8)){out+=`<img src="${await blobToDataURL(p.blob)}">`;} out+='</div>'}
 out+='</div>';
 let cur='';
 for(const st of checked){
  const day=st.closest('.day').querySelector('.card h2')?.textContent||''; if(day!==cur){cur=day;out+=`<section class="exportDay"><h2>${esc(day)}</h2></section>`}
  const id=st.dataset.id,title=st.querySelector('.stepTitle').textContent,time=st.querySelector('.time').textContent,photos=await getPhotos(id);
  const fav=photos.find(p=>p.favorite)||photos[0]; const ordered=fav?[fav,...photos.filter(p=>p.id!==fav.id)]:photos;
  out+=`<article class="exportStep"><h3>✔ ${esc(title)}</h3><div><b>Heure prévue :</b> ${esc(time)}</div>`;
  if(ordered.length){out+='<div class="exportPhotos">'; let i=0; for(const p of ordered){out+=`<img class="${i++===0?'main':''}" src="${await blobToDataURL(p.blob)}">`;} out+='</div>'}
  const comment=await kvGet('comment-'+id,''); if(comment)out+=`<div class="exportComment">${esc(comment)}</div>`;
  out+='</article>';
 }
 exportPanel.innerHTML=out; document.body.classList.add('exportMode');
}
function exitExport(){document.body.classList.remove('exportMode')}
function downloadExportHTML(){const blob=new Blob(['<!doctype html><meta charset="utf-8"><title>Carnet</title>'+exportPanel.outerHTML],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='carnet-lac-de-come.html';a.click()}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
init();
