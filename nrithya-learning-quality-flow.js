(function(){
'use strict';

const U='https://blsbezkugmentlgnsmwq.supabase.co';
const K='sb_publishable_mEjNb7XSZT1tmC4a93to7w_PaYiNCYO';
let T=(new URLSearchParams(location.search).get('access')||'').trim();
let ctx=null, teachers=[], workLogs=[], improvements=[], currentTeacher=null;
let founderRange={mode:'week',from:null,to:null};
let founderFilters={teacher_id:null,activity_type:null,status:null};

const activityTypes=[
  'Class / Recording Review','Feedback Given','Recheck','Syllabus / Material Work',
  'Shikshaka Handbook Follow-up','Assignment / Homework Review','Teacher Support','Other Learning Quality Work'
];
const improvementAreas=[
  'Syllabus Adherence','Shikshaka Handbook','Technical Accuracy','Teaching Clarity','Class Pace',
  'Student Engagement','Class Structure','Assignment / Practice','Study Material','Communication','Other'
];
const improvementStatuses=['Observed','Feedback Given','Waiting for Implementation','Recheck Due','Improved','Closed'];
const blockerTypes=['Waiting for teacher','Waiting for recording','Need founder decision','Need team support','Technical issue','Other'];

const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>{if(!v)return '—'; const d=new Date(v+'T00:00:00'); return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});};
const fmtDateTime=v=>{if(!v)return '—'; return new Date(v).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});};
const fmtMinutes=n=>{n=Number(n||0); if(!n)return '0 min'; const h=Math.floor(n/60),m=n%60; return h?(h+'h'+(m?' '+m+'m':'')):(m+' min');};
const today=()=>ctx&&ctx.today?ctx.today:new Date().toISOString().slice(0,10);

function rpc(name,args){
  return fetch(U+'/rest/v1/rpc/'+name,{
    method:'POST',cache:'no-store',
    headers:{apikey:K,'Content-Type':'application/json'},
    body:JSON.stringify(args||{})
  }).then(async r=>{
    const txt=await r.text(); let data=null;
    if(txt){try{data=JSON.parse(txt)}catch(_){data=txt}}
    if(!r.ok) throw new Error(data&&data.message?data.message:'Request failed');
    return data;
  });
}
function toast(msg){
  const x=$('#toast'); x.textContent=msg; x.classList.remove('hide');
  clearTimeout(toast.t); toast.t=setTimeout(()=>x.classList.add('hide'),2200);
}
function setMain(html){$('#main').innerHTML=html; window.scrollTo({top:0,behavior:'instant'});}
function statusBadge(s){
  let c='review';
  if(s==='Stable'||s==='Closed'||s==='Improved')c='stable';
  if(s==='Recheck Due'||s==='Review Due')c='due';
  return '<span class="badge '+c+'">'+esc(s||'—')+'</span>';
}
function closeModal(){ $('#modalBack').classList.add('hide'); $('#modal').innerHTML=''; }
function openModal(html){
  $('#modal').innerHTML=html; $('#modalBack').classList.remove('hide');
  const x=$('#modalClose'); if(x)x.onclick=closeModal;
}
$('#modalBack').addEventListener('click',e=>{if(e.target.id==='modalBack')closeModal()});
$('#refreshBtn').onclick=()=>refreshCurrent();
$('#homeBtn').onclick=()=>renderHome();

async function init(){
  if(!T){showError('This private link is incomplete.');return}
  try{
    const c=await rpc('lq_access_context',{p_token:T});
    ctx=(c||[])[0];
    if(!ctx)throw new Error('Access could not be verified.');
    teachers=await rpc('lq_list_teachers',{p_token:T})||[];
    $('#loading').classList.add('hide'); $('#app').classList.remove('hide');
    renderHome();
  }catch(e){showError(e.message||String(e))}
}
function showError(msg){
  $('#loading').classList.add('hide'); $('#app').classList.add('hide');
  $('#errorText').textContent=msg; $('#errorScreen').classList.remove('hide');
}
async function reloadTeachers(){ teachers=await rpc('lq_list_teachers',{p_token:T})||[]; }
async function refreshCurrent(){
  try{await reloadTeachers(); renderHome(); toast('Updated');}catch(e){toast(e.message||'Could not refresh')}
}

function renderHome(){
  currentTeacher=null; $('#homeBtn').classList.add('hide');
  if(ctx.access_role==='founder') renderFounder();
  else renderAnjanaHome();
}

