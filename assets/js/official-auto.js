(()=>{
'use strict';
const CODES={
 '정보처리기사':{code:'1320',level:'기사'},
 '정보처리산업기사':{code:'2290',level:'산업기사'},
 '전기기사':{code:'1150',level:'기사'},
 '전기기능사':{code:'7780',level:'기능사'},
 '한식조리기능사':{code:'7910',level:'기능사'}
};
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(a,b)=>a?a+(b&&a!==b?' ~ '+b:''):'날짜 미제공';
let activeRequest=0;
function setStatus(node,text,error){node.textContent=text;node.style.color=error?'#b42332':'#526482'}
function addLine(host,label,begin,end){const row=document.createElement('div');row.className='auto-detail-line';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=fmt(begin,end);row.append(a,b);host.append(row)}
function setup(form,details){
 const box=document.createElement('section');box.className='auto-schedule-block';
 const thisYear=new Date().getFullYear();
 const opts=Object.entries(CODES).map(([name,value])=>'<option value="'+safe(name)+'">'+safe(name)+'</option>').join('');
 const years=[thisYear-1,thisYear,thisYear+1].map(y=>'<option value="'+y+'"'+(y===thisYear?' selected':'')+'>'+y+'년</option>').join('');
 box.innerHTML='<div class="auto-schedule-header"><div><strong>공식 시험 일정 자동 입력</strong><p>자격증과 시험 회차를 선택하면 아래 날짜가 자동으로 채워집니다.</p></div><span class="auto-official-tag">Q-Net 공공데이터</span></div>'+
 '<div class="auto-row"><label>자격증<select id="autoCertName" class="field-input"><option value="">선택하세요</option>'+opts+'</select></label><label>시행연도<select id="autoYear" class="field-input">'+years+'</select></label></div>'+
 '<button type="button" id="autoLookup" class="btn btn-secondary full">공식 일정 조회</button><p id="autoStatus" class="hint" role="status" aria-live="polite"></p><div id="autoRounds"></div><input type="hidden" id="officialAutoMetadata"><p class="hint">회차를 선택한 뒤 화면 아래 저장하기를 누르세요. 접수 전 <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer">Q-Net 공고</a>를 확인하세요.</p>';
 form.insertBefore(box,form.firstElementChild);
 const select=$('autoCertName'),year=$('autoYear'),status=$('autoStatus'),results=$('autoRounds'),button=$('autoLookup');
 const initial=String(details?.name||'').trim();
 select.value=CODES[initial]?initial:'';
 setStatus(status,initial&&!CODES[initial]?'이 종목은 자동 연결이 준비되지 않았습니다. 아래에서 날짜를 직접 입력할 수 있습니다.':'원하는 자격증의 시험 회차를 조회하세요.',!!(initial&&!CODES[initial]));
 function apply(item,index){
  const valueMap={regDate:item.docRegStartDt,examDate:item.docExamStartDt,practicalRegDate:item.pracRegStartDt,practicalExamDate:item.pracExamStartDt,resultDate:item.pracPassDt||item.docPassDt};
  if(!Object.values(valueMap).some(Boolean)){setStatus(status,'이 회차에는 입력할 수 있는 날짜가 없습니다.',true);return}
  for(const [k,v] of Object.entries(valueMap)){const target=form.querySelector('[name="'+k+'"]');if(target){target.value=v||'';target.dispatchEvent(new Event('change',{bubbles:true}))}}
  const entry=CODES[select.value];
  $('officialAutoMetadata').value=JSON.stringify({year:String(year.value),round:String(item.round||''),jmCd:entry.code,source:'https://www.data.go.kr/data/15074408/openapi.do',importedAt:new Date().toISOString(),endDates:{docRegEndDt:item.docRegEndDt||'',docExamEndDt:item.docExamEndDt||'',pracRegEndDt:item.pracRegEndDt||'',pracExamEndDt:item.pracExamEndDt||''}});
  results.querySelectorAll('.auto-round').forEach(x=>x.classList.remove('chosen'));
  results.querySelectorAll('button').forEach(x=>x.textContent='이 회차 선택');
  const card=results.querySelector('[data-result-index="'+index+'"]');if(card){card.classList.add('chosen');card.querySelector('button').textContent='선택됨 ✓'}
  setStatus(status,'제'+(item.round||'?')+'회 일정이 자동 입력되었습니다. 아래 저장하기를 누르세요.');
 }
 async function lookup(){
  const name=select.value,match=CODES[name];
  if(!match){setStatus(status,'자동 조회할 자격증을 먼저 선택해 주세요.',true);return}
  const seq=++activeRequest;results.replaceChildren();button.disabled=true;setStatus(status,'Q-Net 공공데이터에서 시험 일정을 조회하고 있습니다…');
  try{
   const response=await fetch('/api/schedules?year='+encodeURIComponent(year.value)+'&jmCd='+encodeURIComponent(match.code),{cache:'no-store'});
   const data=await response.json();
   if($('certForm')!==form||seq!==activeRequest)return;
   if(!response.ok||data.ok!==true)throw Error(data.message||'공공데이터 조회 실패');
   if(!Array.isArray(data.items)||data.items.length===0){setStatus(status,'해당 연도의 발표된 일정이 없습니다. 다른 연도를 선택하거나 Q-Net 공고를 확인해 주세요.');return}
   setStatus(status,'공식 일정 '+data.items.length+'건 조회 · 원하는 회차를 선택하세요.');
   data.items.forEach((item,index)=>{
    const card=document.createElement('div');card.className='auto-round';card.dataset.resultIndex=String(index);
    const heading=document.createElement('strong');heading.textContent=(item.year||year.value)+'년 제'+(item.round||'?')+'회';card.append(heading);
    addLine(card,'필기 접수',item.docRegStartDt,item.docRegEndDt);addLine(card,'필기 시험',item.docExamStartDt,item.docExamEndDt);
    addLine(card,'필기 발표',item.docPassDt);addLine(card,'실기 접수',item.pracRegStartDt,item.pracRegEndDt);
    addLine(card,'실기 시험',item.pracExamStartDt,item.pracExamEndDt);addLine(card,'최종 발표',item.pracPassDt);
    const choose=document.createElement('button');choose.type='button';choose.className='btn btn-secondary btn-small';choose.textContent='이 회차 선택';choose.addEventListener('click',()=>apply(item,index));card.append(choose);results.append(card);
   });
  }catch(e){if($('certForm')===form&&seq===activeRequest)setStatus(status,'조회 실패: '+String(e.message||e),true)}
  finally{if($('certForm')===form&&seq===activeRequest)button.disabled=false}
 }
 select.addEventListener('change',()=>{++activeRequest;results.replaceChildren();$('officialAutoMetadata').value='';if(select.value){$('certName').value=select.value;$('certLevel').value=CODES[select.value].level;lookup()}else setStatus(status,'자격증을 먼저 선택하세요.')});
 year.addEventListener('change',()=>{++activeRequest;results.replaceChildren();$('officialAutoMetadata').value='';if(select.value)lookup()});
 button.addEventListener('click',lookup);
 if(select.value)lookup();
}
document.addEventListener('cert-calendar:cert-form-open',event=>{const form=$('certForm');if(form)setup(form,event.detail||{})});
})();