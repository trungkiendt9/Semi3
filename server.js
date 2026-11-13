'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ExcelJS=require('exceljs');
const {Pool}=require('pg');
const ROOT=__dirname;
const PORT=Number(process.env.PORT||3000);
const ADMIN_KEY=process.env.ADMIN_KEY||'';
const DATABASE_URL=process.env.DATABASE_URL||'';
const QUESTIONS=JSON.parse(fs.readFileSync(path.join(ROOT,'questions.json'),'utf8'));
const RESULTS_FILE=process.env.RESULTS_FILE||path.join(ROOT,'results.json');
const EXCEL_FILE=process.env.EXCEL_FILE||path.join(path.dirname(RESULTS_FILE),'bang-diem-SIC-Semi3-3.xlsx');
const LIMIT=32768, DURATION_MS=60000;
const pool=DATABASE_URL?new Pool({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},max:5}):null;
const mem=new Map();
const now=()=>Date.now();
const resultDir=path.dirname(RESULTS_FILE);fs.mkdirSync(resultDir,{recursive:true});
if(!pool&&!fs.existsSync(RESULTS_FILE))fs.writeFileSync(RESULTS_FILE,'[]');
const rand=()=>crypto.randomInt(0,0x7fffffff);
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(JSON.stringify(data));}
function body(req){return new Promise((resolve,reject)=>{let str='',size=0;req.on('data',b=>{size+=b.length;if(size>LIMIT){reject(Error('Dữ liệu quá lớn'));req.destroy();return;}str+=b.toString();});req.on('end',()=>{try{resolve(JSON.parse(str||'{}'));}catch{reject(Error('JSON không hợp lệ'));}});req.on('error',reject);});}
function safeEq(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function isAdmin(req){return ADMIN_KEY.length>=12&&safeEq(req.headers['x-admin-key'],ADMIN_KEY)}
function plan(lesson){const ids=shuffle(QUESTIONS[lesson].questions.map(q=>q.id));const perms=Object.fromEntries(ids.map(id=>[id,shuffle([0,1,2,3])]));return {ids,perms};}
function getQuestion(s){const id=s.plan.ids[s.index],q=QUESTIONS[s.lesson].questions.find(q=>q.id===id);if(!q)return null;return {id:q.id,text:q.text,options:s.plan.perms[q.id].map(i=>q.options[i]),number:s.index+1,total:s.plan.ids.length,seconds:60,deadline:s.deadline};}
function resultRecord(s){const total=s.plan.ids.length;return {id:s.id,name:s.name,className:'Semi3-3',course:'Công nghệ bán dẫn tại SIC',lesson:s.lesson,lessonTitle:QUESTIONS[s.lesson].title,correct:s.correct,total,score10:Math.round(s.correct/total*100)/10,startedAt:new Date(s.created).toISOString(),finishedAt:new Date().toISOString()};}
function scoreResponse(r){return {finished:true,score:r.score10,lessonTitle:r.lessonTitle};}
async function listResults(){if(pool){const r=await pool.query('SELECT payload FROM quiz_results ORDER BY finished_at DESC');return r.rows.map(x=>x.payload)}return JSON.parse(fs.readFileSync(RESULTS_FILE,'utf8')).sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt));}
async function storeFileOnly(r){const a=await listResults();if(a.some(x=>x.id===r.id))return; a.push(r);const tmp=RESULTS_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(a,null,2));fs.renameSync(tmp,RESULTS_FILE);}
async function makeWorkbook(rows){const wb=new ExcelJS.Workbook();wb.creator='SIC Semi3-3';wb.created=new Date();const sh=wb.addWorksheet('Bang diem',{views:[{state:'frozen',ySplit:3}],properties:{defaultRowHeight:23}});
 sh.mergeCells('A1:J1');sh.getCell('A1').value='SIC | KẾT QUẢ KIỂM TRA CÔNG NGHỆ BÁN DẪN – SEMI3-3';sh.getCell('A1').font={name:'Arial',size:15,bold:true,color:{argb:'FFFFFFFF'}};sh.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF12345C'}};sh.getRow(1).height=32;
 sh.mergeCells('A2:J2');sh.getCell('A2').value='Tổng số lượt hoàn thành: '+rows.length+' | Xuất lúc: '+new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});sh.getCell('A2').font={italic:true,color:{argb:'FF4D6075'}};
 const headers=['STT','Thời gian nộp (VN)','Họ và tên','Lớp','Khóa học','Bài','Tên bài kiểm tra','Số câu đúng','Tổng câu','Điểm / 10'];sh.getRow(3).values=headers;const widths=[8,24,30,14,31,9,53,15,13,16];widths.forEach((w,i)=>sh.getColumn(i+1).width=w);
 const head=sh.getRow(3);head.height=28;head.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF205C94'}};c.alignment={vertical:'middle',wrapText:true}});
 rows.forEach((r,i)=>{const date=new Date(r.finishedAt);const dateVN=isNaN(date.getTime())?r.finishedAt:date.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});const values=[i+1,dateVN,r.name,r.className,r.course,Number(r.lesson),r.lessonTitle,r.correct,r.total,r.score10];const line=sh.addRow(values);line.height=23;line.eachCell(c=>{c.alignment={vertical:'middle'};if(i%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F6FC'}}});line.getCell(10).numFmt='0.0';});
 sh.autoFilter={from:'A3',to:'J'+Math.max(3,rows.length+3)};return wb;}
let excelWrite=Promise.resolve();
function refreshExcel(){excelWrite=excelWrite.catch(()=>{}).then(async()=>{const data=await listResults();const wb=await makeWorkbook(data);const tmp=EXCEL_FILE+'.tmp.xlsx';fs.mkdirSync(path.dirname(EXCEL_FILE),{recursive:true});await wb.xlsx.writeFile(tmp);fs.renameSync(tmp,EXCEL_FILE);});return excelWrite;}
async function init(){if(pool){await pool.query(`CREATE TABLE IF NOT EXISTS quiz_sessions (id TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE IF NOT EXISTS quiz_results (id TEXT PRIMARY KEY, payload JSONB NOT NULL, finished_at TIMESTAMPTZ NOT NULL);`);console.log('PostgreSQL đã kết nối. Kết quả và phiên thi được lưu bền vững.');}else console.warn('CHẾ ĐỘ THỬ NGHIỆM: chưa có DATABASE_URL. Dữ liệu trên Render Free có thể bị mất khi khởi động lại!');}
async function saveSession(s){if(pool){await pool.query('INSERT INTO quiz_sessions(id,payload) VALUES($1,$2::jsonb)',[s.id,JSON.stringify(s)]);}else mem.set(s.id,s);}
async function retrieveSession(token){if(pool){const r=await pool.query('SELECT payload FROM quiz_sessions WHERE id=$1',[token]);return r.rows[0]?.payload||null;}return mem.get(token);}
async function completeSession(s){const r=resultRecord(s);if(pool){const client=await pool.connect();try{await client.query('BEGIN');await client.query('INSERT INTO quiz_results (id,payload,finished_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT (id) DO NOTHING',[r.id,JSON.stringify(r),r.finishedAt]);await client.query('UPDATE quiz_sessions SET payload=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify({...s,finished:true,result:r})]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}}else{await storeFileOnly(r);mem.set(s.id,{...s,finished:true,result:r});}
 try{await refreshExcel();}catch(e){console.error('Không ghi được Excel (điểm vẫn được lưu trong DB hoặc JSON):',e.message);}return scoreResponse(r);}
async function answerSession(token,questionId,answer){const client=pool?await pool.connect():null;let s;
 try{if(client){await client.query('BEGIN');const rs=await client.query('SELECT payload FROM quiz_sessions WHERE id=$1 FOR UPDATE',[token]);s=rs.rows[0]?.payload;}else s=mem.get(token);
 if(!s){if(client)await client.query('ROLLBACK');return {code:404,data:{error:'Phiên thi không tồn tại hoặc đã hết hạn.'}};}
 if(s.finished){if(client)await client.query('ROLLBACK');return {code:200,data:scoreResponse(s.result)};}
 const id=s.plan.ids[s.index],q=QUESTIONS[s.lesson].questions.find(x=>x.id===id);
 if(id!==questionId){if(client)await client.query('ROLLBACK');return {code:409,data:{error:'Câu hỏi không khớp. Vui lòng tải lại trạng thái.'}};}
 if(Date.now()<=s.deadline+250 && Number.isInteger(answer)&&answer>=0&&answer<4 && s.plan.perms[q.id][answer]===q.answer)s.correct++;
 s.index++;if(s.index>=s.plan.ids.length){const r=resultRecord(s);s.finished=true;s.result=r;if(client){await client.query('INSERT INTO quiz_results (id,payload,finished_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT (id) DO NOTHING',[r.id,JSON.stringify(r),r.finishedAt]);await client.query('UPDATE quiz_sessions SET payload=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);await client.query('COMMIT');}else{await storeFileOnly(r);mem.set(s.id,s);}
 try{await refreshExcel();}catch(e){console.error('Excel write failed:',e.message);}return {code:200,data:scoreResponse(r)};}
 s.deadline=Date.now()+DURATION_MS;if(client){await client.query('UPDATE quiz_sessions SET payload=$2::jsonb,updated_at=NOW() WHERE id=$1',[s.id,JSON.stringify(s)]);await client.query('COMMIT');}else mem.set(s.id,s);
 return {code:200,data:{finished:false,question:getQuestion(s)}};
 }catch(e){if(client)try{await client.query('ROLLBACK')}catch{}throw e}finally{if(client)client.release();}}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};
async function handler(req,res){try{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){
 if(req.method==='GET'&&u.pathname==='/api/lessons')return json(res,200,{course:'Công nghệ bán dẫn tại SIC',className:'Semi3-3',lessons:Object.entries(QUESTIONS).sort((a,b)=>+a[0]-+b[0]).map(([id,v])=>({id,title:v.title,ready:v.ready,count:v.questions.length}))});
 if(req.method==='POST'&&u.pathname==='/api/start'){const b=await body(req),name=String(b.name||'').trim().replace(/\s+/g,' '),lesson=String(b.lesson||'');if(name.length<3||name.length>100||!QUESTIONS[lesson]?.ready)return json(res,400,{error:'Vui lòng nhập họ tên hợp lệ và chọn bài có câu hỏi.'});const s={id:crypto.randomBytes(24).toString('hex'),name,lesson,plan:plan(lesson),index:0,correct:0,created:now(),deadline:now()+DURATION_MS,finished:false};await saveSession(s);return json(res,200,{token:s.id,question:getQuestion(s)});}
 if(req.method==='POST'&&u.pathname==='/api/answer'){const b=await body(req);const r=await answerSession(String(b.token||''),String(b.questionId||''),b.answer);return json(res,r.code,r.data);}
 if(req.method==='GET'&&u.pathname==='/api/status'){const s=await retrieveSession(String(u.searchParams.get('token')||''));if(!s)return json(res,404,{error:'Không tìm thấy phiên thi'});return json(res,200,s.finished?scoreResponse(s.result):{finished:false,question:getQuestion(s)});}
 if(req.method==='GET'&&u.pathname==='/api/admin/results'){if(!isAdmin(req))return json(res,403,{error:'Sai mã quản trị hoặc chưa cấu hình ADMIN_KEY (ít nhất 12 ký tự).'});return json(res,200,{results:await listResults()});}
 if(req.method==='GET'&&u.pathname==='/api/admin/excel'){if(!isAdmin(req))return json(res,403,{error:'Bạn không có quyền tải bảng điểm.'});await refreshExcel();res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Bang-diem-SIC-Semi3-3.xlsx"','Cache-Control':'no-store'});return fs.createReadStream(EXCEL_FILE).pipe(res);}
 return json(res,404,{error:'Không tìm thấy API'});}
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});const target=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!['index.html','style.css','app.js'].includes(target))return json(res,404,{error:'Không tìm thấy'});res.writeHead(200,{'Content-Type':mime[path.extname(target)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});fs.createReadStream(path.join(ROOT,target)).pipe(res);
 }catch(e){console.error(e);if(!res.headersSent)json(res,500,{error:'Lỗi máy chủ; vui lòng thử lại hoặc liên hệ giảng viên.'});}}
init().then(()=>http.createServer(handler).listen(PORT,()=>console.log('SIC Quiz running at port',PORT))).catch(e=>{console.error('Không thể khởi động DB:',e);process.exit(1)});