/* ---------- ANJANA ---------- */
async function renderAnjanaHome(){
  const d=today();
  let rechecks=[], open=[];
  try{
    const all=await rpc('lq_list_improvements',{p_token:T,p_teacher_id:null,p_status:null,p_from:null,p_to:null})||[];
    improvements=all;
    rechecks=all.filter(x=>x.status==='Recheck Due'||(x.recheck_date&&x.recheck_date<=d&&!['Improved','Closed'].includes(x.status)));
    open=all.filter(x=>!['Closed'].includes(x.status)).slice(0,8);
  }catch(_){}
  setMain(`
    <section class="hero">
      <h1>Hello Anjana</h1>
      <p>Learning quality work, in one calm place.</p>
      <div class="date-line">${fmtDate(d)}</div>
    </section>
    <section class="action-grid">
      <button id="addWorkHome" class="big-action primary">+ Add Today's Work<small>Log one useful piece of work in under a minute</small></button>
      <button id="teachersHome" class="big-action">Teachers<small>Reviews, follow-ups and improvement history</small></button>
      <button id="todayHome" class="big-action">Today's Work<small>See or edit what you logged today</small></button>
      <button id="reportHome" class="big-action warm">Generate Daily Report<small>Build a WhatsApp-ready update automatically</small></button>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Rechecks Due</h2><p>Feedback is not complete until the change is rechecked.</p></div></div>
      <div class="card list">${renderImprovementRows(rechecks,true)}</div>
    </section>
    <section class="section">
      <div class="section-head"><div><h2>Open Follow-ups</h2><p>Only the items that still need a next step.</p></div></div>
      <div class="card list">${renderImprovementRows(open,true)}</div>
    </section>
  `);
  $('#addWorkHome').onclick=()=>openWorkModal();
  $('#teachersHome').onclick=()=>renderTeachers();
  $('#todayHome').onclick=()=>renderTodayWork();
  $('#reportHome').onclick=()=>renderDailyReport();
  bindImprovementClicks();
}
function renderImprovementRows(rows,compact){
  if(!rows.length)return '<div class="empty">Nothing pending here.</div>';
  return rows.map(x=>`
    <div class="list-row">
      <div class="row-main">
        <button class="linklike imp-open" data-id="${x.improvement_id}">${esc(x.teacher_name)} · ${esc(x.improvement_area)}</button>
        <div class="row-sub">${esc(x.short_observation)}${x.recheck_date?' · Recheck '+fmtDate(x.recheck_date):''}</div>
      </div>
      ${statusBadge(x.status)}
    </div>`).join('');
}
function teacherOptions(selected,allowGeneral){
  let s=allowGeneral?'<option value="">General / no teacher</option>':'<option value="">Select teacher</option>';
  s+=teachers.filter(t=>t.active).map(t=>`<option value="${t.teacher_id}" ${String(selected||'')===String(t.teacher_id)?'selected':''}>${esc(t.teacher_name)}${t.program_subject?' · '+esc(t.program_subject):''}</option>`).join('');
  return s;
}
function activityOptions(selected){return activityTypes.map(x=>`<option ${x===selected?'selected':''}>${esc(x)}</option>`).join('')}
function areaOptions(selected){return improvementAreas.map(x=>`<option ${x===selected?'selected':''}>${esc(x)}</option>`).join('')}
function statusOptions(selected){return improvementStatuses.map(x=>`<option ${x===selected?'selected':''}>${esc(x)}</option>`).join('')}
function blockerOptions(selected){return '<option value="">No blocker</option>'+blockerTypes.map(x=>`<option ${x===selected?'selected':''}>${esc(x)}</option>`).join('')}

