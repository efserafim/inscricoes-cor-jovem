
  const PIX_STATUS_LABEL = {
    aguardando_pagamento: 'Aguardando',
    valor_confere: 'Valor confere',
    divergente: 'Divergente',
    confirmado: 'Confirmado',
    rejeitado: 'Rejeitado'
  };

  let pixConfigId = null;
  let pixQueue = 'camisas';
  let pixCamisasRows = [];
  let pixContribRows = [];

  function setupTesoureiroUi(){
    const isT = !!(window.COR_AUTH && window.COR_AUTH.isTesoureiro());
    document.querySelectorAll('.tab-tesoureiro').forEach(el => {
      el.hidden = !isT;
    });
    if(!isT){
      const pixView = document.getElementById('viewPix');
      if(pixView && pixView.classList.contains('active')){
        document.querySelector('.tab[data-view="inscricoes"]')?.click();
      }
    }
  }

  async function loadPixPanel(){
    if(!(window.COR_AUTH && window.COR_AUTH.isTesoureiro())) return;
    try{
      const cfg = await window.COR_API.getPixConfigStaff();
      if(cfg){
        pixConfigId = cfg.id;
        document.getElementById('pixTipoChave').value = cfg.tipo_chave || 'aleatoria';
        document.getElementById('pixChave').value = cfg.chave_pix || '';
        document.getElementById('pixNome').value = cfg.nome_recebedor || '';
        document.getElementById('pixCidade').value = cfg.cidade || '';
        document.getElementById('pixValorCamisa').value = cfg.valor_camisa != null
          ? String(cfg.valor_camisa).replace('.', ',') : '';
        document.getElementById('pixValorContrib').value = cfg.valor_contribuicao_servo != null
          ? String(cfg.valor_contribuicao_servo).replace('.', ',') : '';
        document.getElementById('pixMensagem').value = cfg.mensagem || '';
        document.getElementById('pixLibCamisa').checked = !!cfg.pagamentos_liberados;
        document.getElementById('pixLibContrib').checked = !!cfg.contribuicoes_liberadas;
        await refreshPixPreview();
      }
      await refreshPixQueues();
    }catch(err){
      console.error(err);
      toast('Não foi possível carregar a aba PIX (verifique o papel tesoureiro e o SQL).');
    }
  }

  async function refreshPixPreview(){
    const preview = document.getElementById('pixPreview');
    const canvas = document.getElementById('pixPreviewCanvas');
    if(!window.COR_PIX) return;
    const chave = document.getElementById('pixChave').value.trim();
    const nome = document.getElementById('pixNome').value.trim();
    const cidade = document.getElementById('pixCidade').value.trim();
    const tipo = document.getElementById('pixTipoChave').value;
    const valor = window.COR_PIX.parseMoney(document.getElementById('pixValorCamisa').value);
    if(!chave || !nome || !cidade || valor == null){
      preview.hidden = true;
      return;
    }
    const payload = window.COR_PIX.buildPayload({
      chave: chave,
      tipoChave: tipo,
      nome: nome,
      cidade: cidade,
      valor: valor,
      txid: 'PREVIEW'
    });
    preview.hidden = false;
    await window.COR_PIX.drawQr(canvas, payload, 160);
  }

  function moneyLabel(n){
    return window.COR_PIX ? window.COR_PIX.formatBRL(n) : String(n ?? '—');
  }

  function summarize(list){
    const totals = { confirmado: 0, pendente: 0, divergente: 0, rejeitado: 0, arrecadado: 0 };
    list.forEach(r => {
      if(r.status === 'confirmado'){
        totals.confirmado++;
        totals.arrecadado += Number(r.valor_informado != null ? r.valor_informado : r.valor_esperado) || 0;
      }else if(r.status === 'divergente') totals.divergente++;
      else if(r.status === 'rejeitado') totals.rejeitado++;
      else totals.pendente++;
    });
    return totals;
  }

  function renderPixTotals(){
    const list = pixQueue === 'camisas' ? pixCamisasRows : pixContribRows;
    const t = summarize(list);
    document.getElementById('pixTotals').innerHTML =
      '<div class="pix-stat"><span class="k">Confirmados</span><span class="v">'+t.confirmado+'</span></div>' +
      '<div class="pix-stat"><span class="k">Pendentes</span><span class="v">'+t.pendente+'</span></div>' +
      '<div class="pix-stat pix-stat-warn"><span class="k">Divergentes</span><span class="v">'+t.divergente+'</span></div>' +
      '<div class="pix-stat pix-stat-money"><span class="k">Arrecadado</span><span class="v">'+esc(moneyLabel(t.arrecadado))+'</span></div>';
  }

  function renderPixTable(){
    const filter = document.getElementById('pixFilterStatus').value;
    let list = (pixQueue === 'camisas' ? pixCamisasRows : pixContribRows).slice();
    if(filter) list = list.filter(r => r.status === filter);
    const tb = document.getElementById('pixTbody');
    const empty = document.getElementById('pixEmpty');
    if(!list.length){
      tb.innerHTML = '';
      empty.hidden = false;
      renderPixTotals();
      return;
    }
    empty.hidden = true;
    tb.innerHTML = list.map(r => {
      const extra = pixQueue === 'camisas'
        ? (r.tipo_pessoa === 'servo' ? ' · Servo' : ' · Cursista') + (r.tamanho_camisa ? ' · '+r.tamanho_camisa : '')
        : '';
      const canAct = r.status !== 'confirmado';
      return '<tr data-id="'+esc(r.id)+'">' +
        '<td data-label="Status"><span class="tag tag-pix" data-st="'+esc(r.status)+'">'+esc(PIX_STATUS_LABEL[r.status]||r.status)+'</span></td>' +
        '<td data-label="Nome">'+esc(r.nome)+'<div class="muted" style="font-size:11px">'+esc(r.telefone||'')+esc(extra)+'</div></td>' +
        '<td data-label="Protocolo">'+esc(r.protocolo)+'</td>' +
        '<td data-label="Esperado">'+esc(moneyLabel(r.valor_esperado))+'</td>' +
        '<td data-label="Informado">'+esc(r.valor_informado != null ? moneyLabel(r.valor_informado) : '—')+'</td>' +
        '<td data-label="Ações" class="pix-actions">' +
          (r.comprovante_url ? '<a class="btn btn-ghost btn-sm" href="'+esc(r.comprovante_url)+'" target="_blank" rel="noopener">Comprovante</a>' : '') +
          (canAct ? '<button type="button" class="btn btn-primary btn-sm" data-act="confirm">Confirmar</button>' : '') +
          (canAct ? '<button type="button" class="btn btn-danger btn-sm" data-act="reject">Rejeitar</button>' : '') +
        '</td>' +
      '</tr>';
    }).join('');
    renderPixTotals();
  }

  async function refreshPixQueues(){
    if(!(window.COR_AUTH && window.COR_AUTH.isTesoureiro())) return;
    const [cam, cont] = await Promise.all([
      window.COR_API.listPagamentosCamisas().catch(()=>[]),
      window.COR_API.listPagamentosContribuicao().catch(()=>[])
    ]);
    pixCamisasRows = Array.isArray(cam) ? cam : [];
    pixContribRows = Array.isArray(cont) ? cont : [];
    renderPixTable();
  }

  async function savePixConfig(e){
    e.preventDefault();
    if(!pixConfigId){
      toast('Configuração PIX não encontrada. Rode o SQL pagamentos-pix.sql.');
      return;
    }
    const valorCamisa = window.COR_PIX.parseMoney(document.getElementById('pixValorCamisa').value);
    const valorContrib = window.COR_PIX.parseMoney(document.getElementById('pixValorContrib').value);
    const patch = {
      tipo_chave: document.getElementById('pixTipoChave').value,
      chave_pix: document.getElementById('pixChave').value.trim(),
      nome_recebedor: document.getElementById('pixNome').value.trim(),
      cidade: document.getElementById('pixCidade').value.trim(),
      valor_camisa: valorCamisa,
      valor_contribuicao_servo: valorContrib,
      mensagem: document.getElementById('pixMensagem').value.trim() || null,
      pagamentos_liberados: document.getElementById('pixLibCamisa').checked,
      contribuicoes_liberadas: document.getElementById('pixLibContrib').checked
    };
    if(!patch.chave_pix || !patch.nome_recebedor || !patch.cidade){
      toast('Preencha chave, nome e cidade.');
      return;
    }
    const btn = document.getElementById('pixSaveBtn');
    const st = document.getElementById('pixConfigStatus');
    btn.disabled = true;
    st.textContent = 'Salvando…';
    try{
      await window.COR_API.savePixConfigStaff(pixConfigId, patch);
      await syncOpenExpected(patch);
      st.textContent = 'Salvo.';
      toast('Configuração PIX salva.');
      await refreshPixPreview();
      await refreshPixQueues();
    }catch(err){
      console.error(err);
      st.textContent = '';
      toast('Falha ao salvar configuração PIX.');
    }finally{
      btn.disabled = false;
    }
  }

  async function syncOpenExpected(patch){
    const open = ['aguardando_pagamento','divergente','rejeitado','valor_confere'];
    if(patch.valor_camisa != null){
      for(const r of pixCamisasRows){
        if(open.indexOf(r.status) >= 0 && Number(r.valor_esperado) !== Number(patch.valor_camisa)){
          await window.COR_API.updatePagamentoCamisa(r.id, { valor_esperado: patch.valor_camisa }).catch(()=>{});
        }
      }
    }
    if(patch.valor_contribuicao_servo != null){
      for(const r of pixContribRows){
        if(open.indexOf(r.status) >= 0 && Number(r.valor_esperado) !== Number(patch.valor_contribuicao_servo)){
          await window.COR_API.updatePagamentoContribuicao(r.id, { valor_esperado: patch.valor_contribuicao_servo }).catch(()=>{});
        }
      }
    }
  }

  async function actPixRow(id, act){
    const nota = act === 'reject'
      ? (prompt('Motivo da rejeição (opcional):') || 'Rejeitado pela tesouraria')
      : (prompt('Nota (opcional):') || null);
    const patch = {
      status: act === 'confirm' ? 'confirmado' : 'rejeitado',
      confirmado_em: new Date().toISOString(),
      nota_tesoureiro: nota
    };
    try{
      if(pixQueue === 'camisas') await window.COR_API.updatePagamentoCamisa(id, patch);
      else await window.COR_API.updatePagamentoContribuicao(id, patch);
      toast(act === 'confirm' ? 'Pagamento confirmado.' : 'Pagamento rejeitado.');
      await refreshPixQueues();
    }catch(err){
      console.error(err);
      toast('Não foi possível atualizar o pagamento.');
    }
  }

  function wirePixPanel(){
    const form = document.getElementById('pixConfigForm');
    if(!form || form.dataset.wired) return;
    form.dataset.wired = '1';
    form.addEventListener('submit', savePixConfig);
    ['pixChave','pixNome','pixCidade','pixValorCamisa','pixTipoChave'].forEach(id=>{
      const el = document.getElementById(id);
      el.addEventListener('change', ()=> refreshPixPreview().catch(()=>{}));
      el.addEventListener('input', ()=> {
        clearTimeout(wirePixPanel._t);
        wirePixPanel._t = setTimeout(()=> refreshPixPreview().catch(()=>{}), 400);
      });
    });
    document.getElementById('pixRefreshBtn').addEventListener('click', ()=> refreshPixQueues());
    document.getElementById('pixFilterStatus').addEventListener('change', renderPixTable);
    document.querySelectorAll('[data-pix-queue]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('[data-pix-queue]').forEach(b=> b.classList.remove('active'));
        btn.classList.add('active');
        pixQueue = btn.getAttribute('data-pix-queue');
        renderPixTable();
      });
    });
    document.getElementById('pixTbody').addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-act]');
      if(!btn) return;
      const tr = btn.closest('tr');
      if(!tr) return;
      actPixRow(tr.getAttribute('data-id'), btn.getAttribute('data-act'));
    });
  }
