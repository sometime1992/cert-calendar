/* CertCalendar 1.4 — personal qualification workspace. No account or extra API key required. */
(()=>{
'use strict';
const STORE='cert-calendar-manager-v1';
const QNET='https://www.q-net.or.kr';
const bridge=()=>window.CertCalendarBridge;
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>iso(new Date());
const date=s=>new Date(s+'T12:00:00');
const plus=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
const diff=s=>Math.round((date(s)-date(today()))/86400000);
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(date(s).valueOf())&&iso(date(s))===s;
const fmt=s=>valid(s)?s.replace(/-/g,'.'):'날짜 미등록';
const mins=n=>{const m=Math.max(0,Math.floor(n));return m>=60?`${Math.floor(m/60)}시간 ${m%60}분`:`${m}분`};
const short=s=>typeof s==='string'?s.slice(0,100):'';
const defaults={notify:true,leadDays:3,lastChecks:{},ignored:{}};
let settings=(()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{return {...defaults}}})();
const saveSettings=()=>{try{localStorage.setItem(STORE,JSON.stringify(settings))}catch{}};
let selectedId=null,view='overview',planDraft=[],lastAlert='',checking=false;
const state=()=>bridge()?.get()||{certs:[],tasks:[],sessions:[]};
const findCert=id=>state().certs.find(c=>c.id===id);
const tasksFor=(s,id)=>s.tasks.filter(t=>t.certId===id);
const sessionsFor=(s,id)=>s.sessions.filter(t=>t.certId===id);
const stageOf=c=>c.studyStage==='practical'?'practical':'written';
const stageLabel=s=>s==='practical'?'실기':'필기';
const targetOf=c=>stageOf(c)==='practical'?(c.practicalExamDate||''):(c.examDate||'');
function notice(msg){const toast=$('toast');if(toast){toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3500)}}
function activityList(c){const ends=c.officialSchedule?.endDates||{};return [
  {key:'writtenStart',label:'필기 원서접수 시작',date:c.regDate||''},
  {key:'writtenEnd',label:'필기 원서접수 마감',date:ends.docRegEndDt||''},
  {key:'writtenExam',label:'필기시험',date:c.examDate||''},
  {key:'practicalStart',label:'실기 원서접수 시작',date:c.practicalRegDate||''},
  {key:'practicalEnd',label:'실기 원서접수 마감',date:ends.pracRegEndDt||''},
  {key:'practicalExam',label:'실기시험',date:c.practicalExamDate||''},
  {key:'result',label:'합격 발표',date:c.resultDate||''}
 ].filter(x=>valid(x.date));}