function openWorkModal(log){
  const edit=!!log;
  openModal(`
    <div class="modal-head">
      <div><h2>${edit?'Edit Today\'s Work':'Add Today\'s Work'}</h2><p>${fmtDate(edit?log.work_date:today())}</p></div>
      <button id="modalClose" class="icon-btn">×</button>
    </div>
    <div class="form-grid">
      <div class="field"><label>Teacher</label><select id="wTeacher">${teacherOptions(log&&log.teacher_id,true)}</select></div>
      <div class="field"><label>Activity Type</label><select id="wActivity">${activityOptions(log&&log.activity_type||'Class / Recording Review')}</select></div>
      <div class="field full"><label>What I Did</label><textarea id="wDid" placeholder="Example: Reviewed 2 classes. Explanation is too fast in theoretical section.">${esc(log&&log.what_i_did||'')}</textarea></div>
      <div class="field full"><label>Next Step / Follow-up</label><textarea id="wNext" placeholder="What should happen next?">${esc(log&&log.next_step||'')}</textarea></div>
      <div id="recordingField" class="field"><label>Classes / recordings reviewed</label><input id="wCount" type="number" min="0" max="100" value="${log?Number(log.recording_count||0):1}"></div>
      <div class="field"><label>Time Spent</label>
        <select id="wTime">
          <option value="">Not added</option>
          ${[15,30,45,60,90,120].map(n=>`<option value="${n}" ${log&&Number(log.effort_minutes)===n?'selected':''}>${n} min</option>`).join('')}
          <option value="custom" ${log&&log.effort_minutes&&![15,30,45,60,90,120].includes(Number(log.effort_minutes))?'selected':''}>Custom</option>
        </select>
        <input id="wCustomTime" class="${log&&log.effort_minutes&&![15,30,45,60,90,120].includes(Number(log.effort_minutes))?'':'hide'}" type="number" min="1" max="1440" value="${log&&log.effort_minutes||''}" placeholder="Minutes" style="margin-top:7px">
      </div>
    </div>
    <details class="details">
      <summary>Add observation, blocker or other note</summary>
      <div class="field"><label>Observation / Improvement Point</label><textarea id="wObservation">${esc(log&&log.observation||'')}</textarea></div>
      <div class="form-grid">
        <div class="field"><label>Blocker</label><select id="wBlocker">${blockerOptions(log&&log.blocker_type)}</select></div>
        <div class="field"><label>Blocker note</label><input id="wBlockerNote" value="${esc(log&&log.blocker_note||'')}" placeholder="Short detail only if needed"></div>
      </div>
      <div class="field"><label>Anything affecting today's work? <span class="small-note">(optional)</span></label><input id="wAffect" value="${esc(log&&log.work_affecting_note||'')}" placeholder="Waiting for recording, need founder decision, low work capacity today..."></div>
    </details>
    ${edit?'':`
      <label class="checkline"><input id="wCreateImp" type="checkbox"><span><b>Create an improvement item from this work</b><br><span class="small-note">Use this only when a teacher needs a change that should be followed through and rechecked.</span></span></label>
      <div id="wImpFields" class="hide">
        <div class="form-grid">
          <div class="field"><label>Improvement Area</label><select id="wImpArea">${areaOptions('Teaching Clarity')}</select></div>
          <div class="field"><label>Status</label><select id="wImpStatus">${statusOptions('Observed')}</select></div>
          <div class="field full"><label>Short Observation</label><textarea id="wImpObs"></textarea></div>
          <div class="field full"><label>Feedback / Action Suggested</label><textarea id="wImpFeedback"></textarea></div>
          <div class="field"><label>Recheck Date <span class="small-note">(optional)</span></label><input id="wRecheck" type="date"></div>
        </div>
      </div>`}
    <div id="wMsg" class="msg"></div>
    <div class="modal-actions"><button id="wCancel">Cancel</button><button id="wSave" class="primary">${edit?'Save Changes':'Save Work'}</button></div>
  `);
  $('#wCancel').onclick=closeModal;
  $('#wActivity').onchange=toggleRecording;
  $('#wTime').onchange=()=>$('#wCustomTime').classList.toggle('hide',$('#wTime').value!=='custom');
  if(!edit){
    $('#wCreateImp').onchange=()=>{
      const on=$('#wCreateImp').checked; $('#wImpFields').classList.toggle('hide',!on);
      if(on&&!$('#wImpObs').value.trim())$('#wImpObs').value=$('#wObservation').value.trim()||$('#wDid').value.trim();
    };
  }
  toggleRecording();
  $('#wSave').onclick=()=>saveWork(log);
}
function toggleRecording(){
  const show=['Class / Recording Review','Recheck'].includes($('#wActivity').value);
  $('#recordingField').classList.toggle('hide',!show);
}
function getMinutes(){
  const v=$('#wTime').value;
  if(!v)return null;
  if(v==='custom')return Number($('#wCustomTime').value||0)||null;
  return Number(v);
}
async function saveWork(log){
  const btn=$('#wSave'),msg=$('#wMsg');
  const teacher=$('#wTeacher').value?Number($('#wTeacher').value):null;
  const did=$('#wDid').value.trim(),next=$('#wNext').value.trim();
  if(!did||!next){msg.textContent='Please add What I Did and Next Step.';msg.className='msg err';return}
  const common={
    p_token:T,p_teacher_id:teacher,p_activity_type:$('#wActivity').value,p_what_i_did:did,p_next_step:next,
    p_observation:$('#wObservation').value.trim()||null,p_blocker_type:$('#wBlocker').value||null,
    p_blocker_note:$('#wBlockerNote').value.trim()||null,p_effort_minutes:getMinutes(),
    p_recording_count:$('#recordingField').classList.contains('hide')?0:Number($('#wCount').value||0),
    p_work_affecting_note:$('#wAffect').value.trim()||null
  };
  btn.disabled=true;msg.textContent='Saving...';msg.className='msg';
  try{
    if(log){
      await rpc('lq_update_work_log',Object.assign({p_log_id:Number(log.log_id)},common));
    }else{
      const make=$('#wCreateImp').checked;
      Object.assign(common,{
        p_create_improvement:make,
        p_improvement_area:make?$('#wImpArea').value:null,
        p_improvement_observation:make?($('#wImpObs').value.trim()||did):null,
        p_improvement_feedback:make?$('#wImpFeedback').value.trim()||null:null,
        p_improvement_status:make?$('#wImpStatus').value:'Observed',
        p_recheck_date:make?$('#wRecheck').value||null:null
      });
      await rpc('lq_add_work',common);
    }
    closeModal(); await reloadTeachers(); toast('Saved'); if(ctx.access_role==='founder')renderFounder();else renderAnjanaHome();
  }catch(e){msg.textContent=e.message||String(e);msg.className='msg err'}
  finally{btn.disabled=false}
}

async function renderTodayWork(){
  $('#homeBtn').classList.remove('hide');
  setMain(`<section class="hero"><h1>Today's Work</h1><p>${fmtDate(today())}</p></section><div class="card"><div class="empty">Loading...</div></div>`);
  try{
    workLogs=await rpc('lq_list_work_logs',{p_token:T,p_from:today(),p_to:today(),p_teacher_id:null,p_activity_type:null})||[];
    setMain(`
      <section class="hero"><h1>Today's Work</h1><p>${fmtDate(today())}</p></section>
      <div class="section-head"><div><h2>${workLogs.length} ${workLogs.length===1?'entry':'entries'}</h2></div><button id="addWorkToday" class="primary">+ Add Work</button></div>
      <div class="card list">${workLogs.length?workLogs.map(w=>`
        <div class="list-row">
          <div class="row-main"><div class="row-title">${esc(w.teacher_name||'General work')} · ${esc(w.activity_type)}</div>
          <div class="row-sub">${esc(w.what_i_did)}${w.effort_minutes?' · '+fmtMinutes(w.effort_minutes):''}${w.blocker_open?' · Blocker: '+esc(w.blocker_type):''}</div></div>
          <button class="edit-work" data-id="${w.log_id}">Edit</button>
        </div>`).join(''):'<div class="empty">No work added yet today.</div>'}</div>
    `);
    $('#addWorkToday').onclick=()=>openWorkModal();
    document.querySelectorAll('.edit-work').forEach(b=>b.onclick=()=>openWorkModal(workLogs.find(x=>String(x.log_id)===b.dataset.id)));
  }catch(e){toast(e.message||'Could not load work')}
}

