
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 2400);
  }

  function hasHealth(r){
    return r.comorbidade === 'sim' || r.medicamento === 'sim' || r.alergia === 'sim';
  }

  function decuriaById(id){
    return decurias.find(d => d.id === id) || null;
  }

  function decuriaName(id){
    const d = decuriaById(id);
    return d ? d.nome : '';
  }

  function fillDecuriaSelects(){
    const filter = document.getElementById('filterDecuria');
    const drawerSel = document.getElementById('dDecuria');
    const curFilter = filter.value;
    const curDrawer = drawerSel.value;

    filter.innerHTML = '<option value="">Decúria: todas</option><option value="__none__">Sem Decúria</option>' +
      decurias.map(d => '<option value="'+esc(d.id)+'">'+esc(d.nome)+' ('+d.idade_min+'-'+d.idade_max+')</option>').join('');
    drawerSel.innerHTML = '<option value="">Sem Decúria</option>' +
      decurias.map(d => '<option value="'+esc(d.id)+'">'+esc(d.nome)+'</option>').join('');

    filter.value = [...filter.options].some(o=>o.value===curFilter) ? curFilter : '';
    drawerSel.value = [...drawerSel.options].some(o=>o.value===curDrawer) ? curDrawer : '';

    const dl = document.getElementById('decuristaSuggestions');
    dl.innerHTML = rows
      .filter(r => r.status !== 'cancelada')
      .map(r => '<option value="'+esc(r.nome)+'"></option>')
      .join('');
  }

  async function load(silent){
    if(!window.COR_API){
      document.getElementById('statusText').textContent = 'config.js não carregou. Abra pela pasta do projeto.';
      return;
    }
    if(!silent){
      document.getElementById('statusText').textContent = 'Carregando…';
      app.classList.add('loading');
    }
    try{
      const [ins, dec, serv] = await Promise.all([
        window.COR_API.list(),
        window.COR_API.listDecurias().catch(()=>[]),
        window.COR_API.listServos().catch(()=>[])
      ]);
      rows = ins;
      servoRows = Array.isArray(serv) ? serv : [];
      decurias = Array.isArray(dec) ? dec : [];
      fillDecuriaSelects();
      fillServoEquipeFilter();
      render();
      renderDecurias();
      renderShirts();
      renderServos();
      if(drawerMode === 'inscricao' && selectedId && !editing){
        const cur = rows.find(r => r.id === selectedId);
        if(cur) fillDrawer(cur);
      }
      if(drawerMode === 'servo' && selectedServoId){
        const cur = servoRows.find(r => r.id === selectedServoId);
        if(cur) fillServoDrawer(cur);
      }
      if(!silent){
        document.getElementById('statusText').textContent =
          rows.length + ' cursista(s) carregado(s)';
      }
    }catch(err){
      console.error(err);
      const st = document.getElementById('statusText');
      const msg = String(err && err.message || '');
      if(/Sessão expirada|401|JWT|permission/i.test(msg)){
        st.textContent = 'Sessão inválida. Faça login de novo.';
        if(window.COR_AUTH) await window.COR_AUTH.logout();
        setTimeout(()=> location.reload(), 800);
      }else{
        st.textContent = 'Erro ao carregar. Rode sql/setup.sql (ou sql/auth-rls.sql) no Supabase.';
      }
      tbody.innerHTML = '';
      empty.hidden = false;
    }finally{
      app.classList.remove('loading');
    }
  }

  function fmtDate(iso){
    if(!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
  }
  function fmtDay(iso){
    if(!iso) return '—';
    const [y,m,d] = String(iso).slice(0,10).split('-');
    return d + '/' + m + '/' + y;
  }
  function val(v){
    if(v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
    return v;
  }
  function simNao(v){
    if(v === 'sim') return 'Sim';
    if(v === 'nao') return 'Não';
    return v || '—';
  }
  function digits(phone){ return String(phone||'').replace(/\D/g,''); }
  function waLink(phone){
    let d = digits(phone);
    if(!d) return null;
    if(d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d;
  }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function protocol(id){
    return String(id || '').slice(0,8).toUpperCase();
  }