function alertList(){const all=[];for(const c of state().certs)for(const e of activityList(c)){
  const days=diff(e.date);if(days<0||days>Math.max(1,settings.leadDays))continue;
  all.push({...e,certId:c.id,certName:c.name,days});
}return all.sort((a,b)=>a.days-b.days||a.certName.localeCompare(b.certName,'ko'))}
function ensureHome(){let target=$('certWorkspaceHome');if(!target){
  target=document.createElement('section');target.id='certWorkspaceHome';target.className='cw-home card';
  const home=$('screen-home'),first=home?.querySelector('.two-col');if(first)first.before(target);else home?.append(target);
}return target}
function renderHome(){const el=ensureHome();if(!el)return;const s=state(),items=alertList(),pending=s.tasks.filter(t=>!t.done&&t.date&&t.date<=today()).length;
 el.innerHTML=`<div class="cw-section-head"><div><span class="micro">MY LEARNING SPACE</span><h2>나의 자격증 관리</h2><p>자격증을 선택해 학습 계획·과목·기록을 관리하세요.</p></div><button type="button" class="cw-link" data-cw-open-first>내 목표 보기 →</button></div>
 ${items.length?`<div class="cw-alert"><strong>다가오는 시험·접수 일정 ${items.length}건</strong>${items.slice(0,3).map(e=>`<button type="button" data-cw-open="${safe(e.certId)}"><span>${safe(e.certName)} · ${safe(e.label)}</span><b>${e.days===0?'오늘':`D-${e.days}`}</b></button>`).join('')}</div>`:'<p class="cw-muted">등록된 자격증의 접수·시험 일정이 가까워지면 여기에 표시됩니다.</p>'}
 <div class="cw-stat-strip"><span><b>${s.certs.length}</b> 준비 자격증</span><span><b>${pending}</b> 오늘까지의 미완료 할 일</span></div>`;
}
function ensureDialog(){if($('cwOverlay'))return;
 const el=document.createElement('div');el.id='cwOverlay';el.className='cw-overlay';el.hidden=true;
 el.innerHTML='<div class="cw-dialog" role="dialog" aria-modal="true" aria-label="자격증 학습 관리"><div class="cw-top"><div class="cw-top-logo">✦ 자격캘린더</div><button type="button" class="cw-close" id="cwClose" aria-label="닫기">✕</button></div><div id="cwContent" class="cw-content"></div></div>';
 document.body.append(el);
 el.addEventListener('click',e=>{if(e.target===el)close()});
 $('cwClose').addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el.hidden)close()});
}
function open(id,tab='overview'){const c=findCert(id);if(!c){notice('등록된 자격증을 찾을 수 없습니다.');return}ensureDialog();selectedId=id;view=tab;$('cwOverlay').hidden=false;document.body.classList.add('cw-open');render();}
function close(){$('cwOverlay').hidden=true;document.body.classList.remove('cw-open');selectedId=null;}
function progress(s,id){const t=tasksFor(s,id);const done=t.filter(x=>x.done).length;const secs=sessionsFor(s,id).reduce((acc,x)=>acc+Math.max(0,+x.seconds||0),0);return {total:t.length,done,percent:t.length?Math.round(done/t.length*100):0,mins:Math.floor(secs/60)}}
function dayProgress(s,id){const t=tasksFor(s,id).filter(t=>t.date===today());return {total:t.length,done:t.filter(x=>x.done).length}}
function weeklyStats(s,id){const days=Array.from({length:7},(_,i)=>plus(today(),i-6));return days.map(day=>({date:day,min:Math.round(s.sessions.filter(x=>x.certId===id&&x.date===day).reduce((n,x)=>n+(Number(x.seconds)||0),0)/60)}));}
function stageAction(c){const t=targetOf(c);return t&&valid(t)?(diff(t)>=0?`D-${diff(t)}`:'시험일 경과'):'날짜 미등록'}
function top(c){return `<div class="cw-title"><div><div class="cw-eyebrow">MY CERTIFICATION</div><h2>${safe(c.name)}</h2><p>${safe(c.level||'자격증')} · ${c.officialSchedule?.year?`${safe(c.officialSchedule.year)}년 제${safe(c.officialSchedule.round)}회 · `:''}${stageLabel(stageOf(c))} 준비</p></div><div class="cw-dday">${safe(stageAction(c))}<small>${stageLabel(stageOf(c))} 시험</small></div></div>
 <div class="cw-tabs" role="tablist" aria-label="자격증 관리 메뉴">${[['overview','개요'],['planner','자동 계획'],['records','공부 통계'],['alerts','일정·알림']].map(([v,label])=>`<button role="tab" data-cw-view="${v}" aria-selected="${view===v}" class="${view===v?'active':''}">${label}</button>`).join('')}</div>`}