async function renderTeachers(){
  $('#homeBtn').classList.remove('hide'); await reloadTeachers();
  setMain(`
    <section class="hero"><h1>Teachers</h1><p>Open a teacher to see reviews, follow-ups and improvement history.</p></section>
    <div class="card list">
      ${teachers.filter(t=>t.active).length?teachers.filter(t=>t.active).map(t=>`
        <div class="list-row clickable teacher-open" data-id="${t.teacher_id}">
          <div class="row-main"><div class="row-title">${esc(t.teacher_name)}</div><div class="row-sub">${esc(t.program_subject||'Program not added')} · Last reviewed ${fmtDate(t.last_reviewed)}</div></div>
          ${statusBadge(t.current_review_status)}
        </div>`).join(''):'<div class="empty">Teacher Master is empty. The founder can add the current teachers.</div>'}
    </div>`);
  bindTeacherClicks();
}
function bindTeacherClicks(){document.querySelectorAll('.teacher-open').forEach(x=>x.onclick=()=>renderTeacherDetail(Number(x.dataset.id)))}
function bindImprovementClicks(){document.querySelectorAll('.imp-open').forEach(x=>x.onclick=()=>openImprovement(Number(x.dataset.id)))}

async function renderTeacherDetail(id){
  $('#homeBtn').classList.remove('hide');
  const t=teachers.find(x=>Number(x.teacher_id)===Number(id)); if(!t)return renderTeachers();
  currentTeacher=t;
  setMain(`<section class="hero"><h1>${esc(t.teacher_name)}</h1><p>Loading teacher history...</p></section>`);
  try{
    const [imps,timeline,areas]=await Promise.all([
      rpc('lq_list_improvements',{p_token:T,p_teacher_id:id,p_status:null,p_from:null,p_to:null}),
      rpc('lq_teacher_timeline',{p_token:T,p_teacher_id:id}),
      rpc('lq_teacher_recurring_areas',{p_token:T,p_teacher_id:id})
    ]);
    improvements=imps||[];
    setMain(`
      <section class="hero"><div class="section-head"><div><h1>${esc(t.teacher_name)}</h1><p>${esc(t.program_subject||'Program not added')}</p></div>${statusBadge(t.current_review_status)}</div></section>
      <div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${stat('Last Reviewed',fmtDate(t.last_reviewed))}
        ${stat('Reviews',t.review_count)}
        ${stat('Open Improvements',t.open_improvements)}
        ${stat('Recheck Pending',t.recheck_pending)}
      </div>
      <section class="section">
        <div class="section-head"><div><h2>Improvement Loop</h2><p>Observation → Feedback → Correction → Recheck → Improved / Closed</p></div><button id="addImpTeacher" class="primary">+ Add Improvement</button></div>
        <div class="card list">${renderImprovementRows(improvements,false)}</div>
      </section>
      <section class="section split">
        <div>
          <div class="section-head"><div><h2>Improvement History</h2><p>Evidence of how quality moved over time.</p></div></div>
          <div class="card pad"><div class="timeline">${(timeline||[]).length?(timeline||[]).map(x=>`
            <div class="timeline-item"><div class="timeline-date">${fmtDateTime(x.event_at)}</div><div class="timeline-title">${esc(x.event_type)}</div><div class="timeline-text">${esc(x.detail||'')}</div></div>`).join(''):'<div class="empty">No history yet.</div>'}</div></div>
        </div>
        <div>
          <div class="section-head"><div><h2>Recurring Areas</h2><p>Useful for future teacher-wide training.</p></div></div>
          <div class="card pad metric-list">${(areas||[]).length?(areas||[]).map(a=>`<div class="metric-row"><span>${esc(a.improvement_area)}</span><b>${a.item_count}</b></div>`).join(''):'<div class="empty">No repeated areas yet.</div>'}</div>
        </div>
      </section>
    `);
    $('#addImpTeacher').onclick=()=>openImprovement(null,id);
    bindImprovementClicks();
  }catch(e){toast(e.message||'Could not load teacher')}
}
function stat(k,v,s){return `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v==null?'—':v)}</div>${s?`<div class="s">${esc(s)}</div>`:''}</div>`}

