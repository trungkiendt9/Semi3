'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Pool}=require('pg');const ExcelJS=require('exceljs');
const ROOT=__dirname,PORT=Number(process.env.PORT||3000),ADMIN_KEY=process.env.ADMIN_KEY||'',DB_URL=process.env.DATABASE_URL||'';
const BANK=JSON.parse(fs.readFileSync(path.join(ROOT,'questions.json'),'utf8'));
const DURATION=45000,NUM=30;const pool=DB_URL?new Pool({connectionString:DB_URL,max:4,connectionTimeoutMillis:12000}):null;
const cache=new Map();const RESULT_PATH=process.env.RESULTS_FILE||path.join(ROOT,'results.json');
if(!pool&&!fs.existsSync(RESULT_PATH))fs.writeFileSync(RESULT_PATH,'[]');
const secureShuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;};
const byId=Object.fromEntries(BANK.questions.map(q=>[q.id,q]));
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const admin=req=>ADMIN_KEY.length>=12&&equal(req.headers['x-admin-key'],ADMIN_KEY);
const send=(res,status,p)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(p));};
const parse=req=>new Promise((resolve,reject)=>{let n=0,parts=[];req.on('data',b=>{n+=b.length;if(n>20000){reject(Error('Quá giới hạn'));req.destroy();return}parts.push(b)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'))}catch{reject(Error('JSON không hợp lệ'))}});req.on('error',reject)});
function buildAttempt(name){const selection=[];for(let lesson=1;lesson<=10;lesson++){let group=BANK.questions.filter(q=>q.lesson===lesson);if(group.length<3)throw Error('Thiếu câu hỏi của bài '+lesson);selection.push(...secureShuffle(group).slice(0,3));}
 const order=secureShuffle(selection).map(q=>({id:q.id,perm:secureShuffle([0,1,2,3])}));return {id:crypto.randomBytes(24).toString('hex'),name,created:Date.now(),index:0,correct:0,deadline:Date.now()+DURATION,order,finished:false,result:null};}
function current(s){const item=s.order[s.index];if(!item)return null;const q=byId[item.id];return {id:q.id,text:q.text,options:item.perm.map(j=>q.options[j]),number:s.index+1,total:NUM,deadline:s.deadline,seconds:45};}
function result(s){return {id:s.id,name:s.name,className:BANK.className,course:BANK.title,correct:s.correct,total:NUM,score10:Math.round(s.correct*100/NUM)/10,startedAt:new Date(s.created).toISOString(),finishedAt:new Date().toISOString()};}
function publicResult(s){return {finished:true,score:s.result.score10,correct:s.result.correct,total:s.result.total};}
async function initialize(){if(pool){await pool.query('CREATE TABLE IF NOT EXISTS sic30_attempts(id TEXT PRIMARY KEY,payload JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');await pool.query('CREATE TABLE IF NOT EXISTS sic30_results(id TEXT PRIMARY KEY,payload JSONB NOT NULL,finished_at TIMESTAMPTZ NOT NULL)');console.log('PostgreSQL: connected')}else console.warn('WARNING: DATABASE_URL missing. Demo mode; results and sessions NOT durable on Render Free.');}
async function newAttempt(s){if(pool)await pool.query('INSERT INTO sic30_attempts (id,payload) VALUES ($1,$2::jsonb)',[s.id,JSON.stringify(s)]);else cache.set(s.id,s);}
async function getAttempt(id){if(pool){const r=await pool.query('SELECT payload FROM sic30_attempts WHERE id=$1',[id]);return r.rows[0]?.payload||null;}return cache.get(id)||null;}
function localResults(){return JSON.parse(fs.readFileSync(RESULT_PATH,'utf8'));}
async function allResults(){if(pool){const r=await pool.query('SELECT payload FROM sic30_results ORDER BY finished_at DESC');return r.rows.map(x=>x.payload);}return localResults().sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt));}
function updateState(s,at){let changed=false;while(!s.finished&&at>=s.deadline){s.index++;changed=true;if(s.index===NUM){s.finished=true;s.result=result(s);break;}s.deadline+=DURATION;}return changed;}
async function runTransaction(token,action){if(!pool){const s=cache.get(token);if(!s)return null;const resultBefore=s.finished;const out=action(s);if(s.finished&&!resultBefore){const r=localResults();if(!r.some(v=>v.id===s.id)){r.push(s.result);fs.writeFileSync(RESULT_PATH,JSON.stringify(r,null,2));}}cache.set(token,s);return out;}
 const client=await pool.connect();try{await client.query('BEGIN');const rs=await client.query('SELECT payload FROM sic30_attempts WHERE id=$1 FOR UPDATE',[token]);if(!rs.rows.length){await client.query('ROLLBACK');return null;}
 const s=rs.rows[0].payload,wasFinished=s.finished;const out=action(s);if(s.finished&&!wasFinished){await client.query('INSERT INTO sic30_results(id,payload,finished_at) VALUES($1,$2::jsonb,$3) ON CONFLICT (id) DO NOTHING',[s.id,JSON.stringify(s.result),s.result.finishedAt]);}
 await client.query('UPDATE sic30_attempts SET payload=$2::jsonb,updated_at=NOW() WHERE id=$1',[token,JSON.stringify(s)]);await client.query('COMMIT');return out;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
async function status(id){return runTransaction(id,s=>{updateState(s,Date.now());return s.finished?publicResult(s):{finished:false,question:current(s)};});}
async function answer(input){const id=String(input.token||'');return runTransaction(id,s=>{
 if(s.finished)return publicResult(s);
 const at=Date.now();const wasExpired=updateState(s,at);if(s.finished)return publicResult(s);
 const item=s.order[s.index];if(item.id!==input.questionId){return {finished:false,question:current(s),outdated:true};}
 // A response received after deadline cannot receive credit, even when browser timer is slow.
 if(at<=s.deadline+200&&Number.isInteger(input.answer)&&input.answer>=0&&input.answer<=3&&item.perm[input.answer]===byId[item.id].answer)s.correct++;
 s.index++;if(s.index>=NUM){s.finished=true;s.result=result(s);return publicResult(s)};
 s.deadline=at+DURATION;return {finished:false,question:current(s)};
 });}
async function excel(rows){const wb=new ExcelJS.Workbook();wb.creator='SIC – Semi3-3';const sh=wb.addWorksheet('Bang diem',{views:[{state:'frozen',ySplit:3}]});
 sh.mergeCells('A1:I1');sh.getCell('A1').value='SIC • BẢNG ĐIỂM KIỂM TRA TỔNG HỢP 30 CÂU — SEMI3-3';sh.getCell('A1').font={size:15,bold:true,color:{argb:'FFFFFFFF'}};sh.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173B82'}};sh.getRow(1).height=33;
 sh.mergeCells('A2:I2');sh.getCell('A2').value='Số lượt nộp: '+rows.length+' | Xuất báo cáo: '+new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
 const hdr=['STT','Thời gian nộp (VN)','Họ và tên','Lớp','Khóa học','Số câu đúng','Tổng câu','Điểm / 10','Mã lượt thi'];sh.getRow(3).values=hdr;
 const widths=[8,24,29,13,48,16,14,16,52];widths.forEach((v,i)=>sh.getColumn(i+1).width=v);
 sh.getRow(3).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF205DB0'}};c.font={bold:true,color:{argb:'FFFFFFFF'}};c.alignment={vertical:'middle',wrapText:true}});sh.getRow(3).height=30;
 rows.forEach((r,i)=>{const row=sh.addRow([i+1,new Date(r.finishedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),r.name,r.className,r.course,r.correct,r.total,r.score10,r.id]);row.eachCell(c=>{if(i%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF2FF'}}});row.getCell(8).numFmt='0.0'});
 sh.autoFilter={from:'A3',to:'I'+Math.max(3,rows.length+3)};return wb.xlsx.writeBuffer();}
const allow={'index.html':'text/html; charset=utf-8','style.css':'text/css; charset=utf-8','app.js':'application/javascript; charset=utf-8'};
async function handler(req,res){try{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){
 if(req.method==='GET'&&u.pathname==='/api/config')return send(res,200,{title:BANK.title,className:BANK.className,total:NUM,seconds:45,lessons:10});
 if(req.method==='POST'&&u.pathname==='/api/start'){const b=await parse(req),name=String(b.name||'').trim().replace(/\s+/g,' ');if(name.length<3||name.length>100)return send(res,400,{error:'Họ và tên phải dài từ 3 đến 100 ký tự.'});const s=buildAttempt(name);await newAttempt(s);return send(res,200,{token:s.id,question:current(s)});}
 if(req.method==='GET'&&u.pathname==='/api/status'){const state=await status(String(u.searchParams.get('token')||''));return state?send(res,200,state):send(res,404,{error:'Phiên thi không tồn tại.'});}
 if(req.method==='POST'&&u.pathname==='/api/answer'){const state=await answer(await parse(req));return state?send(res,200,state):send(res,404,{error:'Phiên thi không tồn tại.'});}
 if(req.method==='GET'&&u.pathname==='/api/admin/results'){if(!admin(req))return send(res,403,{error:'Mã quản trị chưa đúng hoặc ADMIN_KEY chưa cấu hình (từ 12 ký tự).'});return send(res,200,{results:await allResults()});}
 if(req.method==='GET'&&u.pathname==='/api/admin/excel'){if(!admin(req))return send(res,403,{error:'Không có quyền tải Excel.'});const x=await excel(await allResults());res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Bang-diem-SIC-Semi3-3-30-cau.xlsx"','Cache-Control':'no-store'});res.end(Buffer.from(x));return;}
 return send(res,404,{error:'API không tồn tại.'});}
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});const file=u.pathname==='/'?'index.html':u.pathname.substring(1);if(!allow[file])return send(res,404,{error:'Không tìm thấy tệp.'});res.writeHead(200,{'Content-Type':allow[file],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return fs.createReadStream(path.join(ROOT,file)).pipe(res);
 }catch(e){console.error(e);if(!res.headersSent)send(res,500,{error:'Lỗi máy chủ. Vui lòng liên hệ giảng viên.'});}}
initialize().then(()=>http.createServer(handler).listen(PORT,'0.0.0.0',()=>console.log('SIC 30 exam ready on port '+PORT))).catch(e=>{console.error('DB startup failure',e);process.exit(1)});
