export async function onRequestGet({env}){
 return Response.json({ok:true,configured:Boolean(env.DATA_GO_KR_API_KEY),officialSyncReady:false,source:'https://www.data.go.kr/data/15074408/openapi.do',message:'자격 관리 기능은 이용 가능합니다. 시험 일정 API는 명세·인증키 검증 후 활성화됩니다.'},{headers:{'Cache-Control':'no-store'}});
}
