(function () {
  const STATUS_LABEL = {
    aguardando_pagamento: 'Aguardando pagamento',
    valor_confere: 'Em análise',
    divergente: 'Valor divergente',
    confirmado: 'Pago',
    rejeitado: 'Rejeitado'
  };

  let lastBusca = '';
  let current = null;
  let cartaoIntegrado = false;
  let pixDisponivel = false;
  let activeTab = 'cartao';

  const closedCard = document.getElementById('closedCard');
  const searchCard = document.getElementById('searchCard');
  const resultCard = document.getElementById('resultCard');
  const searchErr = document.getElementById('searchErr');
  const payErr = document.getElementById('payErr');
  const uploadErr = document.getElementById('uploadErr');
  const doneMsg = document.getElementById('doneMsg');
  const methodsBlock = document.getElementById('payMethodsBlock');
  const payTabs = document.getElementById('payTabs');
  const tabCartao = document.getElementById('tabCartao');
  const tabPix = document.getElementById('tabPix');
  const panelCartao = document.getElementById('panelCartao');
  const panelPix = document.getElementById('panelPix');
  const cardBtn = document.getElementById('cardPayBtn');
  const cardSyncBtn = document.getElementById('cardSyncBtn');

  function money(n) {
    if (n == null || n === '') return '—';
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    if (c === 'CHECKOUT_FALHOU') return 'Não foi possível abrir o checkout. Tente de novo.';
    return 'Não foi possível concluir. Tente de novo.';
  }

  function pixCamisaConfig(pub) {
    const fixo = window.COR_PIX_CAMISA_FIXO || {};
    const chaveFixa = String(fixo.chave || '').trim();
    if (chaveFixa) {
      return {
        chave: chaveFixa,
        tipoChave: fixo.tipoChave || 'telefone',
        nome: fixo.nome || 'Welerson Mendonça de Almeida',
        cidade: fixo.cidade || 'SAQUAREMA'
      };
    }
    if (pub && pub.chave_pix && pub.nome_recebedor && pub.cidade) {
      return {
        chave: pub.chave_pix,
        tipoChave: pub.tipo_chave || 'telefone',
        nome: pub.nome_recebedor,
        cidade: pub.cidade
      };
    }
    return null;
  }

  function readReturnParams() {
    const q = new URLSearchParams(location.search);
    return {
      busca: q.get('busca') || '',
      pago: q.get('pago') === '1',
      orderNsu: q.get('order_nsu') || '',
      transactionNsu: q.get('transaction_nsu') || '',
      slug: q.get('slug') || ''
    };
  }

  function clearReturnParams() {
    if (!location.search) return;
    history.replaceState({}, '', location.pathname);
  }

  function selectPayTab(tab) {
    activeTab = tab;
    const isCartao = tab === 'cartao';
    if (tabCartao) {
      tabCartao.classList.toggle('active', isCartao);
      tabCartao.setAttribute('aria-selected', isCartao ? 'true' : 'false');
    }
    if (tabPix) {
      tabPix.classList.toggle('active', !isCartao);
      tabPix.setAttribute('aria-selected', !isCartao ? 'true' : 'false');
    }
    if (panelCartao) {
      panelCartao.classList.toggle('active', isCartao);
      panelCartao.hidden = !isCartao;
    }
    if (panelPix) {
      panelPix.classList.toggle('active', !isCartao);
      panelPix.hidden = isCartao;
    }
  }

  async function renderQr(payload) {
    const canvas = document.getElementById('pixQr');
    if (!canvas || !payload || !window.COR_PIX) return;
    await window.COR_PIX.drawQr(canvas, payload, 200);
  }

  function setupMethodsUi(p, pub, confirmed) {
    cartaoIntegrado = !!pub.cartao_integrado;
    pixDisponivel = !!pixCamisaConfig(pub) && !confirmed;

    if (methodsBlock) methodsBlock.hidden = confirmed || (!cartaoIntegrado && !pixDisponivel);

    if (payTabs) {
      payTabs.hidden = !(cartaoIntegrado && pixDisponivel);
    }

    if (cartaoIntegrado && cardBtn) {
      cardBtn.textContent = 'Pagar ' + money(p.valor_esperado);
      cardBtn.disabled = false;
    }
    if (cardSyncBtn) cardSyncBtn.hidden = !cartaoIntegrado;

    if (pixDisponivel) {
      const cfg = pixCamisaConfig(pub);
      const recebedor = document.getElementById('pixRecebedor');
      if (recebedor) recebedor.textContent = cfg.nome;

      const valor = p.valor_esperado;
      const payload = window.COR_PIX.buildPayload({
        chave: cfg.chave,
        tipoChave: cfg.tipoChave,
        nome: cfg.nome,
        cidade: cfg.cidade,
        valor: valor,
        txid: ('TX' + (p.protocolo || 'COR')).slice(0, 25)
      });
      document.getElementById('pixCopia').value = payload;
      renderQr(payload);

      if (valor != null) {
        document.getElementById('valorPago').value = String(valor).replace('.', ',');
      }
    }

    if (confirmed) return;

    if (cartaoIntegrado && pixDisponivel) {
      selectPayTab(activeTab === 'pix' ? 'pix' : 'cartao');
    } else if (pixDisponivel) {
      selectPayTab('pix');
    } else {
      selectPayTab('cartao');
    }
  }

  function fillResult(data) {
    const p = data.pagamento;
    const pub = data.pix || {};
    current = p;

    document.getElementById('rNome').textContent = p.nome || '—';
    document.getElementById('rMeta').textContent =
      'Protocolo ' + (p.protocolo || '—') +
      (p.tipo_pessoa ? ' · ' + (p.tipo_pessoa === 'servo' ? 'Servo' : 'Cursista') : '') +
      (p.tamanho_camisa ? ' · Tam. ' + p.tamanho_camisa : '');

    const st = document.getElementById('rStatus');
    st.textContent = STATUS_LABEL[p.status] || p.status;
    st.dataset.status = p.status || '';

    document.getElementById('rValor').textContent = money(p.valor_esperado);

    const confirmed = p.status === 'confirmado';
    setupMethodsUi(p, pub, confirmed);

    showErr(payErr, '');
    showErr(uploadErr, '');

    if (confirmed) {
      doneMsg.hidden = false;
      doneMsg.innerHTML = '<strong>Pagamento confirmado.</strong> Obrigado — Verso l\'alto!';
    } else if (p.status === 'divergente') {
      doneMsg.hidden = false;
      doneMsg.textContent = 'Comprovante recebido. A tesouraria vai conferir.';
      doneMsg.style.background = '#fff8e8';
      doneMsg.style.borderColor = '#f0dca8';
      doneMsg.style.color = '#6b4f1a';
    } else if (p.status === 'valor_confere') {
      doneMsg.hidden = false;
      doneMsg.textContent = 'Comprovante recebido. Aguardando confirmação da tesouraria.';
      doneMsg.style.background = '#fff8e8';
      doneMsg.style.borderColor = '#f0dca8';
      doneMsg.style.color = '#6b4f1a';
    } else if (p.status === 'rejeitado') {
      doneMsg.hidden = false;
      doneMsg.textContent = p.nota_tesoureiro
        ? ('Pagamento rejeitado: ' + p.nota_tesoureiro)
        : 'Pagamento rejeitado. Envie o comprovante de novo ou fale com a tesouraria.';
      doneMsg.style.background = '#fff0e8';
      doneMsg.style.borderColor = '#f0c9a8';
      doneMsg.style.color = '#8a3f1a';
    } else {
      doneMsg.hidden = true;
      doneMsg.style.background = '';
      doneMsg.style.borderColor = '';
      doneMsg.style.color = '';
    }

    resultCard.hidden = false;
  }

  async function syncCartao(extra) {
    if (!lastBusca) return null;
    return window.COR_API.sincronizarInfinitepayCamisa(Object.assign({
      busca: lastBusca,
      orderNsu: current && current.id,
      transactionNsu: null,
      slug: null
    }, extra || {}));
  }

  async function refreshConsulta() {
    if (!lastBusca) return;
    const data = await window.COR_API.consultarPagamentoCamisa(lastBusca);
    if (data && data.ok) fillResult(data);
    return data;
  }

  async function openCheckoutCartao() {
    if (!current || !lastBusca) return;
    showErr(payErr, '');
    const prev = cardBtn.textContent;
    cardBtn.disabled = true;
    cardBtn.textContent = 'Abrindo…';
    try {
      const data = await window.COR_API.criarCheckoutInfinitepayCamisa({
        pagamentoId: current.id,
        busca: lastBusca
      });
      if (!data || !data.url) {
        showErr(payErr, mapErro('CHECKOUT_FALHOU'));
        return;
      }
      location.href = data.url;
    } catch (err) {
      console.error(err);
      showErr(payErr, mapErro(err.code || err.message));
    } finally {
      cardBtn.disabled = false;
      cardBtn.textContent = prev;
    }
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
      return;
    }

    const ret = readReturnParams();
    if (ret.busca.length >= 4) {
      document.getElementById('busca').value = ret.busca;
      lastBusca = ret.busca.trim();
      await consultar(true);
      if (ret.pago && cartaoIntegrado) {
        selectPayTab('cartao');
        try {
          await syncCartao({
            orderNsu: ret.orderNsu || (current && current.id),
            transactionNsu: ret.transactionNsu || null,
            slug: ret.slug || null
          });
          await refreshConsulta();
        } catch (err) {
          console.error(err);
        }
      }
      clearReturnParams();
    }
  }

  async function consultar(silent) {
    if (!silent) showErr(searchErr, '');
    const busca = document.getElementById('busca').value.trim();
    if (busca.length < 4) {
      if (!silent) showErr(searchErr, 'Informe telefone ou protocolo.');
      return;
    }
    const btn = document.getElementById('buscarBtn');
    if (!silent) {
      btn.disabled = true;
      btn.textContent = 'Consultando…';
    }
    try {
      const data = await window.COR_API.consultarPagamentoCamisa(busca);
      if (!data || !data.ok) {
        if (!silent) {
          showErr(searchErr, mapErro(data && data.erro));
          resultCard.hidden = true;
        }
        return;
      }
      lastBusca = busca;
      fillResult(data);
    } catch (err) {
      console.error(err);
      if (!silent) showErr(searchErr, err.code === 'RATE_LIMITED' ? mapErro('RATE_LIMITED') : mapErro());
    } finally {
      if (!silent) {
        btn.disabled = false;
        btn.textContent = 'Consultar';
      }
    }
  }

  document.getElementById('buscarBtn').addEventListener('click', () => consultar(false));
  document.getElementById('busca').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      consultar(false);
    }
  });

  if (tabCartao) tabCartao.addEventListener('click', () => selectPayTab('cartao'));
  if (tabPix) tabPix.addEventListener('click', () => selectPayTab('pix'));

  if (cardBtn) cardBtn.addEventListener('click', openCheckoutCartao);

  if (cardSyncBtn) {
    cardSyncBtn.addEventListener('click', async () => {
      cardSyncBtn.disabled = true;
      cardSyncBtn.textContent = 'Verificando…';
      try {
        await syncCartao();
        await refreshConsulta();
      } catch (err) {
        console.error(err);
        showErr(payErr, 'Ainda não confirmado. Aguarde e tente de novo.');
      } finally {
        cardSyncBtn.disabled = false;
        cardSyncBtn.textContent = 'Atualizar status do cartão';
      }
    });
  }

  document.getElementById('copyPixBtn').addEventListener('click', async () => {
    const t = document.getElementById('pixCopia').value;
    try {
      await navigator.clipboard.writeText(t);
      document.getElementById('copyPixBtn').textContent = 'Copiado!';
      setTimeout(() => { document.getElementById('copyPixBtn').textContent = 'Copiar código PIX'; }, 1600);
    } catch (_) {
      showErr(uploadErr, 'Não foi possível copiar. Tente escanear o QR Code.');
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
      const up = await window.COR_API.uploadComprovante(file, 'camisa');
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
      document.getElementById('proofDetails').open = false;
      await refreshConsulta();
    } catch (err) {
      console.error(err);
      showErr(uploadErr, err.message || 'Falha ao enviar comprovante.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar';
    }
  });

  init();
})();
