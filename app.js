
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const KEY = 'meu_financeiro_v1';

const seed = {
  settings: {
    monthlyIncome: 0,
    fixedExpenses: 0,
    plannedInvestments: 0,
    freeBudget: 0
  },
  transactions: [],
  debts: [],
  goals: []
};

let state = load();
let currentView = 'home';
let deferredPrompt = null;

function load() {
  try {
    return { ...structuredClone(seed), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return structuredClone(seed);
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function money(v) { return fmt.format(Number(v || 0)); }
function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function thisMonthTransactions() {
  const mk = monthKey();
  return state.transactions.filter(t => (t.date || '').startsWith(mk));
}
function daysLeft() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  return Math.max(1, last - now.getDate() + 1);
}
function calc() {
  const tx = thisMonthTransactions();
  const incomes = tx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const freeSpent = tx.filter(t=>t.type==='expense' && t.classification==='free').reduce((s,t)=>s+Number(t.amount),0);
  const fixedTx = tx.filter(t=>t.type==='expense' && t.classification==='fixed').reduce((s,t)=>s+Number(t.amount),0);
  const debtTx = tx.filter(t=>t.type==='expense' && t.classification==='debt').reduce((s,t)=>s+Number(t.amount),0);
  const investTx = tx.filter(t=>t.type==='expense' && t.classification==='investment').reduce((s,t)=>s+Number(t.amount),0);

  const income = Math.max(Number(state.settings.monthlyIncome||0), incomes);
  const fixed = Math.max(Number(state.settings.fixedExpenses||0), fixedTx);
  const scheduledDebt = state.debts.reduce((s,d)=>s+Number(d.monthlyPayment||0),0);
  const debt = Math.max(debtTx, scheduledDebt);
  const plannedInvest = Math.max(Number(state.settings.plannedInvestments||0), investTx);

  let freeBase = income - fixed - debt - plannedInvest;
  if (Number(state.settings.freeBudget||0) > 0) freeBase = Math.min(freeBase, Number(state.settings.freeBudget));
  const freeAvailable = Math.max(0, freeBase - freeSpent);
  const daily = freeAvailable / daysLeft();
  return { income, fixed, debt, plannedInvest, freeBase:Math.max(0,freeBase), freeSpent, freeAvailable, daily };
}

function iconFor(cat) {
  const map = { 'Alimentação':'🍽️','Transporte':'🚗','Moradia':'🏠','Saúde':'❤️','Lazer':'🎮','Compras':'🛍️','Salário':'💰','Outros':'🧾' };
  return map[cat] || '🧾';
}
function txHtml(t) {
  return `<div class="tx">
    <div class="tx-left">
      <div class="tx-icon">${iconFor(t.category)}</div>
      <div class="tx-meta">
        <strong>${escapeHtml(t.description)}</strong>
        <span>${t.category} • ${formatDate(t.date)}</span>
      </div>
    </div>
    <div class="tx-amount ${t.type}">${t.type==='expense'?'-':'+'}${money(t.amount)}</div>
  </div>`;
}
function formatDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function escapeHtml(s='') {
  return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function renderHome() {
  const c = calc();
  document.getElementById('freeAmount').textContent = money(c.freeAvailable);
  document.getElementById('dailyLimit').textContent = `${money(c.daily)} por dia até o fim do mês`;
  document.getElementById('incomeStat').textContent = money(c.income);
  document.getElementById('fixedStat').textContent = money(c.fixed);
  document.getElementById('debtStat').textContent = money(c.debt);
  document.getElementById('investStat').textContent = money(c.plannedInvest);
  document.getElementById('spentFree').textContent = money(c.freeSpent);
  document.getElementById('remainingDays').textContent = `${daysLeft()} dias restantes`;

  const pct = c.freeBase > 0 ? Math.min(100, c.freeSpent/c.freeBase*100) : 0;
  document.getElementById('budgetBar').style.width = `${pct}%`;
  document.getElementById('budgetLabel').textContent = `${Math.round(pct)}% do limite livre utilizado`;

  const badge = document.getElementById('healthBadge');
  badge.textContent = c.income === 0 ? 'Configure sua renda' : pct < 70 ? 'Dentro do planejado' : pct < 90 ? 'Atenção' : 'Limite próximo';
  const alerts = [];
  if (c.income === 0) alerts.push({cls:'warn',title:'Configure sua renda',text:'Informe sua renda líquida mensal em Ajustes para calcular o valor realmente livre.'});
  if (c.freeBase <= 0 && c.income > 0) alerts.push({cls:'bad',title:'Orçamento comprometido',text:'Suas obrigações, dívidas e investimentos planejados consomem toda a renda calculada.'});
  if (pct >= 90) alerts.push({cls:'bad',title:'Gasto livre quase esgotado',text:`Você já utilizou ${Math.round(pct)}% do orçamento livre deste mês.`});
  else if (pct >= 70) alerts.push({cls:'warn',title:'Atenção ao ritmo de gastos',text:`Você já utilizou ${Math.round(pct)}% do orçamento livre.`});
  else if (c.income > 0) alerts.push({cls:'good',title:'Ritmo controlado',text:`Seu limite sugerido é ${money(c.daily)} por dia até o fim do mês.`});

  document.getElementById('alerts').innerHTML = alerts.map(a=>`<div class="alert ${a.cls}"><strong>${a.title}</strong><span>${a.text}</span></div>`).join('');
  const recent = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('recentTransactions').innerHTML = recent.length ? recent.map(txHtml).join('') : `<div class="card"><span class="muted">Nenhum lançamento ainda.</span></div>`;
}

function renderTransactions() {
  const root = document.getElementById('view');
  const list = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  root.innerHTML = `
    <section class="section" style="margin-top:0">
      <div class="section-head">
        <div><p class="eyebrow">HISTÓRICO</p><h3>Lançamentos</h3></div>
        <button class="primary small" data-action="open-transaction">+ Novo</button>
      </div>
      <div class="stack">${list.length ? list.map((t,i)=>txHtml(t)+`<div class="list-actions"><button class="ghost small danger" data-delete-tx="${t.id}">Excluir</button></div>`).join('') : '<div class="card">Nenhum lançamento cadastrado.</div>'}</div>
    </section>`;
}
function renderDebts() {
  const root = document.getElementById('view');
  const total = state.debts.reduce((s,d)=>s+Number(d.balance||0),0);
  root.innerHTML = `
  <section class="section" style="margin-top:0">
    <div class="section-head"><div><p class="eyebrow">QUITAÇÃO</p><h3>Dívidas</h3></div></div>
    <div class="card"><span class="muted">Saldo devedor total</span><strong class="metric-big">${money(total)}</strong></div>
  </section>
  <section class="section">
    <div class="card form-card">
      <h3 style="margin:0">Adicionar dívida</h3>
      <label>Nome<input id="debtName" placeholder="Ex.: Financiamento do carro"></label>
      <label>Saldo devedor<input id="debtBalance" type="number" step="0.01"></label>
      <label>Parcela mensal<input id="debtPayment" type="number" step="0.01"></label>
      <label>Juros ao mês (%)<input id="debtRate" type="number" step="0.01"></label>
      <button class="primary" id="addDebt">Adicionar dívida</button>
    </div>
  </section>
  <section class="section"><div class="stack">
    ${state.debts.map(d=>{
      const rate = Number(d.rate||0)/100;
      const extra = 500;
      const monthsNormal = estimateMonths(Number(d.balance), Number(d.monthlyPayment), rate);
      const monthsExtra = estimateMonths(Number(d.balance), Number(d.monthlyPayment)+extra, rate);
      return `<div class="card">
        <strong>${escapeHtml(d.name)}</strong>
        <p class="info-note">Saldo: ${money(d.balance)} • Parcela: ${money(d.monthlyPayment)} • Juros: ${Number(d.rate||0).toFixed(2)}% a.m.</p>
        <p class="info-note">Com R$ 500 extras/mês: redução estimada de ${Math.max(0,monthsNormal-monthsExtra)} meses.</p>
        <div class="list-actions"><button class="ghost small danger" data-delete-debt="${d.id}">Excluir</button></div>
      </div>`;
    }).join('') || '<div class="card">Nenhuma dívida cadastrada.</div>'}
  </div></section>`;
}
function estimateMonths(balance,payment,rate){
  if (balance<=0) return 0;
  if (payment<=0) return 999;
  let b=balance, m=0;
  while(b>0 && m<600){
    b = b*(1+rate)-payment;
    m++;
    if (rate>0 && payment <= balance*rate && m>2) return 999;
  }
  return m;
}
function renderInvestments() {
  const root = document.getElementById('view');
  const c = calc();
  root.innerHTML = `
  <section class="section" style="margin-top:0">
    <div class="section-head"><div><p class="eyebrow">PLANEJAMENTO</p><h3>Investimentos</h3></div></div>
    <div class="card">
      <span class="muted">Potencial para investir sem usar o dinheiro das contas</span>
      <strong class="metric-big">${money(Math.max(0,c.freeAvailable))}</strong>
      <p class="info-note">Este valor considera a renda informada, contas obrigatórias, dívidas e investimentos já planejados.</p>
    </div>
  </section>
  <section class="section">
    <div class="card form-card">
      <h3 style="margin:0">Simulador de renda mensal</h3>
      <label>Valor por cota/ação<input id="assetPrice" type="number" step="0.01" placeholder="100,00"></label>
      <label>Rendimento mensal por cota<input id="assetYield" type="number" step="0.01" placeholder="1,00"></label>
      <button class="primary" id="calcMagic">Calcular quantidade</button>
      <div id="magicResult"></div>
    </div>
  </section>`;
}
function renderSettings() {
  const s = state.settings;
  const root = document.getElementById('view');
  root.innerHTML = `
  <section class="section" style="margin-top:0">
    <div class="section-head"><div><p class="eyebrow">CONFIGURAÇÃO</p><h3>Seu orçamento</h3></div></div>
    <div class="card form-card">
      <label>Renda líquida mensal<input id="setIncome" type="number" step="0.01" value="${s.monthlyIncome||''}"></label>
      <label>Contas obrigatórias mensais<input id="setFixed" type="number" step="0.01" value="${s.fixedExpenses||''}"></label>
      <label>Investimentos planejados<input id="setInvest" type="number" step="0.01" value="${s.plannedInvestments||''}"></label>
      <label>Limite opcional para gastos livres<input id="setFree" type="number" step="0.01" value="${s.freeBudget||''}" placeholder="Deixe 0 para cálculo automático"></label>
      <button class="primary" id="saveSettings">Salvar ajustes</button>
    </div>
  </section>
  <section class="section">
    <div class="card">
      <h3 style="margin-top:0">WhatsApp</h3>
      <p class="info-note">A versão atual já está preparada para receber lançamentos por uma API. Para automatizar mensagens como <code>gastei 35 no mercado</code>, será necessário conectar um webhook do WhatsApp ao mesmo banco de dados do app.</p>
    </div>
  </section>
  <section class="section">
    <button class="ghost full danger" id="resetData">Apagar dados deste aparelho</button>
  </section>`;
}

function render(view='home') {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===view));
  if (view==='home') location.reload(); // home layout lives in base HTML
  if (view==='transactions') renderTransactions();
  if (view==='debts') renderDebts();
  if (view==='investments') renderInvestments();
  if (view==='settings') renderSettings();
  bindDynamic();
}

function bindDynamic(){
  document.querySelectorAll('[data-action="open-transaction"]').forEach(b=>b.onclick=()=>document.getElementById('transactionDialog').showModal());
  document.querySelectorAll('[data-delete-tx]').forEach(b=>b.onclick=()=>{
    state.transactions = state.transactions.filter(t=>t.id!==b.dataset.deleteTx); save(); renderTransactions();
  });
  document.querySelectorAll('[data-delete-debt]').forEach(b=>b.onclick=()=>{
    state.debts = state.debts.filter(d=>d.id!==b.dataset.deleteDebt); save(); renderDebts();
  });
  const addDebt = document.getElementById('addDebt');
  if (addDebt) addDebt.onclick=()=>{
    const name = document.getElementById('debtName').value.trim();
    if(!name) return alert('Informe o nome da dívida.');
    state.debts.push({
      id:crypto.randomUUID(), name,
      balance:Number(document.getElementById('debtBalance').value||0),
      monthlyPayment:Number(document.getElementById('debtPayment').value||0),
      rate:Number(document.getElementById('debtRate').value||0)
    });
    save(); renderDebts();
  };
  const saveSettings = document.getElementById('saveSettings');
  if (saveSettings) saveSettings.onclick=()=>{
    state.settings.monthlyIncome=Number(document.getElementById('setIncome').value||0);
    state.settings.fixedExpenses=Number(document.getElementById('setFixed').value||0);
    state.settings.plannedInvestments=Number(document.getElementById('setInvest').value||0);
    state.settings.freeBudget=Number(document.getElementById('setFree').value||0);
    save(); alert('Ajustes salvos.');
  };
  const reset = document.getElementById('resetData');
  if (reset) reset.onclick=()=>{
    if(confirm('Deseja apagar todos os dados deste aparelho?')){
      localStorage.removeItem(KEY); location.reload();
    }
  };
  const calcMagic = document.getElementById('calcMagic');
  if(calcMagic) calcMagic.onclick=()=>{
    const p=Number(document.getElementById('assetPrice').value||0);
    const y=Number(document.getElementById('assetYield').value||0);
    const out=document.getElementById('magicResult');
    if(p<=0||y<=0){out.innerHTML='<p class="info-note">Informe preço e rendimento maiores que zero.</p>'; return;}
    const q=Math.ceil(p/y);
    out.innerHTML=`<div class="alert good"><strong>${q} cotas/ações</strong><span>Com rendimento mensal de ${money(y)} por unidade, ${q} unidades gerariam aproximadamente ${money(q*y)}/mês, valor suficiente para cobrir o preço informado de uma nova unidade (${money(p)}).</span></div>`;
  };
}
document.addEventListener('click', e=>{
  const nav=e.target.closest('[data-nav]');
  if(nav){ e.preventDefault(); render(nav.dataset.nav); }
});
document.getElementById('transactionForm').addEventListener('submit', e=>{
  e.preventDefault();
  state.transactions.push({
    id:crypto.randomUUID(),
    type:document.getElementById('txType').value,
    description:document.getElementById('txDesc').value.trim(),
    amount:Number(document.getElementById('txAmount').value),
    category:document.getElementById('txCategory').value,
    classification:document.getElementById('txClass').value,
    date:new Date().toISOString().slice(0,10)
  });
  save();
  document.getElementById('transactionDialog').close();
  e.target.reset();
  renderHome();
});
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault(); deferredPrompt=e;
  document.getElementById('installBtn').classList.remove('hidden');
});
document.getElementById('installBtn').onclick=async()=>{
  if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; }
};
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
renderHome();
bindDynamic();
