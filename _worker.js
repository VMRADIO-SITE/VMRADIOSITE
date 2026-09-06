const MAINTENANCE_ENDPOINT='https://admin.vmradio.fr/api/public/maintenance';
const CACHE_MS=2000;
let cachedState={site:false,expires:0};

async function getMaintenanceState(){
  const now=Date.now();
  if(cachedState.expires>now)return cachedState.site;
  try{
    const response=await fetch(MAINTENANCE_ENDPOINT+'?_='+now,{
      headers:{'Accept':'application/json'},
      cf:{cacheTtl:0,cacheEverything:false}
    });
    if(!response.ok)throw new Error('maintenance api '+response.status);
    const data=await response.json();
    const site=data?.ok===true&&data?.site===true;
    cachedState={site,expires:now+CACHE_MS};
    return site;
  }catch(error){
    console.error('VM RADIO maintenance check failed',error);
    cachedState={site:false,expires:now+1000};
    return false;
  }
}

function isHtmlNavigation(request){
  if(request.method!=='GET'&&request.method!=='HEAD')return false;
  const accept=String(request.headers.get('Accept')||'');
  const url=new URL(request.url);
  const path=url.pathname.toLowerCase();
  if(path==='/maintenance.html')return false;
  if(accept.includes('text/html'))return true;
  return path==='/'||path.endsWith('/')||path.endsWith('.html');
}

export default {
  async fetch(request,env){
    const maintenance=await getMaintenanceState();
    if(maintenance&&isHtmlNavigation(request)){
      const url=new URL(request.url);
      url.pathname='/maintenance.html';
      url.search='';
      const response=await env.ASSETS.fetch(new Request(url.toString(),request));
      const headers=new Headers(response.headers);
      headers.set('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
      headers.set('Pragma','no-cache');
      headers.set('Expires','0');
      headers.set('X-VMRADIO-Maintenance','site');
      return new Response(request.method==='HEAD'?null:response.body,{
        status:503,
        statusText:'Service Unavailable',
        headers
      });
    }
    return env.ASSETS.fetch(request);
  }
};
