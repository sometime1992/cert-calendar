(()=>{
'use strict';
const KEY='cert-calendar-personal-v1';
const known={'1320':['정보처리기사','기사'],'2290':['정보처리산업기사','산업기사'],'1150':['전기기사','기사'],'7780':['전기기능사','기능사'],'7910':['한식조리기능사','기능사']};
const host=document.querySelector('#screen-search .search-panel');if(!host)return;
const panel=document.createElement('section');panel.className='card section-card official-box';
panel.innerHTML='<span class="micro">OFFICIAL SCHEDULE</span><h2>공식 시험 일정 조회</h2><p class="support-copy">시험 연도와 종목코드 4자리를 입력하면 공공데이터 시험일정을 조회할 수 있어요.</p><div class="official-picks"><button type="button" data-code="1320">정보처리기사</button><button type="button" data-code="1150">전기기사</button><button type="button" data-code="7780">전기기능사</button><button type="button" data-code="7910">한식조리기능사</button></div><form id="officialForm" class="official-form"><label>시행연도<select id="officialYear" class="field-input"></select></label><label>종목코드<input id="officialCode" class="field-input" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" required placeholder="1320"></label><label>내 자격증 이름<input id="officialName" class="field-input" maxlength="80" placeholder="정보처리기사"></label><button id="officialSubmit" type="submit" class="btn btn-primary">공식 일정 조회</button></form><p id="officialState" role="status" aria-live="polite">종목을 선택하고 조회해 주세요.</p><div id="officialResults"></div><p class="hint">공공데이터 조회 결과는 변경될 수 있으므로 실제 접수 전 <a target="_blank" rel="noopener noreferrer" href="https://www.q-net.or.kr">Q-Net 공식 공고</a>를 확인하세요. 내 공부 기록은 자동으로 변경되지 않습니다.</p>';
host.before(panel);
const css=document.createElement('style');css.textContent='.official-box{margin-bottom:22px;padding:24px}.official-form{display:grid;grid-template-columns:110px 140px minmax(150px,1fr) auto;gap:10px;align-items:end;margin:16px 0}.official-form label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#43526d}.official-form .field-input{height:44px;width:100%;box-sizing:border-box}.official-form button{min-height:44px}.official-picks{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.official-picks button{border:1px solid #dce4f4;border-radius:18px;padding:8px 12px;background:#f4f6ff;color:#4556ae;cursor:pointer;font-weight:700}.official-date{display:flex;gap:12px;justify-content:space-between;padding:9px 0;border-bottom:1px solid #e6ecf8;font-size:14px}.official-date strong{text-align:right}.official-entry{border:1px solid #dee5f5;padding:15px;border-radius:16px;margin-top:12px;background:#f9faff}.official-entry h3{font-size:17px;margin:0 0 8px}#officialState{font-size:14px;color:#526482;min-height:22px}@media(max-width:760px){.official-box{padding:17px}.official-form{grid-template-columns:1fr 1fr}.official-form label:nth-child(3),.official-form button{grid-column:1/-1}.official-date{font-size:13px}}';document.head.append(css);
const $=id=>document.getElementById(id),year=$('officialYear'),code=$('officialCode'),name=$('officialName'),result=$('officialResults'),state=$('officialState');
const now=new Date().getFullYear();for(let y=now+1;y>=now-1;y--){const o=document.createElement('option');o.value=y;o.textContent=y+'년';if(y===now)o.selected=true;year.append(o)}
function choose(v){code.value=v;if(known[v])name.value=known[v][0]}
panel.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.code)));
code.addEventListener('change',()=>{if(known[code.value])name.value=known[code.value][0]});choose('1320');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
function dates(card,label,begin,end){const r=el('div',undefined,'official-date');r.append(el('span',label),el('strong',begin?begin+(end&&end!==begin?' ~ '+end:''):'일정 없음'));card.append(r)}
function saveEntry(item){
 const displayName=name.value.trim()||known[code.value.trim()]?.[0];
 if(!displayName)return alert('등록할 자격증 이름을 입력해 주세요.');
 if(!['docRegStartDt','docExamStartDt','pracRegStartDt','pracExamStartDt','pracPassDt'].some(k=>item[k]))return alert('저장할 시험 날짜가 없습니다.');
 let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}
 if(!data||!Array.isArray(data.certs)||!Array.isArray(data.tasks)||!Array.isArray(data.sessions))return alert('개인 기록을 불러오지 못했습니다. 개인 관리 화면에서 먼저 자격증을 등록해 주세요.');
 const cert=data.certs.find(x=>x.name===displayName);
 if(!confirm(cert?displayName+'의 기존 시험 날짜를 이 회차 일정으로 교체할까요? 공부 기록은 유지됩니다.':displayName+'을 관심 자격증에 추가할까요?'))return;
 const values={regDate:item.docRegStartDt,examDate:item.docExamStartDt,practicalRegDate:item.pracRegStartDt,practicalExamDate:item.pracExamStartDt,resultDate:item.pracPassDt||item.docPassDt};
 const entry=cert||{id:crypto.randomUUID?.()||String(Date.now()),createdAt:new Date().toISOString(),name:displayName,level:known[code.value.trim()]?.[1]||'기타',field:'',notes:''};
 for(const [k,v] of Object.entries(values))if(v)entry[k]=v;
 entry.officialSchedule={year:item.year||year.value,round:item.round,jmCd:code.value.trim(),importedAt:new Date().toISOString()};
 if(!cert)data.certs.push(entry);
 try{localStorage.setItem(KEY,JSON.stringify(data));alert('시험일을 저장했습니다. D-day와 달력에 반영합니다.');location.reload()}catch(_){alert('개인 데이터 저장이 차단되어 있습니다.')}
}
$('officialForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const jmCd=code.value.trim();if(!/^\d{4}$/.test(jmCd)){state.textContent='종목코드 숫자 4자리를 입력해 주세요.';return}
 state.textContent='공식 시험일정을 조회하고 있습니다…';result.replaceChildren();const button=$('officialSubmit');button.disabled=true;
 try{const res=await fetch('/api/schedules?year='+encodeURIComponent(year.value)+'&jmCd='+encodeURIComponent(jmCd),{cache:'no-store'});const data=await res.json();if(!res.ok||!data.ok)throw Error(data.message||'일정 조회 오류');
 state.textContent=year.value+'년 종목코드 '+jmCd+' · '+data.items.length+'건 조회';
 if(!data.items.length)result.append(el('p','조회된 일정이 없습니다. 종목코드 또는 Q-Net 시행 공고를 확인해 주세요.','hint'));
 for(const item of data.items){const c=el('article',undefined,'official-entry');c.append(el('h3',(item.year||year.value)+'년 제'+(item.round||'?')+'회 시험'));if(item.description)c.append(el('p',item.description,'hint'));dates(c,'필기 접수',item.docRegStartDt,item.docRegEndDt);dates(c,'필기 시험',item.docExamStartDt,item.docExamEndDt);dates(c,'필기 합격 발표',item.docPassDt);dates(c,'실기 접수',item.pracRegStartDt,item.pracRegEndDt);dates(c,'실기 시험',item.pracExamStartDt,item.pracExamEndDt);dates(c,'실기 합격 발표',item.pracPassDt);const add=el('button','이 회차를 내 일정에 등록','btn btn-secondary btn-small');add.type='button';add.addEventListener('click',()=>saveEntry(item));c.append(add);result.append(c)}
 }catch(err){state.textContent=err.message||'서버 연결 오류';result.append(el('p','API 활용신청 승인 및 Cloudflare Secret 설정을 확인해 주세요.','hint'))}finally{button.disabled=false}
});
})();