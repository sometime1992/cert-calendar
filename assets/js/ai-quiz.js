(()=>{
'use strict';
// All audio/file processing is local; only selected extracted text goes to /api/generate-quiz.
const $=id=>document.getElementById(id);
const bridge=()=>window.CertCalendarBridge;
const STORAGE='cert-calendar-quiz-v1';
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
 if(!file){$('aqFileStatus').textContent='첨부하지 않으면 선택한 과목으로 문제를 만듭니다.';return}
 $('aqFileStatus').textContent='파일에서 글자를 읽는 중입니다…';
 try{
  const text=await extract(file);
  const normalized=text.replace(/\u0000/g,'').replace(/[\t ]+/g,' ').trim();
  if(normalized.length<80)throw Error('읽을 수 있는 글자가 부족합니다. 이미지형 PDF는 OCR 처리 후 다시 올려주세요.');
  fileName=file.name;sourceText=normalized.slice(0,14000);
  $('aqUseFile').disabled=false;$('aqUseFile').checked=true;
  $('aqFileStatus').textContent=`${file.name} · 추출 ${normalized.length.toLocaleString()}자 · AI에 보낼 최대 ${sourceText.length.toLocaleString()}자`+
   (normalized.length>14000?' (일부만 참고)':'');
 }catch(e){$('aqFileStatus').textContent=e.message||'파일을 읽지 못했습니다.';status(e.message||'파일을 읽지 못했습니다.',true)}
}
function promptChoices(q){const alphabet=['①','②','③','④'];return q.options.map((opt,i)=>
 `<button type="button" class="aq-choice ${session.answer===i?'selected':''} ${session.checked&&q.correctIndex===i?'correct':''} ${session.checked&&session.answer===i&&session.answer!==q.correctIndex?'incorrect':''}" data-aq-answer="${i}" ${session.checked?'disabled':''}><b>${q.type==='ox'?opt:alphabet[i]}</b><span>${safe(q.type==='ox'?(opt==='O'?'맞다 (O)':'틀리다 (X)'):opt)}</span></button>`).join('')}
function showQuestion(){const box=$('aqPlay');if(!session||session.idx>=session.questions.length)return;
 const q=session.questions[session.idx];
 box.innerHTML=`<div class="aq-question-top"><span class="aq-topic">${safe(q.topic||session.topic)}</span><span class="aq-counter">${session.idx+1} / ${session.questions.length}</span></div>
 <h2 class="aq-question">${safe(q.question)}</h2><div class="aq-choices">${promptChoices(q)}</div>
 ${session.checked?`<div class="aq-explain"><strong>${session.answer===q.correctIndex?'✓ 정답입니다':'정답: '+(q.type==='ox'?q.options[q.correctIndex]:['①','②','③','④'][q.correctIndex])}</strong>${safe(q.explanation)}</div>`:''}
 <div class="aq-actions">${session.checked?`<button type="button" class="btn btn-primary" id="aqNext">${session.idx+1===session.questions.length?'결과 확인':'다음 문제 →'}</button>`:
 `<button type="button" class="btn btn-primary" id="aqCheck" ${session.answer===null?'disabled':''}>정답 확인</button>`}
 <button type="button" class="btn btn-outline" id="aqEnd">연습 종료</button></div><p class="aq-caveat">AI 생성 연습문제이며 공식 기출문제와 다릅니다. 정답·해설은 반드시 학습자료로 재확인해 주세요.</p>`;
 box.querySelectorAll('[data-aq-answer]').forEach(btn=>btn.addEventListener('click',()=>{session.answer=+btn.dataset.aqAnswer;showQuestion()}));
 box.querySelector('#aqCheck')?.addEventListener('click',checkAnswer);
 box.querySelector('#aqNext')?.addEventListener('click',()=>{session.idx++;session.answer=null;session.checked=false;if(session.idx>=session.questions.length)finish();else showQuestion()});
 box.querySelector('#aqEnd')?.addEventListener('click',()=>{if(confirm('지금까지 푼 문제만 결과로 저장할까요?'))finish()});
}
function checkAnswer(){const q=session.questions[session.idx];if(session.answer===null)return;
 session.checked=true;
 const correct=session.answer===q.correctIndex;
 session.answered.push({id:q.id,correct,selected:session.answer});
 if(!correct){const key=`${session.certId}:${q.question}`;if(!saved.wrong.some(w=>w.key===key))saved.wrong.unshift({key,certId:session.certId,certName:session.certName,topic:q.topic||session.topic,question:q,addedAt:new Date().toISOString()})}
 else saved.wrong=saved.wrong.filter(w=>w.question.question!==q.question||w.certId!==session.certId);
 persist();showQuestion();
}
function finish(){const correct=session.answered.filter(x=>x.correct).length,total=session.answered.length;
 const h={id:crypto.randomUUID(),certId:session.certId,certName:session.certName,topic:session.topic,answered:total,correct,sourceBased:session.sourceBased,date:new Date().toISOString()};
 if(total)saved.history.unshift(h);persist();
 $('aqPlay').innerHTML=`<div class="aq-summary"><span class="micro">SESSION COMPLETE</span><h3>${safe(session.certName)} · 연습 결과</h3><div class="aq-score">${total?Math.round(correct/total*100):0}점</div><p>총 ${total}문제 중 ${correct}문제 정답 · ${total-correct}문제 오답</p><p class="aq-muted">틀린 문제는 오답노트에 저장되었습니다. 복습하기를 누르면 AI 호출 없이 다시 풀 수 있습니다.</p><button type="button" class="btn btn-primary" id="aqNew">다른 문제 만들기</button></div>`;
 $('aqNew').addEventListener('click',()=>$('aqSetup').scrollIntoView({behavior:'smooth'}));
 session=null;
}
function startSession(qs,c,topic,sourceBased){session={questions:qs.map(x=>({...x})),idx:0,answer:null,checked:false,answered:[],certId:c.id,certName:c.name,topic,sourceBased};
 showQuestion();$('aqPlay').scrollIntoView({block:'start',behavior:'smooth'});
}
async function generate(e){e.preventDefault();if(loading)return;
 const c=current();if(!c)return status('먼저 준비 중인 자격증을 등록해 주세요.',true);
 const topic=$('aqCustomTopic').value.trim()||$('aqSubject').value;
 if(!topic)return status('공부할 과목 또는 주제를 입력해 주세요.',true);
 if($('aqUseFile').checked&&sourceText.length<80)return status('학습자료 파일을 다시 선택해 주세요.',true);
 loading=true;$('aqGenerate').disabled=true;$('aqGenerate').textContent='문제 생성 중…';status('Gemini가 새로운 연습문제를 생성하고 있습니다.');
 try{
  const weaknesses=saved.wrong.filter(w=>w.certId===c.id).slice(0,5).map(w=>w.topic);
  const body={certName:c.name,stage:stage(c),subject:topic,type:$('aqType').value,difficulty:$('aqDifficulty').value,count:Number($('aqCount').value),
   useSource:$('aqUseFile').checked,sourceText:$('aqUseFile').checked?sourceText:'',sourceName:$('aqUseFile').checked?fileName:'',weaknesses};
  const r=await fetch('/api/generate-quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await r.json();if(!r.ok||!result.ok)throw Error(result.message||'AI 문제가 생성되지 않았습니다.');
  if(!Array.isArray(result.questions)||!result.questions.length)throw Error('생성된 문제를 확인할 수 없습니다.');
  status(`${result.questions.length}문제 생성 완료 · AI 문제는 비공식 연습용입니다.`);
  startSession(result.questions,c,topic,Boolean(body.useSource));
 }catch(err){status(err.message||'AI 호출에 실패했습니다.',true)}
 finally{loading=false;$('aqGenerate').disabled=!data().certs.length;$('aqGenerate').textContent='✦ AI 연습문제 생성'}
}
function renderHistory(){const history=$('aqHistory');if(!history)return;
 history.innerHTML=saved.history.length?saved.history.slice(0,8).map(h=>`<div class="aq-history-item"><span>${safe(h.certName)} · ${safe(h.topic)}<br><small>${safe((h.date||'').slice(0,10))}${h.sourceBased?' · 파일 참고':''}</small></span><b>${h.correct}/${h.answered}</b></div>`).join(''):'<p class="aq-muted">아직 푼 문제가 없습니다.</p>';
 const counts={};for(const w of saved.wrong)counts[w.certId]=(counts[w.certId]||0)+1;
 $('aqWrong').innerHTML=saved.wrong.length?`<h3>오답노트 · ${saved.wrong.length}문제</h3><div class="aq-wrong-list">${Object.entries(counts).map(([id,n])=>{
  const name=saved.wrong.find(w=>w.certId===id).certName;return `<button type="button" data-aq-review="${safe(id)}">${safe(name)} ${n}문제 복습</button>`}).join('')}</div>`:'<p class="aq-muted">오답은 자동으로 저장됩니다.</p>';
 $('aqWrong').querySelectorAll('[data-aq-review]').forEach(btn=>btn.addEventListener('click',()=>{
  const ws=saved.wrong.filter(w=>w.certId===btn.dataset.aqReview).slice(0,20);if(!ws.length)return;
  const cert=data().certs.find(c=>c.id===btn.dataset.aqReview)||{id:btn.dataset.aqReview,name:ws[0].certName};
  startSession(ws.map(w=>w.question),cert,'오답 복습',false);
 }));
}
function open(certId){bridge()?.navigate('quiz');selectCert(certId);document.getElementById('screen-quiz')?.scrollIntoView({block:'start'});}
function init(){if(!$('aqForm'))return;
 selectCert();renderHistory();
 $('aqCert').addEventListener('change',()=>selectCert($('aqCert').value));
 $('aqFile').addEventListener('change',e=>readFile(e.target.files?.[0]));
 $('aqForm').addEventListener('submit',generate);
 document.addEventListener('certcal:data-changed',()=>selectCert($('aqCert').value));
 document.addEventListener('certcal:quiz-changed',()=>{saved=read();renderHistory()});
 document.addEventListener('click',e=>{const btn=e.target.closest('[data-ai-open]');if(btn)open(btn.dataset.aiOpen)});
}
window.CertQuiz={open};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();