export async function onRequestGet({env}){
 const configured=Boolean(env.DATA_GO_KR_API_KEY);
 return Response.json({ok:true,configured,officialSyncReady:configured,source:'https://www.data.go.kr/data/15074408/openapi.do',message:configured?'인증키가 등록되어 있습니다. 자격증 찾기에서 공식 시험일정을 조회할 수 있습니다.':'Cloudflare에 DATA_GO_KR_API_KEY Secret을 등록해 주세요.'},{headers:{'Cache-Control':'no-store'}});
}