function openImprovement(id,teacherId){
  const item=id?(improvements.find(x=>Number(x.improvement_id)===Number(id))||null):null;
  if(id&&!item){
    rpc('lq_list_improvements',{p_token:T,p_teacher_id:null,p_status:null,p_from:null,p_to:null}).then(all=>{
      improvements=all||[];openImprovement(id,teacherId);
    }); return;
  }
  const edit=!!item,tid=edit?item.teacher_id:teacherId;
  openModal(`
    <div class="modal-head"><div><h2>${edit?'Update Improvement':'Add Improvement'}</h2><p>Close only after a recheck confirms the change.</p></div><button id="modalClose" class="icon-btn">×</button></div>
    <div class="form-grid">
      <div class="field"><label>Teacher</label><select id="iTeacher" ${edit?'disabled':''}>${teacherOptions(tid,false)}</select></div>
      <div class="field"><label>Improvement Area</label><select id="iArea">${areaOptions(edit?item.improvement_area:'Teaching Clarity')}</select></div>
      <div class="field full"><label>Short Observation</label><textarea id="iObs">${esc(edit?item.short_observation:'')}</textarea></div>
      <div class="field full"><label>Feedback / Action Suggested</label><textarea id="iFeedback">${esc(edit?item.feedback_action||'':'')}</textarea></div>
      <div class="field"><label>Status</label><select id="iStatus">${statusOptions(edit?item.status:'Observed')}</select></div>
      <div class="field"><label>Recheck Date</label><input id="iRecheck" type="date" value="${esc(edit?item.recheck_date||'':'')}"></div>
      <div id="finalResultField" class="field full"><label>Final Result <span class="small-note">(required to close)</span></label><textarea id="iFinal">${esc(edit?item.final_result||'':'')}</textarea></div>
    </div>
    <div class="callout">Feedback sent is not completion. Move the item to <b>Recheck Due</b>, then confirm <b>Improved</b> or <b>Closed</b> after the next class or recording is checked.</div>
    <div id="iMsg" class="msg"></div>
    <div class="modal-actions"><button id="iCancel">Cancel</button><button id="iSave" class="primary">Save</button></div>
  `);
  $('#iCancel').onclick=closeModal;
  $('#iSave').onclick=()=>saveImprovement(item);
}
async function saveImprovement(item){
  const msg=$('#iMsg'),btn=$('#iSave');
  const teacher=Number($('#iTeacher').value||0),obs=$('#iObs').value.trim();
  if(!teacher||!obs){msg.textContent='Please select a teacher and add the observation.';msg.className='msg err';return}
  btn.disabled=true;msg.textContent='Saving...';msg.className='msg';
  try{
    if(item){
      await rpc('lq_update_improvement',{
        p_token:T,p_improvement_id:Number(item.improvement_id),p_improvement_area:$('#iArea').value,p_short_observation:obs,
        p_feedback_action:$('#iFeedback').value.trim()||null,p_status:$('#iStatus').value,p_recheck_date:$('#iRecheck').value||null,p_final_result:$('#iFinal').value.trim()||null
      });
    }else{
      await rpc('lq_create_improvement',{
        p_token:T,p_teacher_id:teacher,p_improvement_area:$('#iArea').value,p_short_observation:obs,
        p_feedback_action:$('#iFeedback').value.trim()||null,p_status:$('#iStatus').value,p_recheck_date:$('#iRecheck').value||null
      });
    }
    closeModal();await reloadTeachers();toast('Saved');
    if(currentTeacher)renderTeacherDetail(currentTeacher.teacher_id);else renderHome();
  }catch(e){msg.textContent=e.message||String(e);msg.className='msg err'}
  finally{btn.disabled=false}
}

async function renderDailyReport(){
  $('#homeBtn').classList.remove('hide');
  setMain(`<section class="hero"><h1>Daily Report</h1><p>Built automatically from today's work.</p></section><div class="report-box">Generating...</div>`);
  try{
    const r=await rpc('lq_generate_daily_report',{p_token:T,p_report_date:today()}); const x=(r||[])[0]||{};
    setMain(`
      <section class="hero"><h1>Daily Report</h1><p>${fmtDate(x.report_date||today())}</p></section>
      <div id="reportText" class="report-box">${esc(x.report_text||'')}</div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button id="copyReport" class="primary">Copy Report</button>
        <button id="shareReport">Share / Copy for WhatsApp</button>
      </div>
      <p class="small-note">The report uses what was already logged today. No rewriting is needed.</p>
    `);
    const text=x.report_text||'';
    $('#copyReport').onclick=()=>copyText(text);
    $('#shareReport').onclick=async()=>{if(navigator.share){try{await navigator.share({text});return}catch(_){}}await copyText(text);toast('Copied for WhatsApp')};
  }catch(e){toast(e.message||'Could not generate report')}
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);toast('Copied')}catch(_){
    const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied');
  }
}

