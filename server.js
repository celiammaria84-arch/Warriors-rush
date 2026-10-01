// Warriors Rush — servidor de salas e relay (Node 18+, dependência: ws)
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,INDEX=path.join(__dirname,'index.html');
const srv=http.createServer((req,res)=>{
  if(req.url==='/health'){res.end('ok');return}
  fs.readFile(INDEX,(e,b)=>{if(e){res.writeHead(404);res.end('index.html não encontrado');return}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(b)})});
const wss=new WebSocketServer({server:srv,maxPayload:32*1024});
const rooms=new Map();let queue=null;
const send=(w,o)=>{if(w&&w.readyState===1)w.send(JSON.stringify(o))};
// o que cada papel pode enviar ao outro (limita abuso)
const ALLOW={host:new Set(['hello','snap']),guest:new Set(['hello','in','act','eq'])};
function newCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let c;do{c='';for(let i=0;i<4;i++)c+=A[Math.random()*A.length|0]}while(rooms.has(c));return c}
function pair(h,g){h.peer=g;g.peer=h;h.role='host';g.role='guest';send(h,{t:'start',role:'host'});send(g,{t:'start',role:'guest'})}
function leave(w){
  if(queue===w)queue=null;
  if(w.room){if(rooms.get(w.room)&&rooms.get(w.room).h===w)rooms.delete(w.room);w.room=null}
  if(w.peer){send(w.peer,{t:'left'});w.peer.peer=null;w.peer.role=null;w.peer=null}
  w.role=null}
wss.on('connection',ws=>{
  ws.alive=true;ws.n=0;ws.on('pong',()=>{ws.alive=true});
  ws.on('message',raw=>{
    if(++ws.n>150)return;let m;try{m=JSON.parse(raw)}catch(e){return}
    if(!m||typeof m.t!=='string')return;
    if(m.t==='r'){if(!ws.peer||!m.d||!ALLOW[ws.role].has(m.d.k))return;send(ws.peer,m);return}
    if(m.t==='cancel'){leave(ws);return}
    if(ws.peer)return;
    if(m.t==='create'){leave(ws);const c=newCode();ws.room=c;rooms.set(c,{h:ws});send(ws,{t:'room',code:c})}
    else if(m.t==='join'){const c=String(m.code||'').toUpperCase().trim(),r=rooms.get(c);
      if(!r||r.h===ws||r.h.readyState!==1){send(ws,{t:'err',m:'Sala não encontrada'});return}
      rooms.delete(c);r.h.room=null;pair(r.h,ws)}
    else if(m.t==='queue'){leave(ws);if(queue&&queue!==ws&&queue.readyState===1){const h=queue;queue=null;pair(h,ws)}else queue=ws}});
  ws.on('close',()=>leave(ws));ws.on('error',()=>{})});
setInterval(()=>wss.clients.forEach(w=>{w.n=0}),1000);
setInterval(()=>wss.clients.forEach(w=>{if(!w.alive)return w.terminate();w.alive=false;w.ping()}),15000);
srv.listen(PORT,()=>console.log('Warriors Rush online na porta '+PORT));
