(() => {
"use strict";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const CONFIG = window.SALDO_CONFIG || {};
const hasCloudConfig = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase);
const sb = hasCloudConfig ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;
const CATEGORIES = {
  expense:["Vivienda","Alimentación","Transporte","Ocio","Restaurantes","Compras","Salud","Suscripciones","Facturas","Familia","Educación","Viajes","Otros"],
  income:["Sueldo","Trabajo extra","Ventas","Inversiones","Regalo","Otros"]
};
const ICONS = {"Vivienda":"⌂","Alimentación":"◉","Transporte":"↗","Ocio":"♫","Restaurantes":"♨","Compras":"◇","Salud":"✚","Suscripciones":"⟳","Facturas":"▤","Familia":"♡","Educación":"▣","Viajes":"✈","Otros":"◌","Sueldo":"€","Trabajo extra":"↗","Ventas":"◈","Inversiones":"▥","Regalo":"♧"};
const COLORS = ["#315efb","#18a979","#e45a6b","#8268e8","#e7a23d","#2ba6b8","#dd70a4","#8794a8"];
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const today = () => new Date().toISOString().slice(0,10);
const currentMonth = () => today().slice(0,7);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const money = n => new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const dateLabel = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}) : "Sin fecha";
const monthLabel = m => {const [y,mo]=m.split("-").map(Number);return `${MONTHS[mo-1]} ${y}`;};
const emptyData = () => ({transactions:[],budgets:[],goals:[],recurring:[],profile:{display_name:"Mi espacio"}});
let data = emptyData(), user = null, mode = "local", activeView = "dashboard", modalKind = null, editingId = null, authMode = "login", toastTimer;
const storeKey = "saldo-local-v1";
const getLocal = () => {try{return {...emptyData(),...JSON.parse(localStorage.getItem(storeKey)||"{}")};}catch{return emptyData();}};
const saveLocal = () => localStorage.setItem(storeKey,JSON.stringify(data));
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function setTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem("saldo-theme",theme);$("#themeLabel").textContent=theme==="dark"?"Modo claro":"Modo oscuro";$("#mobileThemeToggle").textContent=theme==="dark"?"☼":"◐";}
function initTheme(){setTheme(localStorage.getItem("saldo-theme")||"light");}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function monthTransactions(month){return data.transactions.filter(t=>String(t.transaction_date).slice(0,7)===month);}
function sums(list){return list.reduce((a,t)=>{if(t.type==="income")a.income+=Number(t.amount);else a.expense+=Number(t.amount);return a;},{income:0,expense:0});}
function categoryTotals(list,type){const map={};list.filter(t=>t.type===type).forEach(t=>{const cat=t.category||"Otros";map[cat]=(map[cat]||0)+Number(t.amount);});return Object.entries(map).sort((a,b)=>b[1]-a[1]);}
function expenseByCategory(list){return categoryTotals(list,"expense");}
function incomeByCategory(list){return categoryTotals(list,"income");}
function currentName(){return data.profile?.display_name||user?.user_metadata?.display_name||"Mi espacio";}
function updateIdentity(){
 const name=currentName();$("#sidebarName").textContent=name;$("#sidebarAvatar").textContent=(name.trim()[0]||"S").toUpperCase();$("#welcomeName").textContent="ZZ";
 $("#connectionStatus").textContent=mode==="cloud"?"Sincronizado con la nube":"Solo este dispositivo";
}
async function loadCloud(){
 const tables=[["transactions","transactions"],["budgets","budgets"],["savings_goals","goals"],["recurring_expenses","recurring"]];
 for(const [table,key] of tables){const {data:rows,error}=await sb.from(table).select("*").order("created_at",{ascending:false});if(error)throw error;data[key]=rows.map(normalizeRow);}
 const {data:profile,error}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();if(error)throw error;
 if(profile)data.profile={display_name:profile.display_name||"Mi espacio"};else {const {error:e}=await sb.from("profiles").upsert({id:user.id,display_name:user.user_metadata?.display_name||"Mi espacio"});if(e)throw e;data.profile={display_name:user.user_metadata?.display_name||"Mi espacio"};}
}
function normalizeRow(r){return {...r,transaction_date:r.transaction_date,amount:Number(r.amount),target_amount:Number(r.target_amount||0),saved_amount:Number(r.saved_amount||0)};}
async function persist(kind, row, id=null){
 if(mode==="local"){if(id){const i=data[kind].findIndex(x=>x.id===id);if(i>=0)data[kind][i]={...data[kind][i],...row};}else data[kind].unshift({id:uid(),created_at:new Date().toISOString(),...row});saveLocal();return;}
 const table={transactions:"transactions",budgets:"budgets",goals:"savings_goals",recurring:"recurring_expenses"}[kind];
 const payload={...row,user_id:user.id};if(id){const {error}=await sb.from(table).update(payload).eq("id",id);if(error)throw error;}else{const {error}=await sb.from(table).insert(payload);if(error)throw error;}
 await loadCloud();
}
async function removeItem(kind,id){
 if(!confirm("¿Seguro que quieres eliminar este elemento?"))return;
 if(mode==="local"){data[kind]=data[kind].filter(x=>x.id!==id);saveLocal();}
 else{const table={transactions:"transactions",budgets:"budgets",goals:"savings_goals",recurring:"recurring_expenses"}[kind];const {error}=await sb.from(table).delete().eq("id",id);if(error){toast("No se pudo eliminar: "+error.message);return;}await loadCloud();}
 renderAll();toast("Elemento eliminado.");
}
function nav(view){
 activeView=view;$$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));$$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 const titles={dashboard:"Resumen",transactions:"Movimientos",budgets:"Presupuestos",statistics:"Estadísticas",goals:"Objetivos de ahorro",recurring:"Gastos recurrentes"};$("#pageTitle").textContent=titles[view]||"Resumen";window.scrollTo({top:0,behavior:"smooth"});renderAll();
}
function empty(message,title="Aún no hay datos"){return `<div class="empty-state"><strong>${title}</strong>${message}</div>`;}
function renderTrend(){
 const now=$("#dashboardMonth").value||currentMonth(),[year,month]=now.split("-").map(Number);
 const months=[];for(let i=5;i>=0;i--){const d=new Date(year,month-1-i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);}
 const values=months.map(m=>({m,...sums(monthTransactions(m))}));const max=Math.max(1,...values.flatMap(v=>[v.income,v.expense]));
 $("#trendChart").innerHTML=values.map(v=>`<div class="trend-column"><div class="bar-pair"><div class="bar" title="Ingresos: ${money(v.income)}" style="height:${Math.max(2,v.income/max*100)}%"></div><div class="bar expense" title="Gastos: ${money(v.expense)}" style="height:${Math.max(2,v.expense/max*100)}%"></div></div><span class="trend-label">${MONTHS[Number(v.m.slice(5))-1]}</span></div>`).join("");
}
function renderCategories(target, month){
 const rows=expenseByCategory(monthTransactions(month)),total=rows.reduce((a,x)=>a+x[1],0);
 if(!rows.length){$(target).innerHTML=empty("Registra un gasto para ver aquí el desglose.");return;}
 $(target).innerHTML=rows.slice(0,7).map(([cat,val],i)=>`<div class="category-row"><div class="category-label"><span><i class="category-mark" style="background:${COLORS[i%COLORS.length]}"></i>${escapeHtml(cat)}</span><strong>${money(val)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${total?val/total*100:0}%;background:${COLORS[i%COLORS.length]}"></div></div></div>`).join("");
}
function renderStatisticsCategories(target,list,type){
 const rows=categoryTotals(list,type),total=rows.reduce((a,x)=>a+x[1],0),label=type==="income"?"ingreso":"gasto";
 if(!rows.length){$(target).innerHTML=empty(`Registra un ${label} para ver aquí el desglose.`);return;}
 $(target).innerHTML=rows.map(([cat,val],i)=>`<div class="category-row"><div class="category-label"><span><i class="category-mark" style="background:${COLORS[i%COLORS.length]}"></i>${escapeHtml(cat)}</span><strong>${money(val)} <small>(${total?Math.round(val/total*100):0}%)</small></strong></div><div class="progress-track"><div class="progress-fill" style="width:${total?val/total*100:0}%;background:${COLORS[i%COLORS.length]}"></div></div></div>`).join("");
}
function transactionRow(t,actions=true){
 const inc=t.type==="income",cat=escapeHtml(t.category||"Otros"),desc=escapeHtml(t.description||t.category||"Movimiento");
 return `<div class="transaction-row"><div class="transaction-main"><div class="transaction-symbol">${ICONS[t.category]|| (inc?"＋":"−")}</div><div class="transaction-copy"><strong>${desc}</strong><small>${cat} · ${dateLabel(t.transaction_date)}</small></div></div><span class="transaction-category">${cat}</span><div class="transaction-amount ${inc?"income":"expense"}">${inc?"+":"−"}${money(t.amount)}</div>${actions?`<div class="row-actions"><button class="tiny-button" title="Editar" data-edit="transactions" data-id="${t.id}">✎</button><button class="tiny-button" title="Eliminar" data-delete="transactions" data-id="${t.id}">×</button></div>`:""}</div>`;
}
function renderTransactions(){
 const month=$("#transactionMonthFilter").value, type=$("#transactionTypeFilter").value, q=$("#transactionSearch").value.toLowerCase().trim();
 const list=[...data.transactions].filter(t=>(!month||String(t.transaction_date).slice(0,7)===month)&&(type==="all"||t.type===type)&&(`${t.description} ${t.category}`.toLowerCase().includes(q))).sort((a,b)=>String(b.transaction_date).localeCompare(String(a.transaction_date)));
 $("#allTransactions").innerHTML=list.length?list.map(t=>transactionRow(t)).join(""):empty("Prueba a cambiar los filtros o añade tu primer movimiento.","No encontramos movimientos");
 $("#recentTransactions").innerHTML=[...data.transactions].sort((a,b)=>String(b.transaction_date).localeCompare(String(a.transaction_date))).slice(0,5).map(t=>transactionRow(t,false)).join("")||empty("Añade tu primer ingreso o gasto para empezar.");
}
function renderDashboard(){
 const month=$("#dashboardMonth").value||currentMonth(),s=sums(monthTransactions(month)),all=sums(data.transactions),bal=all.income-all.expense;
 $("#balanceValue").textContent=money(bal);$("#incomeValue").textContent=money(s.income);$("#expenseValue").textContent=money(s.expense);
 $("#savingRate").textContent=s.income?`${Math.round((bal/s.income)*100)}%`:"—";
 $("#balanceFoot").textContent="Acumulado de todos los movimientos registrados";
 renderTrend();renderCategories("#categoryChart",month);renderTransactions();
}
function renderBudgets(){
 const month=$("#dashboardMonth").value||currentMonth(),expenses=monthTransactions(month).filter(t=>t.type==="expense");
 const total=data.budgets.reduce((a,b)=>a+Number(b.amount),0),spent=expenses.reduce((a,t)=>a+Number(t.amount),0);
 $("#budgetTotal").textContent=money(total);$("#budgetSpent").textContent=money(spent);$("#budgetRemaining").textContent=money(total-spent);
 $("#budgetsList").innerHTML=data.budgets.map(b=>{const used=expenses.filter(t=>t.category===b.category).reduce((a,t)=>a+Number(t.amount),0),pct=Number(b.amount)?used/Number(b.amount)*100:0;return `<article class="budget-card"><div class="budget-card-top"><div class="budget-title"><div class="big-category-icon">${ICONS[b.category]||"◌"}</div><div><h3>${escapeHtml(b.category)}</h3><p>Presupuesto mensual</p></div></div><button class="tiny-button" data-delete="budgets" data-id="${b.id}" title="Eliminar">×</button></div><div class="budget-numbers"><span>Gastado <strong>${money(used)}</strong></span><span>de ${money(b.amount)}</span></div><div class="budget-progress"><span class="${pct>100?"over":""}" style="width:${Math.min(100,pct)}%"></span></div><div class="budget-card-foot"><span>${pct>100?"Has superado el límite":`${Math.round(pct)}% utilizado`}</span><span>${money(Math.max(0,Number(b.amount)-used))} disponible</span></div></article>`;}).join("")||empty("Crea un límite para una categoría, por ejemplo 200 € para ocio.","Todavía no tienes presupuestos");
}
function renderStatistics(){
 const month=$("#statsMonth").value||currentMonth(),s=sums(monthTransactions(month)),bal=s.income-s.expense,period=monthTransactions(month);
 $("#statsIncome").textContent=money(s.income);$("#statsExpense").textContent=money(s.expense);$("#statsBalance").textContent=money(bal);
 renderStatisticsCategories("#statsCategories",period,"expense");renderStatisticsCategories("#statsIncomeCategories",period,"income");
 const cats=expenseByCategory(monthTransactions(month)),top=cats[0],budgets=data.budgets;
 const insights=[];
 insights.push({icon:"↗",title:bal>=0?"Balance positivo":"Balance negativo",text:bal>=0?`Te quedan ${money(bal)} después de los gastos registrados.`:`Has gastado ${money(Math.abs(bal))} más de lo que has ingresado.`});
 if(top)insights.push({icon:"◉",title:"Mayor categoría de gasto",text:`${top[0]} concentra ${money(top[1])}${s.expense?` (${Math.round(top[1]/s.expense*100)}% de tus gastos)`:""}.`});
 const exceeded=budgets.map(b=>({...b,spent:monthTransactions(month).filter(t=>t.type==="expense"&&t.category===b.category).reduce((a,t)=>a+Number(t.amount),0)})).filter(b=>b.spent>Number(b.amount));
 insights.push(exceeded.length?{icon:"!",title:"Presupuestos superados",text:`Has superado: ${exceeded.map(b=>b.category).join(", ")}.`}:{icon:"✓",title:"Revisa tus límites",text:budgets.length?"Tus presupuestos se están comparando con los gastos del periodo.":"Crea presupuestos para vigilar las categorías importantes."});
 $("#insightsList").innerHTML=insights.map(i=>`<div class="insight"><span class="insight-icon">${i.icon}</span><div><strong>${escapeHtml(i.title)}</strong><p>${escapeHtml(i.text)}</p></div></div>`).join("");
}
function renderGoals(){
 $("#goalsList").innerHTML=data.goals.map(g=>{const pct=Number(g.target_amount)?Number(g.saved_amount)/Number(g.target_amount)*100:0;return `<article class="goal-card"><div class="goal-card-top"><div class="goal-title"><div class="big-category-icon">◎</div><div><h3>${escapeHtml(g.name)}</h3><p>${g.target_date?`Objetivo: ${dateLabel(g.target_date)}`:"Sin fecha límite"}</p></div></div><button class="tiny-button" data-delete="goals" data-id="${g.id}" title="Eliminar">×</button></div><div class="goal-amounts"><strong>${money(g.saved_amount)}</strong><span>de ${money(g.target_amount)}</span></div><div class="goal-progress"><span style="width:${Math.min(100,pct)}%"></span></div><div class="goal-bottom"><span>${Math.round(pct)}% completado</span><span>Faltan ${money(Math.max(0,Number(g.target_amount)-Number(g.saved_amount)))}</span></div><button class="primary-button" data-contribute="${g.id}">＋ Añadir ahorro</button></article>`;}).join("")||empty("Crea una meta concreta, como ahorrar 1.000 € para un viaje.","Empieza con un objetivo");
}
function renderRecurring(){
 $("#recurringList").innerHTML=data.recurring.map(r=>`<article class="recurring-card"><div class="recurring-top"><div class="budget-title"><div class="big-category-icon">${ICONS[r.category]||"⟳"}</div><div><h3>${escapeHtml(r.name)}</h3><p>${escapeHtml(r.category)} · ${({weekly:"Cada semana",monthly:"Cada mes",yearly:"Cada año"})[r.frequency]||"Cada mes"}</p></div></div><div class="recurring-amount">${money(r.amount)}</div></div><div class="recurring-bottom"><small>Próximo pago: ${dateLabel(r.next_date)}</small><div class="row-actions"><button class="secondary-button" style="padding:8px 10px;font-size:10px" data-pay="${r.id}">Registrar pago</button><button class="tiny-button" data-delete="recurring" data-id="${r.id}" title="Eliminar">×</button></div></div></article>`).join("")||empty("Añade alquiler, teléfono, suscripciones o cualquier pago fijo.","No tienes gastos recurrentes");
}
function renderAll(){updateIdentity();renderDashboard();renderBudgets();renderStatistics();renderGoals();renderRecurring();}
function field(name,label,type="text",value="",opts={},full=false){
 let control="";
 if(type==="select")control=`<select name="${name}" ${opts.required===false?"":"required"}>${opts.options.map(o=>`<option value="${escapeHtml(o.value)}" ${o.value===value?"selected":""}>${escapeHtml(o.label)}</option>`).join("")}</select>`;
 else control=`<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${opts.placeholder?`placeholder="${escapeHtml(opts.placeholder)}"`:""} ${opts.min!==undefined?`min="${opts.min}"`:""} ${opts.step?`step="${opts.step}"`:""} ${opts.required===false?"":"required"} ${opts.maxlength?`maxlength="${opts.maxlength}"`:""}>`;
 return `<div class="field ${full?"full":""}"><label>${label}</label>${control}</div>`;
}
function openModal(kind,id=null,extra={}){
 modalKind=kind;editingId=id;const editKey={transaction:"transactions",budget:"budgets",goal:"goals",recurring:"recurring"}[kind];const old=id?data[editKey].find(x=>x.id===id):null;
 const isEdit=Boolean(old);let title="",html="";
 if(kind==="transaction"){
  title=isEdit?"Editar movimiento":"Añadir movimiento";const type=old?.type||extra.type||"expense";
  html=field("type","Tipo","select",type,{options:[{value:"expense",label:"Gasto"},{value:"income",label:"Ingreso"}]})+
   field("amount","Importe (€)","number",old?.amount??"",{min:"0.01",step:"0.01"})+
   field("category","Categoría","select",old?.category||CATEGORIES[type][0],{options:CATEGORIES[type].map(x=>({value:x,label:x}))})+
   field("transaction_date","Fecha","date",old?.transaction_date||today())+
   field("description","Concepto","text",old?.description||"",{placeholder:"Ej. Compra semanal"},true);
 }else if(kind==="budget"){
  title=isEdit?"Editar presupuesto":"Crear presupuesto";html=field("category","Categoría","select",old?.category||CATEGORIES.expense[0],{options:CATEGORIES.expense.map(x=>({value:x,label:x}))})+field("amount","Límite mensual (€)","number",old?.amount??"",{min:"0.01",step:"0.01"});
 }else if(kind==="goal"){
  title=isEdit?"Editar objetivo":"Nuevo objetivo de ahorro";html=field("name","Nombre del objetivo","text",old?.name||"",{placeholder:"Ej. Viaje de verano"},true)+field("target_amount","Cantidad objetivo (€)","number",old?.target_amount??"",{min:"0.01",step:"0.01"})+field("saved_amount","Ya ahorrado (€)","number",old?.saved_amount??0,{min:"0",step:"0.01"})+field("target_date","Fecha objetivo (opcional)","date",old?.target_date||"",{required:false});
 }else if(kind==="recurring"){
  title=isEdit?"Editar gasto recurrente":"Añadir gasto fijo";html=field("name","Nombre","text",old?.name||"",{placeholder:"Ej. Gimnasio"})+field("amount","Importe (€)","number",old?.amount??"",{min:"0.01",step:"0.01"})+field("category","Categoría","select",old?.category||"Suscripciones",{options:CATEGORIES.expense.map(x=>({value:x,label:x}))})+field("frequency","Frecuencia","select",old?.frequency||"monthly",{options:[{value:"weekly",label:"Semanal"},{value:"monthly",label:"Mensual"},{value:"yearly",label:"Anual"}]})+field("next_date","Próximo pago","date",old?.next_date||today());
 }
 $("#modalTitle").textContent=title;$("#modalFields").innerHTML=html;$("#modalBackdrop").classList.remove("hidden");
 const typeSelect=$('#modalFields [name="type"]');if(typeSelect)typeSelect.addEventListener("change",()=>{const cat=$('#modalFields [name="category"]');cat.innerHTML=CATEGORIES[typeSelect.value].map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");});
}
function closeModal(){$("#modalBackdrop").classList.add("hidden");$("#modalForm").reset();modalKind=null;editingId=null;}
async function submitModal(e){
 e.preventDefault();const fd=new FormData(e.currentTarget),v=Object.fromEntries(fd.entries());try{
  if(modalKind==="transaction"){const row={type:v.type,amount:Number(v.amount),category:v.category,description:v.description.trim(),transaction_date:v.transaction_date};await persist("transactions",row,editingId);}
  if(modalKind==="budget"){const row={category:v.category,amount:Number(v.amount)};const exists=data.budgets.find(b=>b.category===v.category&&b.id!==editingId);if(exists){toast("Ya tienes un presupuesto para esa categoría.");return;}await persist("budgets",row,editingId);}
  if(modalKind==="goal"){await persist("goals",{name:v.name.trim(),target_amount:Number(v.target_amount),saved_amount:Number(v.saved_amount||0),target_date:v.target_date||null},editingId);}
  if(modalKind==="recurring"){await persist("recurring",{name:v.name.trim(),amount:Number(v.amount),category:v.category,frequency:v.frequency,next_date:v.next_date},editingId);}
  closeModal();renderAll();toast("Cambios guardados correctamente.");
 }catch(err){toast("No se pudo guardar: "+(err.message||"revisa la conexión"));}}
async function contribute(id){
 const g=data.goals.find(x=>x.id===id);if(!g)return;const raw=prompt(`¿Cuánto quieres añadir a «${g.name}»? (€)`);if(raw===null)return;const amount=Number(raw.replace(",","."));if(!Number.isFinite(amount)||amount<=0){toast("Introduce una cantidad válida.");return;}
 try{await persist("goals",{name:g.name,target_amount:g.target_amount,saved_amount:Number(g.saved_amount)+amount,target_date:g.target_date||null},id);renderAll();toast("Ahorro actualizado.");}catch(e){toast("No se pudo actualizar: "+e.message);}
}
async function payRecurring(id){
 const r=data.recurring.find(x=>x.id===id);if(!r)return;
 try{
  await persist("transactions",{type:"expense",amount:Number(r.amount),category:r.category,description:r.name,transaction_date:today()});
  const d=new Date(`${r.next_date}T12:00:00`);if(r.frequency==="weekly")d.setDate(d.getDate()+7);if(r.frequency==="monthly")d.setMonth(d.getMonth()+1);if(r.frequency==="yearly")d.setFullYear(d.getFullYear()+1);
  await persist("recurring",{name:r.name,amount:r.amount,category:r.category,frequency:r.frequency,next_date:d.toISOString().slice(0,10)},id);renderAll();toast("Pago registrado y próximo vencimiento actualizado.");
 }catch(e){toast("No se pudo registrar el pago: "+e.message);}
}
function exportCSV(){
 const rows=[["Fecha","Tipo","Concepto","Categoría","Importe (€)"],...data.transactions.map(t=>[t.transaction_date,t.type==="income"?"Ingreso":"Gasto",t.description,t.category,Number(t.amount).toFixed(2)])];
 const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
 download(csv,`saldo-movimientos-${currentMonth()}.csv`,"text/csv;charset=utf-8");toast("CSV preparado.");
}
function download(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function backup(){download(JSON.stringify({app:"Saldo",version:1,exported_at:new Date().toISOString(),data},null,2),`saldo-copia-${today()}.json`,"application/json");}
function importBackup(file){const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),d=parsed.data;if(!d||!Array.isArray(d.transactions)||!Array.isArray(d.budgets)||!Array.isArray(d.goals)||!Array.isArray(d.recurring))throw new Error("Formato no válido");if(mode==="cloud"){toast("La importación JSON solo está disponible en modo local. Para nube, registra o importa los datos mediante herramientas seguras de administración.");return;}if(!confirm("La importación sustituirá los datos locales actuales. ¿Continuar?"))return;data={...emptyData(),...d};saveLocal();renderAll();toast("Copia importada.");}catch(e){toast("No se pudo importar esa copia.");}};reader.readAsText(file);}
function parseCsvLine(line,delimiter){const out=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'&&quoted){value+='"';i++;}else if(ch==='"'){quoted=!quoted;}else if(ch===delimiter&&!quoted){out.push(value.trim());value="";}else value+=ch;}out.push(value.trim());return out;}
function importBBVACsv(file){
 if(mode==="cloud"){toast("La importación bancaria está disponible en modo local por ahora.");return;}
 const reader=new FileReader();reader.onload=()=>{
  try{
   const raw=String(reader.result||"").replace(/^\\uFEFF/,"").trim();if(!raw)throw new Error("Archivo vacío");
   const first=raw.split(/\\r?\\n/)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",";
   const lines=raw.split(/\\r?\\n/).filter(line=>line.trim());if(lines.length<2)throw new Error("Sin movimientos");
   const headers=parseCsvLine(lines[0],delimiter).map(x=>x.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").trim());
   const findHeader=patterns=>headers.findIndex(h=>patterns.some(p=>h===p||h.includes(p)));
   const dateIdx=findHeader(["fecha operacion","fecha valor","fecha","date"]);
   const descIdx=findHeader(["concepto","descripcion","description","detalle","movimiento"]);
   const amountIdx=findHeader(["importe","amount","importe eur","importe euros","cantidad"]);
   const debitIdx=findHeader(["cargo","debe","debit"]);
   const creditIdx=findHeader(["abono","haber","credit"]);
   if(dateIdx<0||descIdx<0||(amountIdx<0&&debitIdx<0&&creditIdx<0))throw new Error("No se reconocen las columnas de fecha, concepto e importe");
   const parseAmount=value=>{let s=String(value||"").replace(/[€\\s]/g,"");if(s.includes(",")&&s.includes(".")){s=s.lastIndexOf(",")>s.lastIndexOf(".")?s.replace(/\\./g,"").replace(",","."):s.replace(/,/g,"");}else if(s.includes(",")){s=s.replace(",",".");}const n=Number(s);return Number.isFinite(n)?n:NaN;};
   const existing=new Set(data.transactions.map(t=>[String(t.transaction_date).slice(0,10),Number(t.amount).toFixed(2),String(t.description||"").trim().toLowerCase()].join("|")));
   let added=0,skipped=0;
   for(const line of lines.slice(1)){
    const cols=parseCsvLine(line,delimiter),dateRaw=cols[dateIdx]||"",desc=(cols[descIdx]||"").trim();
    if(!dateRaw||!desc){skipped++;continue;}
    let amount=amountIdx>=0?parseAmount(cols[amountIdx]):NaN;
    if(!Number.isFinite(amount)&&debitIdx>=0&&creditIdx>=0){const debit=parseAmount(cols[debitIdx]),credit=parseAmount(cols[creditIdx]);amount=Number.isFinite(credit)&&credit!==0?Math.abs(credit):Number.isFinite(debit)?-Math.abs(debit):NaN;}
    if(!Number.isFinite(amount)||amount===0){skipped++;continue;}
    let date=dateRaw.trim(),m=date.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})$/);if(m)date=m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");else if(!/^\\d{4}-\\d{2}-\\d{2}/.test(date)){skipped++;continue;}else date=date.slice(0,10);
    const type=amount>0?"income":"expense",key=[date,Math.abs(amount).toFixed(2),desc.toLowerCase()].join("|");
    if(existing.has(key)){skipped++;continue;}existing.add(key);
    data.transactions.push({id:"bbva-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),type,amount:Math.abs(amount),category:type==="income"?"Otros":"Otros",description:desc,transaction_date:date,created_at:new Date().toISOString()});added++;
   }
   if(!added){toast(skipped?"No se añadieron movimientos nuevos. Revisa el formato del CSV.":"No se encontraron movimientos válidos.");return;}
   data.transactions.sort((a,b)=>String(b.transaction_date).localeCompare(String(a.transaction_date)));saveLocal();renderAll();toast("Importados "+added+" movimientos de BBVA. Duplicados o filas inválidas omitidos: "+skipped+".");
  }catch(e){toast("No se pudo leer el CSV de BBVA: "+e.message);}
 };reader.readAsText(file,"UTF-8");
}
function openSettings(){$("#settingsScreen").classList.remove("hidden");$("#profileName").value=currentName();$("#accountEmail").textContent=user?.email||"Modo local en este dispositivo";$("#syncDetails").textContent=mode==="cloud"?"Sincronización activa: los datos se guardan en Supabase bajo tu usuario.":"Los datos solo están en este navegador. Para sincronizar entre móviles, configura Supabase y usa una cuenta por persona.";}
async function saveProfile(){
 const name=$("#profileName").value.trim();if(!name){toast("Escribe un nombre.");return;}
 try{if(mode==="local"){data.profile.display_name=name;saveLocal();}else{const {error}=await sb.from("profiles").upsert({id:user.id,display_name:name});if(error)throw error;data.profile.display_name=name;}updateIdentity();$("#settingsScreen").classList.add("hidden");toast("Nombre actualizado.");}catch(e){toast("No se pudo guardar: "+e.message);}
}
function showAuth(){ $("#authScreen").classList.remove("hidden");$("#authNote").textContent=hasCloudConfig?"La cuenta sincroniza tus datos entre dispositivos. Cada persona debe usar su propia cuenta.":"Para sincronizar entre móviles, configura Supabase siguiendo el README. Puedes probar localmente mientras tanto."; }
function hideAuth(){$("#authScreen").classList.add("hidden");}
function setAuthMode(m){authMode=m;$$("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===m));$("#authName").classList.toggle("hidden",m!=="signup");$("#authName").parentElement.classList.toggle("hidden",m!=="signup");$("#authSubmit").textContent=m==="signup"?"Crear mi cuenta privada":"Entrar a mi espacio";$("#authHeading").textContent=m==="signup"?"Empieza con claridad.":"Tu dinero, más claro.";}
async function handleAuth(e){e.preventDefault();if(!sb){toast("Configura Supabase en config.js para activar cuentas privadas.");return;}
 const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=$("#authName").value.trim();
 try{if(authMode==="signup"){const {data:res,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name||"Mi espacio"}}});if(error)throw error;if(!res.session){toast("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.");setAuthMode("login");return;}user=res.user;}
 else{const {data:res,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;user=res.user;}
 await startCloud();hideAuth();toast("Sesión iniciada.");}catch(err){toast(err.message||"No se pudo iniciar sesión.");}}
async function startCloud(){mode="cloud";await loadCloud();hideAuth();$("#authScreen").classList.add("hidden");renderAll();}
async function signOut(){
 if(mode==="cloud"&&sb){await sb.auth.signOut();}
 user=null;mode="local";data=getLocal();$("#settingsScreen").classList.add("hidden");showAuth();toast("Sesión cerrada.");renderAll();
}
async function boot(){
 initTheme();$("#dashboardMonth").value=currentMonth();$("#statsMonth").value=currentMonth();$("#transactionMonthFilter").value=currentMonth();
 $("#todayLabel").textContent=new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
 $$("[data-view]").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.view)));
 $("#themeToggle").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
 $("#mobileThemeToggle").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
 ["addTransactionTop","addTransactionPage"].forEach(id=>$("#"+id).addEventListener("click",()=>openModal("transaction")));
 $("#addBudgetBtn").addEventListener("click",()=>openModal("budget"));$("#addGoalBtn").addEventListener("click",()=>openModal("goal"));$("#addRecurringBtn").addEventListener("click",()=>openModal("recurring"));
 $("#closeModal").addEventListener("click",closeModal);$("#cancelModal").addEventListener("click",closeModal);$("#modalForm").addEventListener("submit",submitModal);
 $("#dashboardMonth").addEventListener("change",renderAll);$("#statsMonth").addEventListener("change",renderStatistics);
 ["transactionSearch","transactionTypeFilter","transactionMonthFilter"].forEach(id=>$("#"+id).addEventListener(id==="transactionSearch"?"input":"change",renderTransactions));
 $("#exportBtn").addEventListener("click",exportCSV);$("#quickBackupBtn").addEventListener("click",backup);$("#settingsBtn").addEventListener("click",openSettings);$("#closeSettings").addEventListener("click",()=>$("#settingsScreen").classList.add("hidden"));$("#saveProfile").addEventListener("click",saveProfile);$("#backupBtn").addEventListener("click",backup);$("#importFile").addEventListener("change",e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value="";});$("#bbvaCsvFile").addEventListener("change",e=>{if(e.target.files[0])importBBVACsv(e.target.files[0]);e.target.value="";});$("#signOutBtn").addEventListener("click",signOut);
 $("#continueLocal").addEventListener("click",()=>{mode="local";data=getLocal();hideAuth();renderAll();toast("Modo local: los datos no se sincronizan.");});
 $$("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authMode)));$("#authForm").addEventListener("submit",handleAuth);
 document.body.addEventListener("click",async e=>{
  const del=e.target.closest("[data-delete]");if(del){await removeItem(del.dataset.delete,del.dataset.id);return;}
  const edit=e.target.closest("[data-edit]");if(edit){const kind=edit.dataset.edit==="transactions"?"transaction":edit.dataset.edit==="budgets"?"budget":edit.dataset.edit==="goals"?"goal":"recurring";openModal(kind,edit.dataset.id);return;}
  const con=e.target.closest("[data-contribute]");if(con){await contribute(con.dataset.contribute);return;}
  const pay=e.target.closest("[data-pay]");if(pay){await payRecurring(pay.dataset.pay);}
 });
 data=getLocal();updateIdentity();
 if(sb){
  try{const {data:res}=await sb.auth.getSession();if(res.session){user=res.session.user;await startCloud();}else showAuth();
  }catch(e){showAuth();toast("No se pudo conectar con la nube.");}
 }else{mode="local";renderAll();$("#authNotice").classList.remove("hidden");$("#authNotice").innerHTML="<strong>Modo local:</strong> puedes usar la app en este dispositivo. Para sincronizar de forma privada entre dos móviles, configura Supabase siguiendo el README.";}
}
boot();
})();