/* ---------- FOUNDER ---------- */
function dateRange(mode){
  const d=new Date(today()+'T00:00:00'); let a=new Date(d),b=new Date(d);
  if(mode==='week'){const day=(d.getDay()+6)%7;a.setDate(d.getDate()-day)}
  if(mode==='month'){a=new Date(d.getFullYear(),d.getMonth(),1)}
  const iso=x=>x.toISOString().slice(0,10);
  return {from:iso(a),to:iso(b)};
}
async function renderFounder(){
  $('#homeBtn').classList.add('hide');
  const r=founderRange.mode==='custom'&&founderRange.from&&founderRange.to?founderRange:dateRange(founderRange.mode);
  founderRange.from=r.from;founderRange.to=r.to;
  setMain(`<section class="hero"><h1>Founder Dashboard</h1><p>Are teachers being covered, and is quality actually moving?</p></section><div class="card"><div class="empty">Loading...</div></div>`);
  try{
    const args={p_token:T,p_from:r.from,p_to:r.to,p_teacher_id:founderFilters.teacher_id,p_activity_type:founderFilters.activity_type,p_status:founderFilters.status};
    const [m,logs,imps,times,blockers,reports,todayEffortLogs,weekEffortLogs,monthEffortLogs]=await Promise.all([
      rpc('lq_founder_metrics_filtered',args),
      rpc('lq_list_work_logs',{p_token:T,p_from:r.from,p_to:r.to,p_teacher_id:founderFilters.teacher_id,p_activity_type:founderFilters.activity_type}),
      rpc('lq_list_improvements',{p_token:T,p_teacher_id:founderFilters.teacher_id,p_status:founderFilters.status,p_from:null,p_to:null}),
      rpc('lq_time_by_type_filtered',{p_token:T,p_from:r.from,p_to:r.to,p_teacher_id:founderFilters.teacher_id,p_activity_type:founderFilters.activity_type}),
      rpc('lq_open_blockers',{p_token:T}),
      rpc('lq_list_daily_reports',{p_token:T,p_from:r.from,p_to:r.to}),
      rpc('lq_list_work_logs',{p_token:T,p_from:dateRange('today').from,p_to:dateRange('today').to,p_teacher_id:null,p_activity_type:null}),
      rpc('lq_list_work_logs',{p_token:T,p_from:dateRange('week').from,p_to:dateRange('week').to,p_teacher_id:null,p_activity_type:null}),
      rpc('lq_list_work_logs',{p_token:T,p_from:dateRange('month').from,p_to:dateRange('month').to,p_teacher_id:null,p_activity_type:null})
    ]);
    const x=(m||[])[0]||{};workLogs=logs||[];improvements=imps||[];
    const filteredTeachers=founderFilters.teacher_id?teachers.filter(t=>Number(t.teacher_id)===Number(founderFilters.teacher_id)):teachers;
    const coverage=filteredTeachers.filter(t=>t.active);
    const monthStart=today().slice(0,8)+'01';
    const monthLogs=await rpc('lq_list_work_logs',{p_token:T,p_from:monthStart,p_to:today(),p_teacher_id:null,p_activity_type:null})||[];
    const monthTouched=new Set(monthLogs.filter(w=>w.teacher_id).map(w=>String(w.teacher_id))).size;
    const activeTotal=teachers.filter(t=>t.active).length;
    const effortSum=rows=>(rows||[]).reduce((a,w)=>a+Number(w.effort_minutes||0),0);
    setMain(`
      <section class="hero">
        <h1>Founder Dashboard</h1>
        <p>Simple for Anjana. Clear for Midhun. Better learning quality for Nrithya.</p>
      </section>
      ${founderToolbar()}
      <section class="stats">
        ${stat('Active Teachers',x.active_teachers)}
        ${stat('Teachers Reviewed This Cycle',x.reviewed_this_cycle)}
        ${stat('Teachers Not Yet Reviewed',x.not_reviewed_this_cycle)}
        ${stat('Rechecks Pending',x.rechecks_pending)}
        ${stat('Open Improvements',x.open_improvements)}
        ${stat('Improvements Closed',x.closed_improvements)}
      </section>

      <section class="section">
        <div class="section-head"><div><h2>Teacher Coverage</h2><p>Default review cycle: ${ctx.review_cycle_days} days. Coverage is operational, not a performance score.</p></div><button id="addTeacherBtn" class="primary">+ Add Teacher</button></div>
        <div class="tablewrap"><table><thead><tr><th>TEACHER</th><th>LAST REVIEW</th><th>REVIEWS</th><th>OPEN ITEMS</th><th>RECHECK</th><th>CLOSED</th><th>STATUS</th><th></th></tr></thead><tbody>
        ${coverage.length?coverage.map(t=>`<tr><td><button class="linklike teacher-open" data-id="${t.teacher_id}">${esc(t.teacher_name)}</button><div class="row-sub">${esc(t.program_subject||'')}</div></td><td>${fmtDate(t.last_reviewed)}</td><td>${t.review_count}</td><td>${t.open_improvements}</td><td>${t.recheck_pending}</td><td>${t.closed_improvements}</td><td>${statusBadge(t.current_review_status)}</td><td><button class="edit-teacher" data-id="${t.teacher_id}">Edit</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">No teachers added yet.</td></tr>'}
        </tbody></table></div>
      </section>

      <section class="section">
        <div class="section-head"><div><h2>Quality Movement</h2><p>Outcome matters more than feedback quantity.</p></div></div>
        <div class="stats">
          ${stat('Improvement Items Created',x.improvement_items_created)}
          ${stat('Feedback Given',x.feedback_given)}
          ${stat('Rechecks Completed',x.rechecks_completed)}
          ${stat('Improvements Confirmed',x.improvements_confirmed)}
          ${stat('Items Closed',x.items_closed)}
          ${stat('Quality Closure Rate',(x.quality_closure_rate||0)+'%','Confirmed closed / items eligible for closure')}
        </div>
      </section>

      <section class="section split">
        <div>
          <div class="section-head"><div><h2>Open Quality Problems</h2><p>What remains open and what needs the next step.</p></div></div>
          <div class="card list">${renderImprovementRows(improvements.filter(i=>i.status!=='Closed'),false)}</div>
        </div>
        <div>
          <div class="section-head"><div><h2>Open Blockers</h2><p>No complicated escalation. Just the blocker and next action.</p></div></div>
          <div class="card list">${renderBlockers((blockers||[]).filter(b=>!founderFilters.teacher_id||b.teacher_name===((teachers.find(t=>Number(t.teacher_id)===Number(founderFilters.teacher_id))||{}).teacher_name)))}</div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><div><h2>Anjana - Work Contribution</h2><p>Objective facts only. No score or ranking.</p></div></div>
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:10px">
          ${stat('Today Logged Effort',fmtMinutes(effortSum(todayEffortLogs)))}
          ${stat('This Week Logged Effort',fmtMinutes(effortSum(weekEffortLogs)))}
          ${stat('This Month Logged Effort',fmtMinutes(effortSum(monthEffortLogs)))}
        </div>
        <div class="contribution-grid">
          ${stat('Teachers Worked With',x.teachers_worked_with)}
          ${stat('Classes / Recordings Reviewed',x.recordings_reviewed)}
          ${stat('Feedback Actions',x.feedback_actions)}
          ${stat('Rechecks Completed',x.recheck_actions)}
          ${stat('Improvements Closed',x.items_closed)}
          ${stat('Other Product Work',x.other_product_work)}
          ${stat('Blockers Raised',x.blockers_raised)}
          ${stat('Logged Effort',fmtMinutes(x.logged_effort_minutes))}
        </div>
        <div class="callout" style="margin-top:12px"><b>Teacher Coverage This Month:</b> ${monthTouched} of ${activeTotal} active teachers touched this month. This is operational coverage, not an Anjana score.</div>
      </section>

      <section class="section split">
        <div>
          <div class="section-head"><div><h2>Time by Work Type</h2><p>Capacity visibility, not required hours.</p></div></div>
          <div class="card pad metric-list">${(times||[]).length?(times||[]).map(v=>`<div class="metric-row"><span>${esc(v.activity_type)}</span><b>${fmtMinutes(v.effort_minutes)}</b></div>`).join(''):'<div class="empty">No effort time logged in this period.</div>'}</div>
        </div>
        <div>
          <div class="section-head"><div><h2>Recent Work</h2><p>What actually moved in the selected period.</p></div></div>
          <div class="card list">${workLogs.length?workLogs.slice(0,10).map(w=>`<div class="list-row"><div class="row-main"><div class="row-title">${esc(w.teacher_name||'General work')} · ${esc(w.activity_type)}</div><div class="row-sub">${esc(w.what_i_did)}${w.effort_minutes?' · '+fmtMinutes(w.effort_minutes):''}</div></div><button class="edit-work-founder" data-id="${w.log_id}">Edit</button></div>`).join(''):'<div class="empty">No work logged in this period.</div>'}</div>
        </div>
      </section>

      <section class="section">
        <details class="card pad"><summary>Daily Reports</summary><div style="margin-top:12px">${(reports||[]).length?(reports||[]).map(r=>`<div class="card pad" style="margin-top:8px"><div class="row-title">${fmtDate(r.report_date)}</div><div class="row-sub">Generated ${fmtDateTime(r.generated_at)}</div><div style="white-space:pre-wrap;margin-top:10px;font-size:12px">${esc(r.report_text)}</div></div>`).join(''):'<div class="empty">No reports generated in this period.</div>'}</div></details>
      </section>

      <section class="section">
        <details class="card pad"><summary>Settings & Private Access</summary>
          <div style="margin-top:14px">
            <div class="field" style="max-width:260px"><label>Review Cycle Length</label><div class="inline-actions"><input id="cycleDays" type="number" min="7" max="180" value="${ctx.review_cycle_days}"><button id="saveCycle">Save</button></div></div>
            <div class="access-row"><div><b>Anjana Work View</b><div class="row-sub">Can add and edit learning quality work. No admin settings.</div></div><div class="inline-actions"><button id="revokeAnjana" class="danger">Revoke</button><button id="rotateAnjana">Regenerate Link</button></div></div>
            <div class="access-row"><div><b>Founder Dashboard</b><div class="row-sub">Full visibility and teacher management.</div></div><button id="rotateFounder">Regenerate Founder Link</button></div>
            <div id="accessResult" class="msg"></div>
          </div>
        </details>
      </section>
    `);
    bindFounder();
  }catch(e){setMain(`<div class="error-card"><h1>Could not load dashboard</h1><p>${esc(e.message||String(e))}</p></div>`)}
}
function founderToolbar(){
  return `<div class="toolbar">
    <div class="periods">
      ${[['today','Today'],['week','This Week'],['month','This Month'],['custom','Custom']].map(a=>`<button class="period-btn ${founderRange.mode===a[0]?'on':''}" data-mode="${a[0]}">${a[1]}</button>`).join('')}
    </div>
    <div id="customDates" class="${founderRange.mode==='custom'?'inline-actions':'hide'}">
      <input id="fromDate" type="date" value="${founderRange.from||''}"><input id="toDate" type="date" value="${founderRange.to||''}">
    </div>
    <div class="field"><label>Teacher</label><select id="fTeacher"><option value="">All teachers</option>${teacherOptions(founderFilters.teacher_id,false).replace('<option value="">Select teacher</option>','')}</select></div>
    <div class="field"><label>Activity Type</label><select id="fActivity"><option value="">All activities</option>${activityOptions(founderFilters.activity_type)}</select></div>
    <div class="field"><label>Status</label><select id="fStatus"><option value="">All improvement statuses</option>${statusOptions(founderFilters.status)}</select></div>
  </div>`;
}
function renderBlockers(rows){
  if(!rows.length)return '<div class="empty">No open blockers.</div>';
  return rows.map(b=>`<div class="list-row"><div class="row-main"><div class="row-title">${esc(b.teacher_name||'General work')} · ${esc(b.blocker_type)}</div><div class="row-sub">${esc(b.blocker_note||b.work_item||'')} · Since ${fmtDate(b.work_date)} · Next: ${esc(b.next_action||'')}</div></div><button class="resolve-blocker" data-id="${b.log_id}">Resolve</button></div>`).join('');
}
function bindFounder(){
  document.querySelectorAll('.period-btn').forEach(b=>b.onclick=()=>{
    founderRange.mode=b.dataset.mode;
    if(founderRange.mode!=='custom'){const r=dateRange(founderRange.mode);founderRange.from=r.from;founderRange.to=r.to;renderFounder()}
    else{founderRange.from=founderRange.from||today();founderRange.to=founderRange.to||today();renderFounder()}
  });
  if($('#fromDate'))$('#fromDate').onchange=()=>{founderRange.from=$('#fromDate').value;if(founderRange.to)renderFounder()};
  if($('#toDate'))$('#toDate').onchange=()=>{founderRange.to=$('#toDate').value;if(founderRange.from)renderFounder()};
  $('#fTeacher').onchange=()=>{founderFilters.teacher_id=$('#fTeacher').value?Number($('#fTeacher').value):null;renderFounder()};
  $('#fActivity').onchange=()=>{founderFilters.activity_type=$('#fActivity').value||null;renderFounder()};
  $('#fStatus').onchange=()=>{founderFilters.status=$('#fStatus').value||null;renderFounder()};
  $('#addTeacherBtn').onclick=()=>openTeacherModal();
  document.querySelectorAll('.edit-teacher').forEach(b=>b.onclick=()=>openTeacherModal(teachers.find(t=>String(t.teacher_id)===b.dataset.id)));
  bindTeacherClicks();bindImprovementClicks();
  document.querySelectorAll('.edit-work-founder').forEach(b=>b.onclick=()=>openWorkModal(workLogs.find(w=>String(w.log_id)===b.dataset.id)));
  document.querySelectorAll('.resolve-blocker').forEach(b=>b.onclick=async()=>{try{await rpc('lq_resolve_blocker',{p_token:T,p_log_id:Number(b.dataset.id)});toast('Blocker resolved');renderFounder()}catch(e){toast(e.message||'Could not resolve')}});
  $('#saveCycle').onclick=async()=>{try{await rpc('lq_set_review_cycle',{p_token:T,p_days:Number($('#cycleDays').value)});ctx.review_cycle_days=Number($('#cycleDays').value);toast('Saved');renderFounder()}catch(e){toast(e.message||'Could not save')}};
  $('#revokeAnjana').onclick=async()=>{if(!confirm('Revoke Anjana private link now? It will stop opening until you regenerate a new one.'))return;try{await rpc('lq_revoke_anjana_access',{p_token:T});$('#accessResult').textContent='Anjana link revoked.';toast('Anjana link revoked')}catch(e){toast(e.message||'Could not revoke')}};
  $('#rotateAnjana').onclick=()=>rotateAccess('anjana');
  $('#rotateFounder').onclick=()=>rotateAccess('founder');
}
function openTeacherModal(t){
  openModal(`
    <div class="modal-head"><div><h2>${t?'Edit Teacher':'Add Teacher'}</h2><p>Keep the Teacher Master simple.</p></div><button id="modalClose" class="icon-btn">×</button></div>
    <div class="field"><label>Teacher Name</label><input id="tName" value="${esc(t&&t.teacher_name||'')}"></div>
    <div class="field"><label>Program / Subject</label><input id="tProgram" value="${esc(t&&t.program_subject||'')}"></div>
    <div class="field"><label>Date Joined <span class="small-note">(optional)</span></label><input id="tJoined" type="date" value="${esc(t&&t.date_joined||'')}"></div>
    <div class="field"><label>Notes <span class="small-note">(optional)</span></label><textarea id="tNotes">${esc(t&&t.notes||'')}</textarea></div>
    ${t?`<div class="field"><label>Status</label><select id="tActive"><option value="true" ${t.active?'selected':''}>Active</option><option value="false" ${!t.active?'selected':''}>Inactive</option></select></div>`:''}
    <div id="tMsg" class="msg"></div>
    <div class="modal-actions"><button id="tCancel">Cancel</button><button id="tSave" class="primary">Save Teacher</button></div>
  `);
  $('#tCancel').onclick=closeModal;
  $('#tSave').onclick=async()=>{
    const name=$('#tName').value.trim(),msg=$('#tMsg');if(!name){msg.textContent='Teacher name is required.';msg.className='msg err';return}
    $('#tSave').disabled=true;msg.textContent='Saving...';
    try{
      if(t)await rpc('lq_update_teacher',{p_token:T,p_teacher_id:Number(t.teacher_id),p_teacher_name:name,p_program_subject:$('#tProgram').value.trim()||null,p_active:$('#tActive').value==='true',p_date_joined:$('#tJoined').value||null,p_notes:$('#tNotes').value.trim()||null});
      else await rpc('lq_add_teacher',{p_token:T,p_teacher_name:name,p_program_subject:$('#tProgram').value.trim()||null,p_date_joined:$('#tJoined').value||null,p_notes:$('#tNotes').value.trim()||null});
      closeModal();await reloadTeachers();toast('Teacher saved');renderFounder();
    }catch(e){msg.textContent=e.message||String(e);msg.className='msg err'}
    finally{$('#tSave')&&($('#tSave').disabled=false)}
  };
}
async function rotateAccess(role){
  if(!confirm('Regenerate the '+(role==='anjana'?'Anjana':'Founder')+' private link? The old link will stop working immediately.'))return;
  try{
    const r=await rpc('lq_rotate_access',{p_token:T,p_target_role:role}),x=(r||[])[0]; if(!x)throw new Error('No new link returned');
    const base=location.origin+location.pathname;
    const link=base+'?access='+encodeURIComponent(x.new_token);
    if(role==='founder'){
      T=x.new_token;
      history.replaceState(null,'',link);
      const res=$('#accessResult');if(res)res.innerHTML='Founder link regenerated. This browser is now using the new link.';
      toast('Founder link regenerated');
    }else{
      const res=$('#accessResult');if(res)res.innerHTML='<b>New Anjana private link</b><br><input id="newPrivateLink" readonly value="'+esc(link)+'" style="margin-top:7px"><button id="copyPrivateLink" style="margin-top:7px">Copy Link</button>';
      if($('#copyPrivateLink'))$('#copyPrivateLink').onclick=()=>copyText(link);
    }
  }catch(e){toast(e.message||'Could not regenerate link')}
}

init();
})();
