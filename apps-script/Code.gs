const WIFI = Object.freeze({sender:'inventory@blueskycoffe.com', ttl:300000, cooldown:60000, maxAttempts:5, perEmailHour:5, daily:80});
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Portal').setTitle('BlueSky Wi-Fi · Email verification').addMetaTag('viewport','width=device-width, initial-scale=1');
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
