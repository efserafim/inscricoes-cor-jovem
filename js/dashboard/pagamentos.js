
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

  function formaLabel(f){
    if(f === 'dinheiro') return 'Dinheiro';
    if(f === 'pix') return 'PIX';
    return '—';
  }

  function dayKey(iso){
    if(!iso) return '';
    return String(iso).slice(0, 10);
  }

  function financeBaseRows(scope){
    const sc = scope || pixQueue;
    if(sc === 'ambos'){
      return pixCamisasRows.map(r => Object.assign({}, r, { _origem: 'camisa' }))
        .concat(pixContribRows.map(r => Object.assign({}, r, { _origem: 'contribuicao', tipo_pessoa: 'servo' })));
    }
    if(sc === 'contribuicao'){
      return pixContribRows.map(r => Object.assign({}, r, { _origem: 'contribuicao', tipo_pessoa: 'servo' }));
    }
    return pixCamisasRows.map(r => Object.assign({}, r, { _origem: 'camisa' }));
  }

  function filteredFinanceRows(scope){
    const search = (document.getElementById('pixFilterSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('pixFilterStatus')?.value || '';
    const forma = document.getElementById('pixFilterForma')?.value || '';
    const pessoa = document.getElementById('pixFilterPessoa')?.value || '';
    const from = document.getElementById('pixFilterFrom')?.value || '';
    const to = document.getElementById('pixFilterTo')?.value || '';
    const dateField = document.getElementById('pixFilterDateField')?.value || 'confirmado_em';

    let list = financeBaseRows(scope);
    if(status) list = list.filter(r => r.status === status);
    if(forma === '__none__') list = list.filter(r => !r.forma_pagamento);
    else if(forma) list = list.filter(r => r.forma_pagamento === forma);
    if(pessoa) list = list.filter(r => r.tipo_pessoa === pessoa);
    if(search){
      list = list.filter(r => {
        const blob = [r.nome, r.protocolo, r.telefone, r.tamanho_camisa, r.nota_tesoureiro]
          .map(x => String(x || '').toLowerCase()).join(' ');
        return blob.indexOf(search) >= 0;
      });
    }
    if(from || to){
      list = list.filter(r => {
        const d = dayKey(r[dateField] || r.enviado_em || r.created_at);
        if(!d) return false;
        if(from && d < from) return false;
        if(to && d > to) return false;
        return true;
      });
    }
    list.sort((a, b) => {
      const da = a.confirmado_em || a.enviado_em || a.created_at || '';
      const db = b.confirmado_em || b.enviado_em || b.created_at || '';
      return String(db).localeCompare(String(da));
    });
    return list;
  }

  function summarizeFinance(list){
    const t = {
      total: list.length,
      confirmado: 0,
      pendente: 0,
      divergente: 0,
      rejeitado: 0,
      pix: 0,
      dinheiro: 0,
      arrecadado: 0,
      arrecadadoPix: 0,
      arrecadadoDinheiro: 0,
      esperadoAberto: 0
    };
    list.forEach(r => {
      const val = Number(r.valor_informado != null ? r.valor_informado : r.valor_esperado) || 0;
      if(r.status === 'confirmado'){
        t.confirmado++;
        t.arrecadado += val;
        if(r.forma_pagamento === 'dinheiro'){ t.dinheiro++; t.arrecadadoDinheiro += val; }
        else { t.pix++; t.arrecadadoPix += val; }
      }else if(r.status === 'divergente') t.divergente++;
      else if(r.status === 'rejeitado') t.rejeitado++;
      else {
        t.pendente++;
        t.esperadoAberto += Number(r.valor_esperado) || 0;
      }
    });
    return t;
  }

  function renderPixTotals(){
    const list = filteredFinanceRows(pixQueue);
    const t = summarizeFinance(list);
    document.getElementById('pixTotals').innerHTML =
      '<div class="pix-stat"><span class="k">No filtro</span><span class="v">'+t.total+'</span></div>' +
      '<div class="pix-stat"><span class="k">Confirmados</span><span class="v">'+t.confirmado+'</span></div>' +
      '<div class="pix-stat"><span class="k">Pendentes</span><span class="v">'+t.pendente+'</span></div>' +
      '<div class="pix-stat pix-stat-warn"><span class="k">Divergentes</span><span class="v">'+t.divergente+'</span></div>' +
      '<div class="pix-stat"><span class="k">PIX</span><span class="v">'+esc(moneyLabel(t.arrecadadoPix))+'</span></div>' +
      '<div class="pix-stat"><span class="k">Dinheiro</span><span class="v">'+esc(moneyLabel(t.arrecadadoDinheiro))+'</span></div>' +
      '<div class="pix-stat pix-stat-money"><span class="k">Arrecadado</span><span class="v">'+esc(moneyLabel(t.arrecadado))+'</span></div>' +
      '<div class="pix-stat"><span class="k">Aberto (esperado)</span><span class="v">'+esc(moneyLabel(t.esperadoAberto))+'</span></div>';
  }

  function renderPixTable(){
    const pessoaSel = document.getElementById('pixFilterPessoa');
    if(pessoaSel) pessoaSel.disabled = pixQueue === 'contribuicao';

    const list = filteredFinanceRows(pixQueue);
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
      const extra = r._origem === 'camisa'
        ? (r.tipo_pessoa === 'servo' ? ' · Servo' : ' · Cursista') + (r.tamanho_camisa ? ' · '+r.tamanho_camisa : '')
        : ' · Contribuição';
      const canAct = r.status !== 'confirmado';
      return '<tr data-id="'+esc(r.id)+'">' +
        '<td data-label="Status"><span class="tag tag-pix" data-st="'+esc(r.status)+'">'+esc(PIX_STATUS_LABEL[r.status]||r.status)+'</span></td>' +
        '<td data-label="Nome">'+esc(r.nome)+'<div class="muted" style="font-size:11px">'+esc(r.telefone||'')+esc(extra)+'</div></td>' +
        '<td data-label="Protocolo">'+esc(r.protocolo)+'</td>' +
        '<td data-label="Forma">'+esc(formaLabel(r.forma_pagamento))+'</td>' +
        '<td data-label="Esperado">'+esc(moneyLabel(r.valor_esperado))+'</td>' +
        '<td data-label="Informado">'+esc(r.valor_informado != null ? moneyLabel(r.valor_informado) : '—')+'</td>' +
        '<td data-label="Ações" class="pix-actions">' +
          (r.comprovante_url ? '<a class="btn btn-ghost btn-sm" href="'+esc(r.comprovante_url)+'" target="_blank" rel="noopener">Comprovante</a>' : '') +
          (canAct ? '<button type="button" class="btn btn-primary btn-sm" data-act="confirm">Confirmar PIX</button>' : '') +
          (canAct ? '<button type="button" class="btn btn-ghost btn-sm" data-act="cash">Dinheiro</button>' : '') +
          (canAct ? '<button type="button" class="btn btn-danger btn-sm" data-act="reject">Rejeitar</button>' : '') +
        '</td>' +
      '</tr>';
    }).join('');
    renderPixTotals();
  }

  function financeFilterCaption(){
    const bits = [];
    bits.push(pixQueue === 'contribuicao' ? 'Contribuição' : 'Camisas');
    const status = document.getElementById('pixFilterStatus')?.value;
    const forma = document.getElementById('pixFilterForma')?.value;
    const pessoa = document.getElementById('pixFilterPessoa')?.value;
    const search = (document.getElementById('pixFilterSearch')?.value || '').trim();
    const from = document.getElementById('pixFilterFrom')?.value;
    const to = document.getElementById('pixFilterTo')?.value;
    if(status) bits.push(PIX_STATUS_LABEL[status] || status);
    if(forma === 'pix') bits.push('Forma PIX');
    if(forma === 'dinheiro') bits.push('Forma dinheiro');
    if(forma === '__none__') bits.push('Sem forma');
    if(pessoa) bits.push(pessoa === 'servo' ? 'Servos' : 'Cursistas');
    if(search) bits.push('Busca: '+search);
    if(from || to) bits.push('Período: '+(from || '…')+' → '+(to || '…'));
    return bits.join(' · ');
  }

  function buildFinancePdfHtml(list, meta){
    const t = summarizeFinance(list);
    const rows = list.map((r, i) => {
      const tipo = r._origem === 'contribuicao' ? 'Contribuição'
        : (r.tipo_pessoa === 'servo' ? 'Camisa · Servo' : 'Camisa · Cursista');
      return '<tr>' +
        '<td class="n">'+(i+1)+'</td>' +
        '<td>'+esc(r.nome||'')+'</td>' +
        '<td>'+esc(r.protocolo||'')+'</td>' +
        '<td>'+esc(tipo)+'</td>' +
        '<td>'+esc(PIX_STATUS_LABEL[r.status]||r.status)+'</td>' +
        '<td>'+esc(formaLabel(r.forma_pagamento))+'</td>' +
        '<td>'+esc(moneyLabel(r.valor_esperado))+'</td>' +
        '<td>'+esc(r.valor_informado != null ? moneyLabel(r.valor_informado) : '—')+'</td>' +
        '<td>'+esc(dayKey(r.confirmado_em || r.enviado_em || r.created_at) || '—')+'</td>' +
      '</tr>';
    }).join('');

    return (
      '<div class="doc pdf-root">' +
        '<div class="banner">' +
          '<p class="eyebrow">XVI C.O.R Jovem · Tesouraria</p>' +
          '<h1>Relatório financeiro</h1>' +
          '<p class="sub">'+esc(meta.subtitle || '')+'</p>' +
          '<p class="meta">'+esc(meta.when)+' · <strong>'+list.length+'</strong> registro(s)</p>' +
        '</div>' +
        '<div class="chips">' +
          '<span class="chip">Confirmados: <b>'+t.confirmado+'</b></span>' +
          '<span class="chip">Pendentes: <b>'+t.pendente+'</b></span>' +
          '<span class="chip">Divergentes: <b>'+t.divergente+'</b></span>' +
          '<span class="chip">PIX: <b>'+esc(moneyLabel(t.arrecadadoPix))+'</b></span>' +
          '<span class="chip">Dinheiro: <b>'+esc(moneyLabel(t.arrecadadoDinheiro))+'</b></span>' +
          '<span class="chip">Arrecadado: <b>'+esc(moneyLabel(t.arrecadado))+'</b></span>' +
          '<span class="chip">Aberto: <b>'+esc(moneyLabel(t.esperadoAberto))+'</b></span>' +
        '</div>' +
        '<table class="doc-table"><thead><tr>' +
          '<th>#</th><th>Nome</th><th>Protocolo</th><th>Tipo</th><th>Status</th><th>Forma</th><th>Esperado</th><th>Informado</th><th>Data</th>' +
        '</tr></thead><tbody>'+rows+'</tbody></table>' +
        '<p class="foot">XVI C.O.R Jovem · Paróquia Santo Antônio — Bacaxá · Documento gerado pelo painel</p>' +
      '</div>'
    );
  }

  function financePrintStyles(){
    return (
      '<style>' +
      '.doc{font-family:"Source Sans 3",Segoe UI,sans-serif;color:#2a3238;}' +
      '.banner{border-bottom:3px solid #c45c26;padding:0 0 14px;margin:0 0 14px;}' +
      '.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c45c26;margin:0 0 6px;}' +
      'h1{font-family:Outfit,Impact,sans-serif;font-size:24px;margin:0;letter-spacing:.04em;text-transform:uppercase;line-height:1.05;}' +
      '.sub{margin:8px 0 0;color:#4a5560;font-size:12.5px;font-weight:600;}' +
      '.meta{margin:6px 0 0;font-size:12px;color:#4a5560;}' +
      '.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;}' +
      '.chip{background:rgba(196,92,38,.12);color:#c45c26;font-size:11px;font-weight:700;padding:5px 9px;border-radius:3px;}' +
      '.chip b{color:#2a3238;}' +
      '.doc-table{width:100%;border-collapse:collapse;font-size:10.5px;}' +
      '.doc-table th{text-align:left;background:#2a3238;color:#fff;padding:7px 6px;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;}' +
      '.doc-table td{padding:6px;border-bottom:1px solid #d5dde4;vertical-align:top;}' +
      '.doc-table tr:nth-child(even) td{background:#f4f8fb;}' +
      '.doc-table .n{color:#8a949c;width:24px;}' +
      '.foot{margin:16px 0 0;font-size:10.5px;color:#8a949c;border-top:1px solid #d5dde4;padding-top:10px;}' +
      '</style>'
    );
  }

  async function downloadFinancePdf(){
    const scope = confirm('Incluir CAMISAS e CONTRIBUIÇÃO no PDF?\n\nOK = ambos · Cancelar = só a fila atual ('+(pixQueue === 'contribuicao' ? 'contribuição' : 'camisas')+')')
      ? 'ambos'
      : pixQueue;
    const list = filteredFinanceRows(scope);
    if(!list.length){
      toast('Nada para exportar neste filtro.');
      return;
    }
    const btn = document.getElementById('pixPdfBtn');
    btn.disabled = true;
    btn.textContent = 'Gerando PDF…';
    const meta = {
      subtitle: financeFilterCaption() + (scope === 'ambos' ? ' · Escopo: camisas + contribuição' : ''),
      when: new Date().toLocaleString('pt-BR'),
      filename: 'relatorio-financeiro-cor-jovem'
    };
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1000px;background:#fff;padding:28px;';
    wrap.innerHTML = financePrintStyles() + buildFinancePdfHtml(list, meta);
    document.body.appendChild(wrap);
    try{
      const src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      if(![...document.scripts].some(s => (s.src || '').indexOf('html2pdf') >= 0)){
        await new Promise((resolve, reject)=>{
          const s = document.createElement('script');
          s.src = src;
          s.onload = ()=> resolve();
          s.onerror = ()=> reject(new Error('Falha html2pdf'));
          document.head.appendChild(s);
        });
      }
      await window.html2pdf().set({
        margin: [8, 8, 10, 8],
        filename: meta.filename + '.pdf',
        image: { type:'jpeg', quality:0.98 },
        html2canvas: { scale:2, useCORS:true, letterRendering:true },
        jsPDF: { unit:'mm', format:'a4', orientation:'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(wrap.querySelector('.doc')).save();
      toast('PDF financeiro baixado.');
    }catch(err){
      console.error(err);
      const sheet = document.getElementById('printSheet');
      if(sheet){
        sheet.innerHTML = financePrintStyles() + buildFinancePdfHtml(list, meta);
        setTimeout(()=> window.print(), 200);
      }
      toast('Use Imprimir → Salvar como PDF.');
    }finally{
      wrap.remove();
      btn.disabled = false;
      btn.textContent = 'Baixar PDF financeiro';
    }
  }

  function clearFinanceFilters(){
    document.getElementById('pixFilterSearch').value = '';
    document.getElementById('pixFilterStatus').value = '';
    document.getElementById('pixFilterForma').value = '';
    document.getElementById('pixFilterPessoa').value = '';
    document.getElementById('pixFilterFrom').value = '';
    document.getElementById('pixFilterTo').value = '';
    document.getElementById('pixFilterDateField').value = 'confirmado_em';
    renderPixTable();
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
    if(act === 'cash'){
      const row = (pixQueue === 'camisas' ? pixCamisasRows : pixContribRows).find(r => r.id === id);
      if(!row) return;
      if(!confirm('Confirmar pagamento em DINHEIRO de "'+(row.nome||'')+'"?')) return;
      const valor = row.valor_esperado != null ? Number(row.valor_esperado) : null;
      const patch = {
        status: 'confirmado',
        forma_pagamento: 'dinheiro',
        valor_informado: valor,
        confirmado_em: new Date().toISOString(),
        nota_tesoureiro: 'Confirmado em dinheiro pela tesouraria'
      };
      try{
        if(pixQueue === 'camisas') await window.COR_API.updatePagamentoCamisa(id, patch);
        else await window.COR_API.updatePagamentoContribuicao(id, patch);
        toast('Pagamento em dinheiro confirmado.');
        await refreshPixQueues();
      }catch(err){
        console.error(err);
        toast('Não foi possível confirmar em dinheiro. Rode o SQL pagamentos-dinheiro.sql.');
      }
      return;
    }
    const nota = act === 'reject'
      ? (prompt('Motivo da rejeição (opcional):') || 'Rejeitado pela tesouraria')
      : (prompt('Nota (opcional):') || null);
    const patch = {
      status: act === 'confirm' ? 'confirmado' : 'rejeitado',
      forma_pagamento: act === 'confirm' ? 'pix' : null,
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

  async function submitCashRegister(){
    const busca = document.getElementById('pixCashBusca').value.trim();
    const tipo = document.getElementById('pixCashTipo').value;
    const st = document.getElementById('pixCashStatus');
    const btn = document.getElementById('pixCashBtn');
    if(busca.length < 4){
      st.textContent = 'Informe telefone ou protocolo.';
      return;
    }
    if(!confirm('Confirmar pagamento em DINHEIRO para esta busca ('+(tipo === 'contribuicao' ? 'contribuição' : 'camisa')+')?')) return;
    btn.disabled = true;
    st.textContent = 'Registrando…';
    try{
      const data = await window.COR_API.registrarPagamentoDinheiro(busca, tipo);
      if(!data || !data.ok){
        const e = data && data.erro;
        st.textContent = e === 'NAO_ENCONTRADO' ? 'Não encontrado (camisa exige pedido de camisa).'
          : e === 'SEM_VALOR' ? 'Defina o valor na configuração e salve.'
          : e === 'NAO_AUTORIZADO' ? 'Só o tesoureiro pode confirmar dinheiro.'
          : 'Não foi possível registrar.';
        return;
      }
      st.textContent = 'OK: '+(data.nome||'')+' · '+(window.COR_PIX.formatBRL(data.valor));
      document.getElementById('pixCashBusca').value = '';
      toast('Dinheiro confirmado.');
      await refreshPixQueues();
    }catch(err){
      console.error(err);
      st.textContent = 'Erro. Rode o SQL sql/pagamentos-dinheiro.sql no Supabase.';
    }finally{
      btn.disabled = false;
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
    document.getElementById('pixClearFiltersBtn').addEventListener('click', clearFinanceFilters);
    document.getElementById('pixPdfBtn').addEventListener('click', ()=> downloadFinancePdf());
    ['pixFilterSearch','pixFilterStatus','pixFilterForma','pixFilterPessoa','pixFilterFrom','pixFilterTo','pixFilterDateField']
      .forEach(id=>{
        const el = document.getElementById(id);
        if(!el) return;
        el.addEventListener('change', renderPixTable);
        el.addEventListener('input', ()=>{
          clearTimeout(wirePixPanel._ft);
          wirePixPanel._ft = setTimeout(renderPixTable, 180);
        });
      });
    document.getElementById('pixCashBtn').addEventListener('click', submitCashRegister);
    document.getElementById('pixCashBusca').addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); submitCashRegister(); }
    });
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
