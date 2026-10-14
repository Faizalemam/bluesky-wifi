const WIFI = Object.freeze({sender:'inventory@blueskycoffe.com', ttl:300000, cooldown:60000, maxAttempts:5, perEmailHour:5, daily:80});
function doGet() {
  const html = "<!doctype html><html lang=\"en\"><head><base target=\"_top\"><meta charset=\"utf-8\"><style>\n*{box-sizing:border-box}body{margin:0;font:16px system-ui;background:#eef5fa;color:#123049;min-height:100vh;display:grid;place-items:center;padding:24px}.card{background:white;max-width:440px;width:100%;border-radius:24px;padding:32px;box-shadow:0 18px 60px #173d5714}.logo{color:#008cc6;font-weight:800;font-size:28px}h1{font-size:25px;margin:24px 0 8px}p{line-height:1.55;color:#526777}label{display:block;font-weight:650;margin:20px 0 8px}input,button{width:100%;padding:14px;border-radius:12px;font:inherit}input{border:1px solid #b7c9d6}button{border:0;background:#007daf;color:white;font-weight:700;margin-top:16px;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.note{font-size:13px}.status{margin-top:18px;line-height:1.5;white-space:pre-wrap}.error{color:#ae2929}.success{color:#087547}#verify{display:none}.badge{display:inline-block;background:#fff2d5;color:#705510;padding:7px 10px;border-radius:8px;font-size:12px;margin-top:18px}\n</style></head><body><main class=\"card\"><div class=\"logo\">BlueSky Coffee</div><div class=\"badge\">OTP test · Wi-Fi activation pending</div><h1>Welcome to BlueSky Wi-Fi</h1><p>Verify your email with a one-time code.</p><form id=\"send\"><label for=\"email\">Email address</label><input id=\"email\" type=\"email\" required maxlength=\"254\" autocomplete=\"email\" placeholder=\"you@example.com\"><button id=\"sendButton\">Send verification code</button></form><form id=\"verify\"><label for=\"code\">Six-digit code</label><input id=\"code\" type=\"text\" inputmode=\"numeric\" autocomplete=\"one-time-code\" pattern=\"[0-9]{6}\" maxlength=\"6\" required placeholder=\"000000\"><button id=\"verifyButton\">Verify email</button></form><div id=\"status\" class=\"status\" role=\"status\" aria-live=\"polite\"></div><p class=\"note\">Code expires in 5 minutes. Email is used to deliver this code. This test does not grant internet access. To read your email before Wi-Fi activation, you may need mobile data or another connection.</p></main><script>\nlet challenge='',busy=false;const $=id=>document.getElementById(id);function status(text,error=false){$('status').textContent=text;$('status').className='status '+(error?'error':'success');}function lock(value){busy=value;$('sendButton').disabled=value;$('verifyButton').disabled=value;}function failed(e){lock(false);status(e.message||'Request failed. Try again.',true);}\n$('send').addEventListener('submit',e=>{e.preventDefault();if(busy)return;lock(true);status('Sending your code…');google.script.run.withSuccessHandler(r=>{challenge=r.challenge;lock(false);$('verify').style.display='block';$('code').value='';$('code').focus();$('sendButton').textContent='Resend code';status('Code sent. Check your inbox and spam folder.');}).withFailureHandler(failed).requestOtp($('email').value);});\n$('verify').addEventListener('submit',e=>{e.preventDefault();if(busy||!challenge)return;lock(true);status('Verifying…');google.script.run.withSuccessHandler(r=>{lock(false);challenge='';$('verify').style.display='none';status(r.message);$('sendButton').textContent='Send new code';}).withFailureHandler(failed).verifyOtp(challenge,$('code').value);});\n</script></body></html>\n";
  return HtmlService.createHtmlOutput(html)
    .setTitle('BlueSky Wi-Fi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
// Owner only: run this from the editor BEFORE deployment. The trailing underscore
// prevents calls through google.script.run.
function setupProject_() {
  const p=PropertiesService.getScriptProperties();
  if (!GmailApp.getAliases().map(x=>x.toLowerCase()).includes(WIFI.sender)) throw new Error('Sender alias unavailable. Use the Gmail account with verified Send mail as inventory@blueskycoffe.com.');
  if (!p.getProperty('OTP_SECRET')) p.setProperty('OTP_SECRET',Utilities.getUuid()+Utilities.getUuid());
  p.setProperty('READY','1');
  console.log('Sender alias verified. Setup complete.');
}
function email_(value) {
  const e=String(value||'').trim().toLowerCase();
  if(e.length>254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(e)) throw new Error('Enter a valid email address.');
  return e;
}
function hex_(bytes) {return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function digest_(value,secret) {return hex_(Utilities.computeHmacSha256Signature(value,secret));}
function locked_(fn) {const l=LockService.getScriptLock(); if(!l.tryLock(10000)) throw new Error('Busy. Please try again shortly.'); try{return fn();}finally{l.releaseLock();}}
function settings_() {const p=PropertiesService.getScriptProperties(); if(p.getProperty('READY')!=='1'||!p.getProperty('OTP_SECRET')) throw new Error('Portal setup is pending. Contact the Wi-Fi administrator.');return p;}
function cleanup_(p,now) {const values=p.getProperties(); Object.keys(values).forEach(k=>{if(/^(OTP_|RATE_|DAY_)/.test(k)&&k!=='OTP_SECRET'){try{if(JSON.parse(values[k]).until<now)p.deleteProperty(k);}catch(e){p.deleteProperty(k);}}});}
function requestOtp(email) {
  email=email_(email);
  return locked_(()=>{
    const p=settings_(), now=Date.now(), secret=p.getProperty('OTP_SECRET');cleanup_(p,now);
    const ek=digest_('email:'+email,secret), rk='RATE_'+ek;
    let r=JSON.parse(p.getProperty(rk)||'null');
    if(r && now-r.last<WIFI.cooldown) throw new Error('Wait 60 seconds before requesting another code.');
    if(!r || now>r.until)r={count:0,last:0,until:now+3600000};
    if(r.count>=WIFI.perEmailHour)throw new Error('Email request limit reached. Try again in one hour.');
    const dk='DAY_'+Utilities.formatDate(new Date(now),'Asia/Riyadh','yyyyMMdd');
    const d=JSON.parse(p.getProperty(dk)||'null')||{count:0,until:now+86400000};
    if(d.count>=WIFI.daily || MailApp.getRemainingDailyQuota()<1)throw new Error('Daily email limit reached. Contact the Wi-Fi administrator.');
    const id=Utilities.getUuid(), raw=digest_(Utilities.getUuid()+':'+id,secret);
    const code=String(parseInt(raw.slice(0,8),16)%1000000).padStart(6,'0');
    // Reserve limits before sending so failed retries cannot create unlimited sends.
    r.count++;r.last=now;d.count++;p.setProperty(rk,JSON.stringify(r));p.setProperty(dk,JSON.stringify(d));
    try {GmailApp.sendEmail(email,'BlueSky Wi-Fi verification code', 'Your BlueSky Wi-Fi verification code is: '+code+'\n\nValid for 5 minutes. Do not share it.\nIf you did not request this code, ignore this email.',{from:WIFI.sender,name:'BlueSky Coffee Wi-Fi'});}catch(e){throw new Error('Email could not be sent. Check the sender alias and Gmail sending limits.');}
    // Resending invalidates the previous challenge for this email.
    const old=JSON.parse(p.getProperty('OTP_EMAIL_'+ek)||'null');if(old)p.deleteProperty('OTP_'+old.id);
    p.setProperty('OTP_EMAIL_'+ek,JSON.stringify({id:id,until:now+WIFI.ttl}));
    p.setProperty('OTP_'+id,JSON.stringify({emailKey:ek,hash:digest_(id+':'+code,secret),attempts:0,until:now+WIFI.ttl}));
    return {challenge:id,expiresSeconds:300};
  });
}
function verifyOtp(id,code) {
  if(!/^[0-9a-f-]{36}$/i.test(String(id))||!/^\d{6}$/.test(String(code)))throw new Error('Enter the six-digit code.');
  return locked_(()=>{
    const p=settings_(), k='OTP_'+id, r=JSON.parse(p.getProperty(k)||'null');
    if(!r||Date.now()>r.until){p.deleteProperty(k);throw new Error('Code expired or already used. Request a new code.');}
    r.attempts++;
    if(r.attempts>WIFI.maxAttempts){p.deleteProperty(k);throw new Error('Too many attempts. Request a new code.');}
    const expected=digest_(id+':'+code,p.getProperty('OTP_SECRET'));let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^r.hash.charCodeAt(i);
    if(diff){if(r.attempts>=WIFI.maxAttempts)p.deleteProperty(k);else p.setProperty(k,JSON.stringify(r));throw new Error('Incorrect code. Please check your email.');}
    p.deleteProperty(k);p.deleteProperty('OTP_EMAIL_'+r.emailKey);
    // No fabricated Linksys endpoint: authorization integration MUST be added
    // server-side and verified against this network's supported protocol.
    return {emailVerified:true,internetAuthorized:false,message:'Email verified. Wi-Fi internet authorization is not configured yet.'};
  });
}
