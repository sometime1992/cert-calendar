// 공개된 공식 일정 API 사양과 종목코드가 검증되기 전에는 일정값을 임의 생성하지 않습니다.
export async function onRequestGet({env}){
 const configured=Boolean(env.DATA_GO_KR_API_KEY);
 return Response.json({ok:false,configured,code:'OFFICIAL_SCHEDULE_SYNC_NOT_READY',message:configured?'인증키는 등록되었으나 공식 시험일정 API 연동 검증이 아직 완료되지 않았습니다.':'공공데이터 인증키를 등록한 후 공식 API를 연결해야 합니다.',items:[],source:'https://www.data.go.kr/data/15074408/openapi.do'},{status:503,headers:{'Cache-Control':'no-store'}});
}