function progressBlock(p){return `<div class="cw-progress-head"><b>${p.percent}%</b><small>${p.done}/${p.total}개 완료</small></div><div class="cw-track"><span style="width:${p.percent}%"></span></div>`}
function renderOverview(c,s){const p=progress(s,c.id),todayP=dayProgress(s,c.id),tasks=tasksFor(s,c.id).filter(x=>!x.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));const now=tasks.filter(x=>!x.date||x.date<=today()).slice(0,6);const stage=stageOf(c),exam=targetOf(c);
 return `<div class="cw-kpis"><div class="cw-panel"><small>전체 학습 진행률</small>${progressBlock(p)}</div><div class="cw-panel"><small>누적 공부 시간</small><strong class="cw-number">${mins(p.mins)}</strong></div><div class="cw-panel"><small>오늘 공부</small><strong class="cw-number">${todayP.done} / ${todayP.total}<span> 완료</span></strong></div></div>
 <section class="cw-panel"><div class="cw-section-head"><div><h3>학습 단계</h3><p>필기 합격 여부는 사용자가 직접 설정합니다.</p></div></div><div class="cw-switch"><button data-cw-stage="written" class="${stage==='written'?'selected':''}">필기 준비</button><button data-cw-stage="practical" class="${stage==='practical'?'selected':''}">실기 준비</button></div>
 ${stage==='written'&&valid(c.examDate)&&diff(c.examDate)<0?'<div class="cw-callout">필기시험일이 지났습니다. 합격했다면 ‘실기 준비’를 선택해 주세요.</div>':''}
 ${stage==='practical'&&!c.practicalExamDate?'<div class="cw-callout">실기시험 날짜를 아직 입력하지 않았습니다. 자격증 정보 수정에서 등록할 수 있습니다.</div>':''}
 </section>
 <section class="cw-panel"><div class="cw-section-head"><div><h3>오늘의 공부</h3><p>할 일을 완료하면 진행률에 반영됩니다.</p></div><button data-cw-view="planner" class="cw-link">계획 만들기 →</button></div>
 ${now.length?now.map(t=>`<label class="cw-task"><input type="checkbox" data-cw-check="${safe(t.id)}" ${t.done?'checked':''}><span>${safe(t.text)}<small>${fmt(t.date)}${t.minutes?` · 목표 ${t.minutes}분`:''}</small></span></label>`).join(''):'<div class="cw-empty">오늘 남은 학습 항목이 없습니다. 자동 학습 계획을 생성하거나 공부할 일을 추가하세요.</div>'}
 <div class="cw-actions"><button data-cw-ai="${safe(c.id)}" class="cw-secondary">✦ AI 문제 풀기</button><button data-cw-view="planner" class="cw-primary">${p.total?'학습 계획 관리':'학습 계획 만들기'}</button><button data-cw-add-task="${safe(c.id)}" class="cw-secondary">할 일 직접 추가</button></div></section>
 <section class="cw-panel"><div class="cw-section-head"><div><h3>시험 일정</h3><p>API에서 가져온 일정도 Q-Net에서 다시 확인해 주세요.</p></div><button data-cw-view="alerts" class="cw-link">전체 보기 →</button></div>
 ${activityList(c).length?activityList(c).slice(0,5).map(x=>`<div class="cw-date-row"><span>${safe(x.label)}</span><b>${fmt(x.date)}</b></div>`).join(''):'<div class="cw-empty">시험 일정이 아직 없습니다.</div>'}
 <button class="cw-text-button" data-cw-edit="${safe(c.id)}">자격증·시험일 수정</button></section>`;
}
function renderPlanner(c,s){const dayNames=['일','월','화','수','목','금','토'];const stage=stageOf(c),exam=targetOf(c);const saved=Array.isArray(c.subjects?.[stage])?c.subjects[stage]:[];const subjects=saved.length?saved.join('\n'):'';
 return `<section class="cw-panel"><h3>${stageLabel(stage)} 학습 계획 만들기</h3><p class="cw-muted">시험일까지 공부할 날짜와 과목을 선택하면 계획을 제안합니다. <b>과목명은 공식 출제과목이 아니라 사용자가 입력하는 학습 목록</b>입니다.</p>
 <form id="cwPlanForm" class="cw-form"><div class="cw-fields"><label>계획 시작일<input type="date" name="start" value="${today()}" required></label><label>목표 시험일<input type="date" name="end" value="${safe(exam||'')}" required></label></div>
 <label>공부할 과목·영역 <small>(한 줄에 하나씩, 최대 12개)</small><textarea name="subjects" rows="4" required maxlength="400" placeholder="예: 전자계산기구조&#10;기출문제 풀이&#10;오답 정리">${safe(subjects)}</textarea></label>
 <div class="cw-fields"><label>하루 목표 시간<select name="minutes">${[20,30,45,60,90,120,150,180].map(v=>`<option value="${v}" ${v===60?'selected':''}>${v}분</option>`).join('')}</select></label><label>생성할 최대 일정<select name="maxDays"><option value="30">30개</option><option value="60" selected>60개</option><option value="120">120개</option><option value="180">180개</option></select></label></div>
 <div class="cw-week-label">공부할 요일</div><div class="cw-weekdays">${dayNames.map((n,i)=>`<label><input type="checkbox" name="weekday" value="${i}" ${i===0?'':'checked'}><span>${n}</span></label>`).join('')}</div>
 <button type="submit" class="cw-primary">계획 미리보기</button></form></section>
 <section class="cw-panel" id="cwPreviewBox"><h3>학습 계획 미리보기</h3><div class="cw-empty">과목과 기간을 입력한 뒤 미리보기를 눌러주세요. 기존 공부 기록은 삭제하거나 덮어쓰지 않습니다.</div></section>
 ${tasksFor(s,c.id).some(t=>t.autoPlanId)?`<section class="cw-panel"><h3>기존 자동 계획</h3><p class="cw-muted">자동 생성한 할 일을 포함해 ${tasksFor(s,c.id).length}개의 학습 항목이 있습니다.</p><button class="cw-secondary" data-cw-remove-plan>선택한 자격증의 자동 생성 계획만 삭제</button></section>`:''}`;
}
function makePlan(f,c){const start=String(f.get('start')),end=String(f.get('end'));if(!valid(start)||!valid(end)||start>end)throw Error('계획 날짜를 확인해 주세요.');if(end<today())throw Error('지난 시험일에는 계획을 생성할 수 없습니다.');
 const raw=String(f.get('subjects')||'').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);const subjects=[...new Set(raw)].slice(0,12);if(!subjects.length)throw Error('공부할 과목을 한 개 이상 입력해 주세요.');
 const weekdays=f.getAll('weekday').map(Number);if(!weekdays.length)throw Error('공부할 요일을 한 개 이상 선택해 주세요.');
 const minutes=Number(f.get('minutes'));const maxDays=Number(f.get('maxDays'));const matches=[];
 for(let day=start;day<=end&&matches.length<maxDays;day=plus(day,1))if(weekdays.includes(date(day).getDay()))matches.push(day);
 if(!matches.length)throw Error('선택한 기간과 요일에 공부할 날짜가 없습니다.');
 // 1 study task per chosen day, with a revision emphasis near the exam.
 return {subjects,days:matches.length,first:matches[0],last:matches.at(-1),truncated:matches.length===maxDays&&matches.at(-1)<end,
 tasks:matches.map((day,i)=>{const final=i>=Math.floor(matches.length*0.8);const label=final?`마무리 복습 · ${subjects[i%subjects.length]}`:`${subjects[i%subjects.length]} 학습`;
 return {date:day,text:label,minutes,done:false,certId:c.id,phase:stageOf(c)};})};
}
function renderStats(c,s){const p=progress(s,c.id),w=weeklyStats(s,c.id),max=Math.max(...w.map(x=>x.min),1);
 const subjects=tasksFor(s,c.id).reduce((a,t)=>{const k=t.text.replace(/^(마무리 복습 · )/,'').replace(/ 학습$/,'');(a[k]??={done:0,total:0}).total++;if(t.done)a[k].done++;return a},{});
 return `<section class="cw-panel"><h3>${safe(c.name)} 공부 기록</h3><div class="cw-metrics"><div><span>누적 학습</span><b>${mins(p.mins)}</b></div><div><span>완료한 할 일</span><b>${p.done}개</b></div><div><span>진행률</span><b>${p.percent}%</b></div></div></section>
 <section class="cw-panel"><h3>최근 7일 공부 시간</h3><div class="cw-bars">${w.map(x=>`<div title="${fmt(x.date)} · ${x.min}분"><span>${x.min?x.min+'분':''}</span><i style="height:${Math.max(3,x.min/max*100)}%"></i><small>${['일','월','화','수','목','금','토'][date(x.date).getDay()]}</small></div>`).join('')}</div><p class="cw-muted">실제 타이머에서 ‘마치고 기록’을 누른 시간만 집계합니다.</p></section>
 <section class="cw-panel"><h3>학습 영역별 진행 현황</h3>${Object.keys(subjects).length?Object.entries(subjects).slice(0,12).map(([name,v])=>`<div class="cw-subject-row"><span>${safe(name)}</span><b>${v.done}/${v.total}</b></div>`).join(''):'<div class="cw-empty">학습 계획을 만들면 과목별 진행 현황을 확인할 수 있습니다.</div>'}</section>`;
}
function renderAlerts(c){const events=activityList(c),upcoming=events.filter(e=>diff(e.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));const cand=c.officialSchedule?.pendingChange;const lastCheck=c.officialSchedule?.checkedAt;
 return `<section class="cw-panel"><div class="cw-section-head"><div><h3>접수·시험 일정</h3><p>공식 접수·응시 날짜는 Q-Net에서 최종 확인해 주세요.</p></div><a href="${QNET}" target="_blank" rel="noopener noreferrer" class="cw-link">Q-Net →</a></div>
 ${events.length?events.map(e=>`<div class="cw-date-row"><span>${safe(e.label)}</span><b>${fmt(e.date)}${diff(e.date)>=0?` · D-${diff(e.date)}`:''}</b></div>`).join(''):'<div class="cw-empty">등록된 일정이 없습니다. 자격증 정보에서 날짜를 등록해 주세요.</div>'}</section>
 <section class="cw-panel"><h3>일정 알림 설정</h3><p class="cw-muted">웹앱을 열면 가까운 접수·시험 일정을 알려줍니다. 브라우저를 닫았을 때의 푸시 알림은 지원하지 않습니다.</p>
 <label class="cw-toggle"><input type="checkbox" id="cwNotify" ${settings.notify?'checked':''}>앱 안에서 일정 알림 표시</label>
 <label>며칠 전부터 알림을 볼까요?<select id="cwLead" class="cw-control">${[1,3,7,14,30].map(n=>`<option value="${n}" ${settings.leadDays===n?'selected':''}>${n}일 전부터</option>`).join('')}</select></label>
 <p class="cw-muted">${upcoming.length?`가장 가까운 일정: ${safe(upcoming[0].label)} · ${fmt(upcoming[0].date)}`:'예정된 일정이 없습니다.'}</p></section>
 <section class="cw-panel"><div class="cw-section-head"><div><h3>공식 일정 변경 확인</h3><p>앱을 열 때 확인하고, 날짜가 달라지면 적용 전에 알려줍니다.</p></div></div>
 <p class="cw-muted">${lastCheck?'마지막 확인: '+new Date(lastCheck).toLocaleString('ko-KR'):'아직 확인하지 않았습니다.'}</p>
 ${cand?`<div class="cw-callout"><strong>공식 일정 차이를 발견했습니다.</strong><p>${safe(cand.message||'원래 저장한 일정과 조회한 값이 다릅니다.')}</p><div class="cw-actions"><button class="cw-primary" data-cw-review>변경 내용 보기</button><button class="cw-secondary" data-cw-ignore>이번 변경 무시</button></div></div>`:''}
 <button class="cw-secondary" id="cwCheckSchedule" ${!c.officialSchedule?.jmCd?'disabled':''}>지금 공식 일정 확인</button>
 ${!c.officialSchedule?.jmCd?'<p class="cw-muted">공식 회차로 등록한 자격증에서 사용할 수 있습니다.</p>':''}</section>`;
}
function render(){const c=findCert(selectedId);if(!c){close();return}const s=state();let body=view==='overview'?renderOverview(c,s):view==='planner'?renderPlanner(c,s):view==='records'?renderStats(c,s):renderAlerts(c);
 $('cwContent').innerHTML=top(c)+body;
 if(view==='planner')$('cwPlanForm').addEventListener('submit',preview);
 if(view==='alerts'){$('cwNotify').addEventListener('change',e=>{settings.notify=e.target.checked;saveSettings();tick()});$('cwLead').addEventListener('change',e=>{settings.leadDays=+e.target.value;saveSettings();tick()})}
}
function preview(e){e.preventDefault();const c=findCert(selectedId);if(!c)return;try{
 const plan=makePlan(new FormData(e.currentTarget),c);planDraft=plan.tasks;
 const box=$('cwPreviewBox');box.innerHTML=`<h3>계획 미리보기</h3><p class="cw-muted">${fmt(plan.first)} ~ ${fmt(plan.last)} · ${plan.days}일 · 각 ${plan.tasks[0].minutes}분</p>
 ${plan.truncated?'<div class="cw-callout">설정한 최대 일정 개수에 도달했습니다. 시험일까지 전부 생성하려면 최대 개수를 늘려주세요.</div>':''}
 ${plan.tasks.slice(0,5).map(t=>`<div class="cw-date-row"><span>${fmt(t.date)}</span><b>${safe(t.text)}</b></div>`).join('')}
 ${plan.days>5?`<p class="cw-muted">외 ${plan.days-5}개 일정</p>`:''}
 <button class="cw-primary" id="cwCommitPlan">${plan.days}개 할 일을 내 플래너에 추가</button><p class="cw-muted">기존 할 일은 유지하며, 같은 날짜·이름의 중복 항목은 건너뜁니다.</p>`;
 $('cwCommitPlan').addEventListener('click',()=>commitPlan(plan));box.scrollIntoView({block:'nearest',behavior:'smooth'});
 }catch(err){notice(err.message||'계획을 생성하지 못했습니다.')}
}
function commitPlan(plan){const id=selectedId;const stage=stageOf(findCert(id));const subjectInput=$('cwPlanForm')?.elements?.subjects?.value||'';
 let created=0;bridge().mutate(s=>{const c=s.certs.find(x=>x.id===id);if(!c)return;
 c.subjects??={};c.subjects[stage]=plan.subjects;
 const seen=new Set(s.tasks.filter(t=>t.certId===id).map(t=>t.date+'|'+t.text));
 const stamp=Date.now().toString(36);
 plan.tasks.forEach((t,i)=>{const k=t.date+'|'+t.text;if(seen.has(k))return;seen.add(k);s.tasks.push({...t,id:window.crypto?.randomUUID?.()||stamp+'-'+i,autoPlanId:stamp,createdAt:new Date().toISOString()});created++})});
 notice(`${created}개 학습 계획을 추가했습니다.`);view='overview';render();
}
async function checkOfficial(c,force=false){if(!c?.officialSchedule?.jmCd||!c.officialSchedule.year)return;
 const id=c.id,meta=c.officialSchedule;
 const checked=settings.lastChecks[id]||0;if(!force&&Date.now()-checked<6*3600000)return;
 settings.lastChecks[id]=Date.now();saveSettings();
 try{
 const url='/api/schedules?year='+encodeURIComponent(meta.year)+'&jmCd='+encodeURIComponent(meta.jmCd);
 const res=await fetch(url,{cache:'no-store'});const data=await res.json();if(!res.ok||data.ok!==true||!Array.isArray(data.items))throw Error(data.message||'공식 일정 조회 오류');
 const rows=data.items.filter(x=>String(x.round||'')===String(meta.round||''));
 const fields={docRegStartDt:'regDate',docExamStartDt:'examDate',pracRegStartDt:'practicalRegDate',pracExamStartDt:'practicalExamDate',pracPassDt:'resultDate'};
 // A round can contain multiple schedules (e.g. different CBT windows). Do not guess a replacement.
 if(rows.length!==1){bridge().mutate(s=>{const x=s.certs.find(z=>z.id===id);if(x?.officialSchedule){x.officialSchedule.checkedAt=new Date().toISOString();if(rows.length>1)x.officialSchedule.pendingChange={message:'같은 회차에 여러 일정이 있습니다. Q-Net에서 정확한 시험 종류를 확인한 후 수동으로 수정해 주세요.',ambiguous:true}}});return}
 const row=rows[0],current=findCert(id);if(!current)return;
 const snapshot=meta.snapshot||Object.fromEntries(Object.entries(fields).map(([up,local])=>[up,current[local]||'']));
 const changes=Object.entries(fields).filter(([up])=>Boolean(snapshot[up]||row[up])&&(snapshot[up]||'')!==(row[up]||''));
 bridge().mutate(s=>{const x=s.certs.find(z=>z.id===id);if(!x?.officialSchedule)return;x.officialSchedule.checkedAt=new Date().toISOString();x.officialSchedule.snapshot=snapshot;
 if(changes.length){x.officialSchedule.pendingChange={message:changes.map(([up,local])=>`${local}: ${snapshot[up]||'미등록'} → ${row[up]||'미등록'}`).join(' / '),dates:Object.fromEntries(changes.map(([up,local])=>[local,row[up]||''])),snapshot:Object.fromEntries(Object.entries(fields).map(([up])=>[up,row[up]||'']))};}else delete x.officialSchedule.pendingChange});
 }catch(err){if(force)notice('공식 일정 조회 실패: '+(err.message||err))}
}
function showChange(c){const p=c.officialSchedule?.pendingChange;if(!p)return;
 if(p.ambiguous)return notice('같은 회차에 여러 일정이 있어 자동 변경할 수 없습니다. Q-Net을 확인해 주세요.');
 const lines=Object.entries(p.dates||{}).map(([k,v])=>`${k}: ${v||'미등록'}`).join('\n');
 if(!confirm('공식 일정에 다음 차이가 있습니다.\n'+lines+'\n\n선택한 날짜를 갱신할까요? (개인 공부 계획은 유지됩니다.)'))return;
 bridge().mutate(s=>{const c=s.certs.find(x=>x.id===selectedId);if(!c)return;Object.assign(c,p.dates);c.officialSchedule.snapshot=p.snapshot;delete c.officialSchedule.pendingChange});notice('확인한 일정만 업데이트했습니다.');render();}
