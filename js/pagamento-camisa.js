(function () {
  const STATUS_LABEL = {
    aguardando_pagamento: 'Aguardando pagamento',
    valor_confere: 'Valor confere — em análise',
    divergente: 'Valor divergente — em análise',
    confirmado: 'Pagamento confirmado',
    rejeitado: 'Comprovante rejeitado — envie de novo'
  };

  let lastBusca = '';
  let current = null;

  const closedCard = document.getElementById('closedCard');
  const searchCard = document.getElementById('searchCard');
  const resultCard = document.getElementById('resultCard');
  const searchErr = document.getElementById('searchErr');
  const uploadErr = document.getElementById('uploadErr');
  const doneMsg = document.getElementById('doneMsg');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showErr(el, msg) {
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function mapErro(code) {
    const c = String(code || '');
    if (c === 'PAGAMENTOS_FECHADOS') return 'Pagamentos de camisa ainda não foram liberados.';
    if (c === 'NAO_ENCONTRADO') return 'Não encontramos inscrição com camisa para esta busca.';
    if (c === 'BUSCA_INVALIDA') return 'Informe um telefone ou protocolo válido.';
    if (c === 'JA_CONFIRMADO') return 'Este pagamento já foi confirmado.';
    if (c === 'RATE_LIMITED') return 'Muitas tentativas. Aguarde alguns minutos.';
    return 'Não foi possível consultar. Tente de novo.';
  }

  async function renderQr(){ /* QR removido das páginas públicas */ }

  function fillResult(data) {
    const p = data.pagamento;
    const pix = data.pix || {};
    current = p;
    document.getElementById('rNome').textContent = p.nome || '—';
    document.getElementById('rMeta').textContent =
      'Protocolo ' + (p.protocolo || '—') +
      (p.tipo_pessoa ? ' · ' + (p.tipo_pessoa === 'servo' ? 'Servo' : 'Cursista') : '') +
      (p.tamanho_camisa ? ' · Tam. ' + p.tamanho_camisa : '');
    const st = document.getElementById('rStatus');
    st.textContent = STATUS_LABEL[p.status] || p.status;
    st.dataset.status = p.status || '';

    document.getElementById('rValor').textContent = window.COR_PIX.formatBRL(p.valor_esperado);
    document.getElementById('pixMsg').textContent = pix.mensagem || '';

    const payload = window.COR_PIX.buildPayload({
      chave: pix.chave_pix,
      tipoChave: pix.tipo_chave,
      nome: pix.nome_recebedor,
      cidade: pix.cidade,
      valor: p.valor_esperado,
      txid: (p.protocolo || 'COR').slice(0, 25)
    });
    document.getElementById('pixCopia').value = payload;

    const confirmed = p.status === 'confirmado';
    const payTools = document.getElementById('pixPayTools');
    document.getElementById('uploadForm').hidden = confirmed;
    if (payTools) payTools.hidden = confirmed;
    document.getElementById('pixBlock').hidden = false;
    doneMsg.hidden = !confirmed;
    if (confirmed) {
      doneMsg.innerHTML = '<strong>Pagamento confirmado.</strong> Que Deus abençoe sua oferta — Verso l’alto!';
    } else if (p.status === 'divergente') {
      doneMsg.hidden = false;
      doneMsg.textContent = 'Comprovante recebido com valor diferente do esperado. A tesouraria vai conferir.';
    } else if (p.status === 'rejeitado') {
      doneMsg.hidden = false;
      doneMsg.textContent = p.nota_tesoureiro
        ? ('Rejeitado: ' + p.nota_tesoureiro)
        : 'Comprovante rejeitado. Envie novamente.';
    } else {
      doneMsg.hidden = true;
    }

    if (p.valor_esperado != null) {
      document.getElementById('valorPago').value = String(p.valor_esperado).replace('.', ',');
    }

    resultCard.hidden = false;
  }

  async function init() {
    if (window.COR_SITE) window.COR_SITE.renderContato('#contatoEquipe');
    try {
      const pub = await window.COR_API.getPixPublico();
      if (!pub || !pub.liberado) {
        closedCard.hidden = false;
        searchCard.hidden = true;
        return;
      }
    } catch (err) {
      console.error(err);
      closedCard.hidden = false;
      searchCard.hidden = true;
      closedCard.querySelector('h2').textContent = 'Indisponível no momento';
      closedCard.querySelector('p').textContent = 'Não foi possível verificar se os pagamentos estão liberados.';
    }
  }

  async function consultar() {
    showErr(searchErr, '');
    const busca = document.getElementById('busca').value.trim();
    if (busca.length < 4) {
      showErr(searchErr, 'Informe telefone ou protocolo.');
      return;
    }
    const btn = document.getElementById('buscarBtn');
    btn.disabled = true;
    btn.textContent = 'Consultando…';
    try {
      const data = await window.COR_API.consultarPagamentoCamisa(busca);
      if (!data || !data.ok) {
        showErr(searchErr, mapErro(data && data.erro));
        resultCard.hidden = true;
        return;
      }
      lastBusca = busca;
      fillResult(data);
    } catch (err) {
      console.error(err);
      showErr(searchErr, err.code === 'RATE_LIMITED' ? mapErro('RATE_LIMITED') : mapErro());
    } finally {
      btn.disabled = false;
      btn.textContent = 'Consultar';
    }
  }

  document.getElementById('buscarBtn').addEventListener('click', consultar);
  document.getElementById('busca').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      consultar();
    }
  });

  document.getElementById('copyPixBtn').addEventListener('click', async () => {
    const t = document.getElementById('pixCopia').value;
    try {
      await navigator.clipboard.writeText(t);
      document.getElementById('copyPixBtn').textContent = 'Copiado!';
      setTimeout(() => { document.getElementById('copyPixBtn').textContent = 'Copiar código PIX'; }, 1600);
    } catch (_) {
      document.getElementById('pixCopia').select();
    }
  });

  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr(uploadErr, '');
    if (!current || !lastBusca) {
      showErr(uploadErr, 'Consulte seu cadastro antes de enviar.');
      return;
    }
    const valor = window.COR_PIX.parseMoney(document.getElementById('valorPago').value);
    const file = document.getElementById('comprovante').files[0];
    if (valor == null || valor <= 0) {
      showErr(uploadErr, 'Informe o valor pago.');
      return;
    }
    if (!file) {
      showErr(uploadErr, 'Anexe o comprovante.');
      return;
    }
    const btn = document.getElementById('enviarBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const up = await window.COR_API.uploadComprovante(file, 'camisas');
      const data = await window.COR_API.enviarComprovanteCamisa({
        pagamentoId: current.id,
        busca: lastBusca,
        valorInformado: valor,
        comprovanteUrl: up.url,
        comprovantePath: up.path
      });
      if (!data || !data.ok) {
        showErr(uploadErr, mapErro(data && data.erro) || 'Falha ao enviar.');
        return;
      }
      const refreshed = await window.COR_API.consultarPagamentoCamisa(lastBusca);
      if (refreshed && refreshed.ok) fillResult(refreshed);
    } catch (err) {
      console.error(err);
      showErr(uploadErr, err.message || 'Falha ao enviar comprovante.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar comprovante';
    }
  });

  init();
})();
