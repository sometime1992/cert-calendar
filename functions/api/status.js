export async function onRequestGet({env}){
 const configured=Boolean(env.DATA_GO_KR_API_KEY);
 return Response.json({ok:true,configured,officialSyncReady:null,source:'https://www.data.go.kr/data/15074408/openapi.do',message:configured?'인증키 변수 등록 확인. 실제 활용 승인 및 시험 일정 조회는 종목별 API 요청으로 검증해야 합니다.':'Cloudflare Secret DATA_GO_KR_API_KEY를 등록해 주세요.'},{headers:{'Cache-Control':'no-store'}});
}