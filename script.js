/* Copyright © 2026 Bisan Subba. All rights reserved. Developed by Bisan Subba. */
'use strict';
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(n);
const number = id => Number($(id).value);
let currentSchedule=[];
const payment = (principal,annualRate,months) => {const r=annualRate/1200;return r===0?principal/months:principal*r/(1-Math.pow(1+r,-months));};
function simulate(principal,annualRate,months,scheduled,extra,type){
  const rows=[];let balance=principal,totalInterest=0,totalPaid=0;const r=annualRate/1200;
  for(let m=1;m<=months && balance>0.000001;m++){
    const interest=balance*r;
    const regular=type==='interest-only'?interest:Math.min(scheduled,balance+interest);
    const principalPaid=type==='interest-only'?0:Math.max(0,regular-interest);
    const over=Math.min(extra,Math.max(0,balance-principalPaid));
    let closing=Math.max(0,balance-principalPaid-over);
    // Interest-only products require repayment of any outstanding principal at maturity.
    let balloon=0;
    if(type==='interest-only' && m===months && closing>0){balloon=closing;closing=0;}
    const paid=regular+over+balloon;
    totalInterest+=interest;totalPaid+=paid;
    rows.push({month:m,principal:principalPaid+balloon,interest,over,balance:closing,paid});
    balance=closing;
  }
  return {rows,totalInterest,totalPaid,months:rows.length};
}
function calculate(event){
  if(event)event.preventDefault();
  const price=number('price'),depositInput=number('deposit'),rate=number('rate'),years=number('years'),additionalMonths=number('months'),extra=number('overpayment');
  const deposit=$('deposit-mode').value==='percent'?price*depositInput/100:depositInput;
  const error=$('error');error.hidden=true;
  if(![price,depositInput,rate,years,additionalMonths,extra].every(Number.isFinite)||price<=0||price>1e9||deposit<0||deposit>=price||rate<0||rate>100||!Number.isInteger(years)||years<0||years>50||!Number.isInteger(additionalMonths)||additionalMonths<0||additionalMonths>11||(years*12+additionalMonths)<1||(years*12+additionalMonths)>600||extra<0||extra>1e8||($('deposit-mode').value==='percent'&&depositInput>100)){
    error.textContent='Enter a valid property price, a deposit below the price, interest between 0–100%, a term between 1 and 600 months (whole years and 0–11 additional months), and a non-negative overpayment.';error.hidden=false;return;
  }
  const principal=price-deposit,months=years*12+additionalMonths,type=$('mortgage-type').value;
  const regular=type==='interest-only'?principal*rate/1200:payment(principal,rate,months);
  const baseline=simulate(principal,rate,months,regular,0,type);
  const scenario=simulate(principal,rate,months,regular,extra,type);
  currentSchedule=scenario.rows;
  $('monthly').textContent=money(regular);
  $('extra-monthly').textContent='+'+money(extra);
  $('combined-monthly').textContent=money(regular+extra);
  const monthsSaved=Math.max(0,baseline.months-scenario.months);
  $('time-saved').textContent=monthsSaved===0?'0 months':`${Math.floor(monthsSaved/12)} years ${monthsSaved%12} months`; 
  $('loan').textContent=money(principal);
  $('ltv').textContent=(principal/price*100).toFixed(1)+'%';
  $('interest').textContent=money(scenario.totalInterest);
  $('total').textContent=money(scenario.totalPaid);
  $('saved').textContent=money(Math.max(0,baseline.totalInterest-scenario.totalInterest));
  const date=new Date();date.setDate(1);date.setMonth(date.getMonth()+scenario.months);
  $('payoff').textContent=date.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  $('results-note').textContent=type==='interest-only'?'Interest-only: the regular amount shown is the initial interest payment; it may decrease as overpayments reduce the balance. Remaining capital is assumed repaid at maturity.':'The regular monthly payment excludes the optional overpayment. The combined amount assumes the full extra payment each month until the final (possibly smaller) payment. Estimates exclude fees and early repayment charges.';
  renderChart(baseline.rows,scenario.rows,principal,months);
  renderSchedule();
}
function renderSchedule(){
  const yearly=$('schedule-view').value==='yearly';let rows=[];
  if(yearly){for(let i=0;i<currentSchedule.length;i+=12){const chunk=currentSchedule.slice(i,i+12);rows.push({label:'Year '+(Math.floor(i/12)+1),principal:chunk.reduce((s,r)=>s+r.principal,0),interest:chunk.reduce((s,r)=>s+r.interest,0),over:chunk.reduce((s,r)=>s+r.over,0),balance:chunk[chunk.length-1].balance});}}
  else rows=currentSchedule.map(r=>({...r,label:'Month '+r.month}));
  $('schedule-body').replaceChildren(...rows.map(row=>{const tr=document.createElement('tr');[row.label,money(row.principal),money(row.interest),money(row.over),money(row.balance)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});return tr;}));
}
function renderChart(standard,withExtra,principal,months){
  const svg=$('chart');svg.replaceChildren();const ns='http://www.w3.org/2000/svg';
  const el=(name,attrs,text)=>{const node=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;svg.append(node);return node;};
  const left=76,right=738,top=20,bottom=238,w=right-left,h=bottom-top;
  const x=m=>left+m/months*w,y=b=>bottom-b/principal*h;
  for(let i=0;i<=4;i++){const balance=principal*i/4,yy=y(balance);el('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#334766','stroke-dasharray':'4 6'});el('text',{x:65,y:yy+4,'text-anchor':'end',fill:'#a9bad5','font-size':12},'£'+Math.round(balance/1000)+'k');}
  for(let i=0;i<=5;i++){const m=Math.round(months*i/5);el('text',{x:x(m),y:263,'text-anchor':'middle',fill:'#a9bad5','font-size':12},(m/12).toFixed(0)+'y');}
  const path=rows=>'M'+left+','+top+' '+rows.map(r=>'L'+x(r.month).toFixed(2)+','+y(r.balance).toFixed(2)).join(' ');
  el('path',{d:path(standard),fill:'none',stroke:'#697da9','stroke-width':3,'stroke-linecap':'round'});
  el('path',{d:path(withExtra),fill:'none',stroke:'#24d0ff','stroke-width':3,'stroke-linecap':'round'});
}
$('mortgage-form').addEventListener('submit',calculate);
$('schedule-view').addEventListener('change',renderSchedule);
// Clear all: zero every numerical input and remove stale calculated output.
// Do not run calculate() with a zero-month term: zero is an empty state.
$('reset').addEventListener('click', function(event){
  event.preventDefault();
  for (const id of ['price','deposit','rate','years','months','overpayment']) $(id).value='0';
  $('deposit-mode').value='amount';
  $('mortgage-type').value='repayment';
  $('schedule-view').value='yearly';
  $('deposit-unit').textContent='(£)';
  $('overpayment-note').textContent='Extra payments shorten the term while keeping the scheduled payment unchanged.';
  $('error').hidden=true;
  currentSchedule=[];
  for (const id of ['monthly','extra-monthly','combined-monthly','loan','interest','total','saved']) $(id).textContent='£0.00';
  $('ltv').textContent='0.0%';
  $('payoff').textContent='—';
  $('time-saved').textContent='0 months';
  $('results-note').textContent='Enter your mortgage details and select Calculate mortgage to see an estimate.';
  $('chart').replaceChildren();
  $('schedule-body').replaceChildren();
  const status=$('reset-status');
  status.textContent='All values cleared. Enter your mortgage details to calculate.';
  status.hidden=false;
});
$('mortgage-form').addEventListener('input',()=>{$('reset-status').hidden=true;});
$('deposit-mode').addEventListener('change',()=>{const mode=$('deposit-mode').value;const price=number('price');const val=number('deposit');$('deposit').value=mode==='percent'?(price>0?(val/price*100).toFixed(2):0):(price*val/100).toFixed(2);$('deposit-unit').textContent=mode==='percent'?'(%)':'(£)';calculate();});
$('mortgage-type').addEventListener('change',()=>{$('overpayment-note').textContent=$('mortgage-type').value==='interest-only'?'Extra payments reduce the outstanding principal; regular interest payments then decrease.':'Extra payments shorten the term while keeping the scheduled payment unchanged.';calculate();});
calculate();
