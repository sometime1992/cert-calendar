const API='https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList';
const SOURCE='https://www.data.go.kr/data/15074408/openapi.do';
const json=(data,status=200,cache=0)=>Response.json(data,{status,headers:{'Cache-Control':cache?'public, max-age='+cache+', s-maxage='+cache:'no-store','X-Content-Type-Options':'nosniff'}});
function normalizeDate(v){const x=String(v??'').replace(/[^0-9]/g,'');if(!/^\d{8}$/.test(x))return '';const iso=x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8);const d=new Date(iso+'T12:00:00Z');return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===iso?iso:''}
function normalize(row){const d=Object.fromEntries(Object.entries(row).map(([k,v])=>[k.toLowerCase(),v]));const get=k=>String(d[k.toLowerCase()]??'').trim();return {year:get('implYy'),round:get('implSeq'),description:get('description'),jmCd:get('jmCd'),docRegStartDt:normalizeDate(get('docRegStartDt')),docRegEndDt:normalizeDate(get('docRegEndDt')),docExamStartDt:normalizeDate(get('docExamStartDt')),docExamEndDt:normalizeDate(get('docExamEndDt')),docPassDt:normalizeDate(get('docPassDt')),pracRegStartDt:normalizeDate(get('pracRegStartDt')),pracRegEndDt:normalizeDate(get('pracRegEndDt')),pracExamStartDt:normalizeDate(get('pracExamStartDt')),pracExamEndDt:normalizeDate(get('pracExamEndDt')),pracPassDt:normalizeDate(get('pracPassDt'))}}
export async function onRequestGet({request,env}){
 const params=new URL(request.url).searchParams,year=Number(params.get('year')),jmCd=(params.get('jmCd')||'').trim(),thisYear=new Date().getUTCFullYear();
 if(!Number.isInteger(year)||year<2020||year>thisYear+2)return json({ok:false,code:'INVALID_YEAR',message:'시행연도를 확인해 주세요.'},400);
 if(!/^\d{4}$/.test(jmCd))return json({ok:false,code:'INVALID_JM_CODE',message:'공식 종목코드 숫자 4자리를 입력해 주세요.'},400);
 if(!env.DATA_GO_KR_API_KEY)return json({ok:false,code:'KEY_NOT_CONFIGURED',message:'Cloudflare Secret DATA_GO_KR_API_KEY를 등록해 주세요.'},503);
 let key=String(env.DATA_GO_KR_API_KEY).trim();try{if(/%[0-9a-fA-F]{2}/.test(key))key=decodeURIComponent(key)}catch(_){}
 const url=new URL(API);for(const [k,v] of Object.entries({serviceKey:key,implYy:String(year),qualgbCd:'T',jmCd,dataFormat:'json',numOfRows:'50',pageNo:'1'}))url.searchParams.set(k,v);
 let response;try{response=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)})}catch(_){return json({ok:false,code:'UPSTREAM_UNAVAILABLE',message:'공공데이터 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'},502)}
 if(!response.ok)return json({ok:false,code:'UPSTREAM_HTTP_ERROR',message:'공공데이터 API HTTP 오류 ('+response.status+'). 활용신청 상태를 확인해 주세요.'},502);
 let payload;try{payload=await response.json()}catch(_){return json({ok:false,code:'INVALID_UPSTREAM_FORMAT',message:'응답이 JSON 형식이 아닙니다. API 승인 또는 인증키 유형을 확인해 주세요.'},502)}
 const wrap=payload?.response||payload;const code=String(wrap?.header?.resultCode??'00');
 if(!['00','0'].includes(code))return json({ok:false,code:'UPSTREAM_API_ERROR',upstreamCode:code,message:'공공데이터 API 오류: '+String(wrap?.header?.resultMsg||'인증 또는 조회조건을 확인해 주세요.').slice(0,160)},502);
 const body=wrap?.body||{}, raw=body.items?.item??body.items??payload?.items??[];
 const list=Array.isArray(raw)?raw:(raw&&typeof raw==='object'?[raw]:[]);
 const items=list.filter(x=>x&&typeof x==='object').slice(0,50).map(normalize);
 return json({ok:true,year,jmCd,items,totalCount:Number(body.totalCount)||items.length,receivedAt:new Date().toISOString(),source:SOURCE,message:items.length?'공식 API에서 조회했습니다. 실제 접수 전 Q-Net 공고를 확인해 주세요.':'해당 연도·종목으로 조회된 일정이 없습니다.'},200,1800);
}