function openAlertPanel(){const alerts=alertList();let host=$('cwAlertToggle');if(!host){host=document.createElement('button');host.type='button';host.id='cwAlertToggle';host.className='cw-global-alert';host.title='다가오는 일정 알림';host.innerHTML='🔔<span></span>';
 const top=document.querySelector('.topbar');top?.append(host);host.addEventListener('click',()=>{if(!alerts.length){notice('현재 가까운 시험·접수 일정이 없습니다.');return}open(alertList()[0].certId,'alerts')});}
 const n=alerts.length;host.querySelector('span').textContent=n?n:'';host.setAttribute('aria-label',`다가오는 일정 ${n}건`);host.hidden=!settings.notify;
}
function tick(){renderHome();openAlertPanel();}
async function checkAll(){if(checking)return;checking=true;try{for(const c of state().certs.slice(0,20)){await checkOfficial(c,false)}}finally{checking=false;}}
function init(){ensureDialog();renderHome();openAlertPanel();
 document.addEventListener('click',e=>{
  const d=e.target.closest('[data-cert-detail],[data-cw-open]');if(d){e.preventDefault();e.stopPropagation();open(d.dataset.certDetail||d.dataset.cwOpen);return}
  if(e.target.closest('[data-cw-open-first]')){const c=state().certs[0];if(c)open(c.id);else notice('먼저 자격증을 등록해 주세요.');return}
  if(!$('cwOverlay')||$('cwOverlay').hidden)return;
  const viewButton=e.target.closest('[data-cw-view]');if(viewButton){view=viewButton.dataset.cwView;render();return}
  const stage=e.target.closest('[data-cw-stage]');if(stage){if(stage.dataset.cwStage==='practical'&&!confirm('필기시험 합격 후 실기 준비로 전환하시겠습니까?'))return;
   bridge().mutate(s=>{const c=s.certs.find(x=>x.id===selectedId);if(c)c.studyStage=stage.dataset.cwStage});view='overview';render();return}
  if(e.target.closest('[data-cw-ai]')){const id=selectedId;close();window.CertQuiz?.open(id);return}
  if(e.target.closest('[data-cw-add-task]')){const id=selectedId;close();bridge().openTask();requestAnimationFrame(()=>{const select=$('taskCert');if(select)select.value=id});return}
  if(e.target.closest('[data-cw-edit]')){const id=selectedId;close();bridge().openEdit(id);return}
  if(e.target.closest('[data-cw-remove-plan]')){if(!confirm('자동 생성된 계획만 삭제할까요? 직접 만든 할 일과 공부 기록은 유지합니다.'))return;
   bridge().mutate(s=>{s.tasks=s.tasks.filter(t=>!(t.certId===selectedId&&t.autoPlanId))});notice('자동 생성한 계획만 삭제했습니다.');render();return}
  if(e.target.closest('[data-cw-review]'))return showChange(findCert(selectedId));
  if(e.target.closest('[data-cw-ignore]')){bridge().mutate(s=>{const c=s.certs.find(x=>x.id===selectedId);if(c?.officialSchedule)delete c.officialSchedule.pendingChange});render();return}
  if(e.target.closest('#cwCheckSchedule')){const c=findCert(selectedId);settings.lastChecks[c.id]=0;checkOfficial(c,true).then(()=>render());return}
 });
 document.addEventListener('change',e=>{const id=e.target.dataset.cwCheck;if(id){bridge().mutate(s=>{const t=s.tasks.find(t=>t.id===id&&t.certId===selectedId);if(t)t.done=e.target.checked});render();return}});
 document.addEventListener('certcal:data-changed',()=>{tick();if(selectedId&&findCert(selectedId))render()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();checkAll()}});
 tick();checkAll();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();