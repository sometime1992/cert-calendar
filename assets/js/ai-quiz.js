(()=>{
'use strict';
// All audio/file processing is local; only selected extracted text goes to /api/generate-quiz.
const $=id=>document.getElementById(id);
const bridge=()=>window.CertCalendarBridge;
const STORAGE='cert-calendar-quiz-v1';
let examClock=null;
const defaults=()=>({history:[],wrong:[]});
function read(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');if(v&&Array.isArray(v.history)&&Array.isArray(v.wrong))return v}catch{}return defaults()}
let saved=read(),session=null,sourceText='',fileName='',loading=false;
const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[x]));
function persist(){saved.history=saved.history.slice(0,120);saved.wrong=saved.wrong.slice(0,120);try{localStorage.setItem(STORAGE,JSON.stringify(saved))}catch{status('저장 공간이 부족해 일부 문제 기록을 보관하지 못했습니다.',true)}renderHistory()}
function status(msg,error=false){const s=$('aqState');if(s){s.textContent=msg;s.style.color=error?'#af3542':'#435797'}}
function data(){return bridge()?.get()||{certs:[],tasks:[],sessions:[]}}
function current(){return data().certs.find(c=>c.id===$('aqCert').value)}
function stage(c){return c?.studyStage==='practical'?'practical':'written'}
function topics(c){if(!c)return ['핵심 개념'];const areas=c.subjects?.[stage(c)]||[];
  const past=data().tasks.filter(t=>t.certId===c.id).map(t=>t.text.replace(/^(마무리 복습 · )/,'').replace(/ 학습$/,''));
  return [...new Set([...areas,...past].map(x=>String(x).trim()).filter(x=>x&&x.length<=120))].slice(0,25).length?
   [...new Set([...areas,...past].map(x=>String(x).trim()).filter(x=>x&&x.length<=120))].slice(0,25):['핵심 개념','기출 유형 복습'];}
function selectCert(id){const items=data().certs;const sel=$('aqCert'),was=id||sel.value;
 sel.innerHTML=items.length?items.map(c=>`<option value="${safe(c.id)}">${safe(c.name)} (${c.studyStage==='practical'?'실기':'필기'})</option>`).join(''):'<option value="">먼저 자격증을 등록해 주세요</option>';
 sel.value=items.some(x=>x.id===was)?was:items[0]?.id||'';
 const names=topics(current());const old=$('aqSubject').value;
 $('aqSubject').innerHTML=names.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');
 if(names.includes(old))$('aqSubject').value=old;
 $('aqGenerate').disabled=!items.length||loading;
}
async function ensureMammoth(){if(window.mammoth)return window.mammoth;
 const url='https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.crossOrigin='anonymous';script.onload=resolve;script.onerror=()=>reject(Error('DOCX 읽기 라이브러리를 불러올 수 없습니다. 인터넷 연결을 확인해 주세요.'));document.head.append(script)});
 if(!window.mammoth)throw Error('DOCX 텍스트 추출에 실패했습니다.');return window.mammoth;
}
async function extract(file){
 const ext=file.name.toLowerCase().split('.').at(-1);
 if(!['txt','md','csv','pdf','docx'].includes(ext))throw Error('지원 파일: PDF, DOCX, TXT, MD, CSV (한글 HWP·사진은 아직 미지원)');
 if(file.size>8*1024*1024)throw Error('파일은 8MB 이하여야 합니다.');
 if(ext==='txt'||ext==='md'||ext==='csv')return await file.text();
 if(ext==='docx'){
  const mammoth=await ensureMammoth();
  const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return r.value||'';
 }
 // PDF.js processes the PDF in this browser; the binary document is never posted to our backend.
 const base='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
 let lib;try{lib=await import(base+'pdf.min.mjs')}catch{throw Error('PDF 읽기 라이브러리를 불러올 수 없습니다. 인터넷 연결을 확인해 주세요.')}
 lib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';
 const job=lib.getDocument({data:new Uint8Array(await file.arrayBuffer())});
 const pdf=await job.promise;const chunks=[];
 try{
  for(let n=1;n<=Math.min(pdf.numPages,25);n++){
   const page=await pdf.getPage(n),content=await page.getTextContent();
   const line=content.items.map(item=>item.str||'').join(' ');
   chunks.push(line);
   if(chunks.join(' ').length>22000)break;
  }
 }finally{await pdf.destroy()}
 return chunks.join('\n');
}
async function readFile(file){sourceText='';fileName='';$('aqUseFile').checked=false;$('aqUseFile').disabled=true;
 if($('aqFilePreview'))$('aqFilePreview').hidden=true;
 if(!file){$('aqFileStatus').textContent='첨부하지 않으면 선택한 과목으로 문제를 만듭니다.';return}
 $('aqFileStatus').textContent='파일에서 글자를 읽는 중입니다…';
 try{
  const text=await extract(file);
  const normalized=text.replace(/\u0000/g,'').replace(/[\t ]+/g,' ').trim();
  if(normalized.length<80)throw Error('읽을 수 있는 글자가 부족합니다. 이미지형 PDF는 OCR 처리 후 다시 올려주세요.');
  fileName=file.name;sourceText=normalized.length>14000?
   normalized.slice(0,7000)+'\n[긴 문서의 중간 내용 생략]\n'+normalized.slice(-6600):normalized;
  if($('aqFilePreviewText'))$('aqFilePreviewText').textContent=sourceText.slice(0,1200);
  if($('aqFilePreview'))$('aqFilePreview').hidden=false;
  $('aqUseFile').disabled=false;$('aqUseFile').checked=true;
  $('aqFileStatus').textContent=`${file.name} · 추출 ${normalized.length.toLocaleString()}자 · AI에 보낼 최대 ${sourceText.length.toLocaleString()}자`+
   (normalized.length>14000?' (일부만 참고)':'');
 }catch(e){$('aqFileStatus').textContent=e.message||'파일을 읽지 못했습니다.';status(e.message||'파일을 읽지 못했습니다.',true)}
}

function choiceName(q,index){
 if(index===null||index===undefined||index<0)return '미응답';
 if(q.type==='ox')return index===0?'맞다 (O)':'틀리다 (X)';
 return ['①','②','③','④'][index]+' '+String(q.options[index]||'');
}
function getWrongKey(certId,q){return String(certId)+':'+String(q.question)}
function updateWrong(q,selected,certId,certName,topic,sourceName){
 const key=getWrongKey(certId,q);
 const correct=selected===q.correctIndex;
 saved.wrong=saved.wrong.filter(w=>w.key!==key);
 if(!correct&&selected!==null){
  saved.wrong.unshift({key,certId,certName,topic:q.topic||topic,question:q,
    selected,addedAt:new Date().toISOString(),sourceName:sourceName||''});
 }
 return correct;
}
function clockText(ms){
 const sec=Math.max(0,Math.ceil(ms/1000));
 return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}
function updateClock(){
 if(!session||session.mode!=='exam'||!session.examEndsAt){clearInterval(examClock);return}
 const remaining=session.examEndsAt-Date.now();
 const label=$('aqCountdown');if(label)label.textContent='남은 시간 '+clockText(remaining);
 if(remaining<=0)finish(true);
}
function choicesHtml(q,selected,reveal){
 return q.options.map(function(opt,i){
  let cls='aq-choice';
  if(selected===i)cls+=' selected';
  if(reveal&&i===q.correctIndex)cls+=' correct';
  if(reveal&&selected===i&&selected!==q.correctIndex)cls+=' incorrect';
  const disabled=reveal?' disabled':'';
  const label=q.type==='ox'?(opt==='O'?'맞다 (O)':'틀리다 (X)'):opt;
  const mark=q.type==='ox'?opt:['①','②','③','④'][i];
  return '<button type="button" class="'+cls+'" data-aq-answer="'+i+'"'+disabled+' aria-pressed="'+(selected===i)+'"><b>'+safe(mark)+'</b><span>'+safe(label)+'</span></button>';
 }).join('');
}
function showQuestion(){
 if(!session||session.idx>=session.questions.length)return;
 const q=session.questions[session.idx],i=session.idx;
 const selected=session.answers[i],isExam=session.mode==='exam',reveal=!isExam&&session.checked[i];
 let nav='';
 if(isExam){
  nav='<div class="aq-exam-nav" aria-label="문제 번호 이동">'+session.questions.map(function(_,n){
   const label=(session.answers[n]!==null?'완료 ':'미응답 ')+(n+1)+'번';
   return '<button type="button" data-aq-jump="'+n+'" class="'+(n===i?'current ':'')+(session.answers[n]!==null?'answered':'')+'" aria-label="'+label+'" aria-current="'+(n===i?'step':'false')+'">'+(n+1)+'</button>';
  }).join('')+'</div>';
 }
 const progress=session.answers.filter(x=>x!==null).length;
 const topline='<div class="aq-question-top"><span class="aq-topic">'+safe(q.topic||session.topic)+'</span><span class="aq-counter">'+(i+1)+' / '+session.questions.length+'</span></div>';
 const timer=isExam?'<div class="aq-exam-status"><strong>모의시험 · '+progress+'/'+session.questions.length+'문제 응답</strong><span id="aqCountdown"></span></div>':'<p class="aq-mode-label">연습 모드 · 정답을 확인하면 해설이 열립니다.</p>';
 const explanation=reveal?'<div class="aq-explain" role="status"><strong>'+(selected===q.correctIndex?'✓ 정답입니다':'정답: '+safe(choiceName(q,q.correctIndex)))+'</strong><div>'+safe(q.explanation)+'</div></div>':'';
 const source=session.sourceBased?'<p class="aq-source-tag">첨부자료 참고 요청 · 실제 출제 내용과의 일치 여부는 검증되지 않았습니다.</p>':'';
 let actions='';
 if(isExam){
  actions='<div class="aq-actions"><button type="button" class="btn btn-outline" id="aqPrev"'+(i===0?' disabled':'')+'>← 이전</button>'+
   (i<session.questions.length-1?'<button type="button" class="btn btn-primary" id="aqNext">다음 문제 →</button>':'<button type="button" class="btn btn-primary" id="aqSubmit">시험 제출·채점</button>')+
   '</div><button type="button" class="aq-submit-link" id="aqSubmitAny">지금 시험 제출하기</button>';
 }else{
  actions='<div class="aq-actions">'+(reveal?
    '<button type="button" class="btn btn-primary" id="aqNext">'+(i+1===session.questions.length?'결과 확인':'다음 문제 →')+'</button>':
    '<button type="button" class="btn btn-primary" id="aqCheck"'+(selected===null?' disabled':'')+'>정답 확인</button>')+
   '<button type="button" class="btn btn-outline" id="aqEnd">연습 종료</button></div>';
 }
 $('aqPlay').innerHTML=topline+timer+nav+'<h2 class="aq-question">'+safe(q.question)+'</h2>'+
  '<div class="aq-choices">'+choicesHtml(q,selected,reveal)+'</div>'+explanation+source+actions+
  '<p class="aq-caveat">AI 생성 비공식 연습문제입니다. 해설이 틀릴 수 있으므로 공식 학습자료와 대조해 주세요.</p>';
 $('aqPlay').querySelectorAll('[data-aq-answer]').forEach(function(b){b.addEventListener('click',function(){
  if(!session||(!isExam&&session.checked[session.idx]))return;
  session.answers[session.idx]=Number(b.dataset.aqAnswer);showQuestion();
 })});
 $('aqPlay').querySelectorAll('[data-aq-jump]').forEach(function(b){b.addEventListener('click',function(){
  session.idx=Number(b.dataset.aqJump);showQuestion();
 })});
 $('aqCheck')?.addEventListener('click',checkAnswer);
 $('aqPrev')?.addEventListener('click',function(){session.idx--;showQuestion()});
 $('aqNext')?.addEventListener('click',function(){session.idx++;if(session.idx>=session.questions.length)finish(false);else showQuestion()});
 $('aqSubmit')?.addEventListener('click',submitExam);
 $('aqSubmitAny')?.addEventListener('click',submitExam);
 $('aqEnd')?.addEventListener('click',function(){if(confirm('지금까지 확인한 문제만 기록하고 종료할까요?'))finish(false)});
 updateClock();
}
function checkAnswer(){
 if(!session||session.mode==='exam')return;
 const i=session.idx,q=session.questions[i],selected=session.answers[i];
 if(selected===null||session.checked[i])return;
 session.checked[i]=true;
 updateWrong(q,selected,session.certId,session.certName,session.topic,session.sourceName);
 persist();showQuestion();
}
function submitExam(){
 if(!session||session.mode!=='exam')return;
 const blank=session.answers.filter(x=>x===null).length;
 const message=blank>0?'미응답 '+blank+'문제는 오답 처리됩니다. 지금 제출할까요?':'시험을 제출하고 모든 정답과 해설을 확인할까요?';
 if(!confirm(message))return;
 finish(false);
}
function resultDetail(q,selected,index){
 const correct=selected===q.correctIndex;
 return '<details class="aq-result-detail"><summary><span>'+(index+1)+'. '+safe(q.question)+'</span><strong class="'+(correct?'aq-ok':'aq-no')+'">'+(selected===null?'미응답':correct?'정답':'오답')+'</strong></summary>'+
  '<p><b>내 답:</b> '+safe(choiceName(q,selected))+'</p><p><b>정답:</b> '+safe(choiceName(q,q.correctIndex))+'</p>'+
  '<p><b>해설:</b> '+safe(q.explanation)+'</p></details>';
}
function finish(expired){
 if(!session)return;
 clearInterval(examClock);examClock=null;
 const currentSession=session;session=null;
 let entries=[];
 for(let i=0;i<currentSession.questions.length;i++){
  const q=currentSession.questions[i],answer=currentSession.answers[i];
  if(currentSession.mode==='exam'||currentSession.checked[i]){
   entries.push({q,answer});
   if(currentSession.mode==='exam')updateWrong(q,answer,currentSession.certId,currentSession.certName,currentSession.topic,currentSession.sourceName);
  }
 }
 const correct=entries.filter(x=>x.answer===x.q.correctIndex).length;
 const total=entries.length;
 const answered=entries.filter(x=>x.answer!==null).length;
 const byTopic={};
 for(const e of entries){
  const topic=e.q.topic||currentSession.topic;
  const record=byTopic[topic]||{answered:0,correct:0};
  record.answered++;if(e.answer===e.q.correctIndex)record.correct++;
  byTopic[topic]=record;
 }
 if(total){
  saved.history.unshift({
   id:crypto.randomUUID(),certId:currentSession.certId,certName:currentSession.certName,
   topic:currentSession.topic,answered:total,correct,responded:answered,
   mode:currentSession.mode,sourceBased:currentSession.sourceBased,
   sourceName:currentSession.sourceName||'',byTopic,date:new Date().toISOString()
  });
 }
 persist();
 const title=expired?'시험 시간 종료 · 자동 채점':'연습 결과';
 const details=entries.map((x,i)=>resultDetail(x.q,x.answer,i)).join('');
 $('aqPlay').innerHTML='<div class="aq-summary"><span class="micro">SESSION COMPLETE</span>'+
  '<h3>'+safe(currentSession.certName)+' · '+title+'</h3>'+
  '<div class="aq-score">'+(total?Math.round(correct/total*100):0)+'점</div>'+
  '<p>총 '+total+'문제 중 '+correct+'문제 정답 · '+(total-correct)+'문제 오답/미응답</p>'+
  (currentSession.sourceBased?'<p class="aq-muted">참고한 파일: '+safe(currentSession.sourceName||'학습자료')+' · 파일 내용과 문제의 일치 여부는 직접 확인해 주세요.</p>':'')+
  '<p class="aq-muted">오답은 아래 오답노트에서 내 답·정답·해설을 확인하고 복습할 수 있습니다.</p>'+
  '<div class="aq-result-list"><h4>문제별 채점 결과</h4>'+details+'</div>'+
  '<button type="button" class="btn btn-primary" id="aqNew">다른 문제 만들기</button></div>';
 $('aqNew').addEventListener('click',function(){$('aqSetup').scrollIntoView({behavior:'smooth'})});
 renderHistory();
}
function startSession(qs,c,topic,sourceBased,mode,fromReview,skipConfirm){
 if(session&&!skipConfirm&&!confirm('현재 진행 중인 연습을 종료하고 새로 시작할까요?'))return false;
 clearInterval(examClock);examClock=null;
 const selectedMode=mode==='exam'?'exam':'practice';
 session={
  questions:qs.map(x=>({...x})),idx:0,answers:qs.map(()=>null),checked:qs.map(()=>false),
  mode:selectedMode,certId:c.id,certName:c.name,topic,sourceBased,sourceName:sourceBased?fileName:'',
  fromReview:Boolean(fromReview),startedAt:Date.now(),
  examEndsAt:selectedMode==='exam'?Date.now()+qs.length*120000:null
 };
 if(selectedMode==='exam')examClock=setInterval(updateClock,1000);
 showQuestion();$('aqPlay').scrollIntoView({block:'start',behavior:'smooth'});
 return true;
}
async function generate(e){
 e.preventDefault();if(loading)return;
 const c=current();if(!c)return status('먼저 자격증을 등록해 주세요.',true);
 const topic=$('aqCustomTopic').value.trim()||$('aqSubject').value;
 if(!topic)return status('공부할 과목이나 주제를 선택해 주세요.',true);
 if($('aqUseFile').checked&&sourceText.length<80)return status('첨부자료를 다시 선택해 주세요.',true);
 if(session&&!confirm('현재 풀고 있는 문제를 종료하고 새 문제를 생성할까요?'))return;
 const count=Number($('aqCount').value);
 if(![5,10,20].includes(count))return status('문제 수는 5·10·20문제 중 선택하세요.',true);
 loading=true;$('aqGenerate').disabled=true;$('aqGenerate').textContent='문제 생성 중…';
 status('Gemini에 '+count+'문제를 요청하고 있습니다. 5문제 단위로 나눠 생성하므로 시간이 걸릴 수 있습니다.');
 try{
  const weaknesses=saved.wrong.filter(w=>w.certId===c.id).slice(0,5).map(w=>w.topic);
  const body={
   certName:c.name,stage:stage(c),subject:topic,type:$('aqType').value,
   difficulty:$('aqDifficulty').value,count,
   useSource:$('aqUseFile').checked,
   sourceText:$('aqUseFile').checked?sourceText:'',
   sourceName:$('aqUseFile').checked?fileName:'',weaknesses
  };
  const response=await fetch('/api/generate-quiz',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let result;
  try{result=await response.json()}catch(_){throw Error('서버 응답을 읽지 못했습니다.')}
  if(!response.ok||!result.ok)throw Error(result.message||'AI 문제 생성에 실패했습니다.');
  if(!Array.isArray(result.questions)||result.questions.length!==count)throw Error('요청한 문제 수가 모두 생성되지 않았습니다. 다시 시도해 주세요.');
  const mode=$('aqMode').value;
  status(count+'문제 생성 완료 · '+(mode==='exam'?'모의시험':'연습 모드')+' 시작');
  startSession(result.questions,c,topic,Boolean(body.useSource),mode,false,true);
 }catch(err){status(err.message||'생성 실패',true)}
 finally{loading=false;$('aqGenerate').disabled=!data().certs.length;$('aqGenerate').textContent='✦ AI 연습문제 생성'}
}
function renderStats(){
 const box=$('aqStats');if(!box)return;
 const certId=$('aqCert')?.value;
 const histories=saved.history.filter(h=>h.certId===certId);
 const total=histories.reduce((n,h)=>n+(Number(h.answered)||0),0);
 const right=histories.reduce((n,h)=>n+(Number(h.correct)||0),0);
 const topics={};
 for(const h of histories){
  const parts=h.byTopic&&typeof h.byTopic==='object'?h.byTopic:{[h.topic||'기타']:{answered:h.answered,correct:h.correct}};
  for(const [name,v] of Object.entries(parts)){
   const t=topics[name]||{total:0,correct:0};
   t.total+=Number(v.answered)||0;t.correct+=Number(v.correct)||0;topics[name]=t;
  }
 }
 const sorted=Object.entries(topics).sort((a,b)=>a[1].correct/Math.max(1,a[1].total)-b[1].correct/Math.max(1,b[1].total)).slice(0,8);
 box.innerHTML=histories.length?
  '<h3>과목·개념별 정답률</h3><p class="aq-muted">선택한 자격증의 풀이 기록 · 전체 '+total+'문제 / 정답률 '+(total?Math.round(right/total*100):0)+'%</p>'+
  sorted.map(([name,v])=>{
   const pct=v.total?Math.round(v.correct/v.total*100):0;
   return '<div class="aq-stat-row"><div><strong>'+safe(name)+'</strong><small>'+v.correct+'/'+v.total+' · '+pct+'%</small></div><div class="aq-progress"><span style="width:'+pct+'%"></span></div></div>';
  }).join('')+
  '<p class="aq-muted">정답률이 낮은 개념을 선택해 다시 생성하면 약점 연습에 도움이 됩니다.</p>':
  '<p class="aq-muted">문제를 풀고 채점하면 과목별 정답률이 나타납니다.</p>';
}
function renderHistory(){
 const history=$('aqHistory');if(!history)return;
 const certId=$('aqCert')?.value;
 const list=saved.history.filter(h=>h.certId===certId).slice(0,8);
 history.innerHTML=list.length?list.map(h=>
  '<div class="aq-history-item"><span>'+safe(h.certName)+' · '+safe(h.topic)+'<br><small>'+
  safe((h.date||'').slice(0,10))+' · '+(h.mode==='exam'?'모의시험':'연습')+
  (h.sourceBased?' · 파일 참고':'')+'</small></span><b>'+h.correct+'/'+h.answered+'</b></div>').join(''):
  '<p class="aq-muted">이 자격증의 풀이 기록이 없습니다.</p>';
 const wrong=saved.wrong.filter(w=>w.certId===certId);
 $('aqWrong').innerHTML=wrong.length?
  '<div class="aq-wrong-head"><h3>오답노트 · '+wrong.length+'문제</h3><button type="button" id="aqReviewAll">전체 복습</button></div>'+
  wrong.slice(0,30).map((w,i)=>{
   const q=w.question||{},answer=Number.isInteger(w.selected)?w.selected:null;
   return '<details class="aq-wrong-entry"><summary>'+safe(w.topic||'핵심 개념')+' · '+safe(q.question||'문제')+'</summary>'+
    '<p><b>내가 선택한 답:</b> '+safe(choiceName(q,answer))+'</p>'+
    '<p><b>정답:</b> '+safe(choiceName(q,q.correctIndex))+'</p>'+
    '<p><b>해설:</b> '+safe(q.explanation||'해설 없음')+'</p>'+
    (w.sourceName?'<p class="aq-muted">참고한 자료: '+safe(w.sourceName)+'</p>':'')+
    '<button type="button" data-aq-review-one="'+i+'">이 문제 다시 풀기</button></details>';
  }).join(''):'<p class="aq-muted">틀린 문제는 여기에 내 답·정답·해설과 함께 저장됩니다.</p>';
 $('aqReviewAll')?.addEventListener('click',function(){
  const ws=wrong.slice(0,20);if(!ws.length)return;
  const cert=data().certs.find(c=>c.id===certId)||{id:certId,name:ws[0].certName};
  startSession(ws.map(w=>w.question),cert,'오답 복습',false,'practice',true);
 });
 $('aqWrong').querySelectorAll('[data-aq-review-one]').forEach(function(btn){
  btn.addEventListener('click',function(){
   const w=wrong[Number(btn.dataset.aqReviewOne)];
   if(!w)return;
   const cert=data().certs.find(c=>c.id===certId)||{id:certId,name:w.certName};
   startSession([w.question],cert,'오답 복습',false,'practice',true);
  })
 });
 renderStats();
}
function open(certId){
 bridge()?.navigate('quiz');selectCert(certId);
 document.getElementById('screen-quiz')?.scrollIntoView({block:'start'});
}
function init(){
 if(!$('aqForm'))return;
 selectCert();renderHistory();
 $('aqCert').addEventListener('change',function(){selectCert($('aqCert').value);renderHistory()});
 $('aqFile').addEventListener('change',e=>readFile(e.target.files?.[0]));
 $('aqForm').addEventListener('submit',generate);
 document.addEventListener('certcal:data-changed',function(){selectCert($('aqCert').value);renderHistory()});
 document.addEventListener('certcal:quiz-changed',function(){saved=read();renderHistory()});
 document.addEventListener('click',function(e){const btn=e.target.closest('[data-ai-open]');if(btn)open(btn.dataset.aiOpen)});
}
window.CertQuiz={open};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();