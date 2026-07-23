
  const SERVO_EQUIPES = [
    'Coordenação',
    'Base',
    'Capela',
    'Cozinha',
    'Limpeza',
    'Secretaria',
    'Tesouraria',
    'Decúria',
    'Música',
    'Equipe de sala',
    'Reitor',
    'Bem-estar',
    'Ligação',
    'Sineteiro',
    'Cronometrista',
    'Externa',
    'Outro'
  ];

  function fillServoEquipeFilter(){
    const sel = document.getElementById('servoFilterEquipe');
    if(!sel) return;
    const cur = sel.value;
    const equipes = [...new Set(servoRows.map(r => r.equipe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    sel.innerHTML = '<option value="">Equipe: todas</option>' +
      equipes.map(e => '<option value="'+esc(e)+'">'+esc(e)+'</option>').join('');
    sel.value = [...sel.options].some(o=>o.value===cur) ? cur : '';
  }

  function filteredServos(){
    const q = (document.getElementById('servoSearch').value || '').trim().toLowerCase();
    const eq = document.getElementById('servoFilterEquipe').value;
    const camisa = document.getElementById('servoFilterCamisa').value;
    const sort = document.getElementById('servoFilterSort').value;
    let list = servoRows.slice();
    if(servoStatusFilter) list = list.filter(r => (r.status || 'nova') === servoStatusFilter);
    if(eq) list = list.filter(r => r.equipe === eq);
    if(camisa) list = list.filter(r => r.camisa === camisa);
    if(q){
      list = list.filter(r => {
        const blob = [r.nome, r.telefone, r.equipe, r.ano_cor_jovem, r.endereco].join(' ').toLowerCase();
        return blob.includes(q);
      });
    }
    if(sort === 'nome') list.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR'));
    else if(sort === 'equipe') list.sort((a,b)=>(a.equipe||'').localeCompare(b.equipe||'','pt-BR') || (a.nome||'').localeCompare(b.nome||'','pt-BR'));
    else list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    return list;
  }

  function renderServos(){
    const tbody = document.getElementById('servoTbody');
    const empty = document.getElementById('servoEmpty');
    if(!tbody) return;

    const total = servoRows.length;
    const by = s => servoRows.filter(r => (r.status||'nova') === s).length;
    document.getElementById('servoStatTotal').textContent = total;
    document.getElementById('servoStatNova').textContent = by('nova');
    document.getElementById('servoStatConf').textContent = by('confirmada');
    document.getElementById('servoStatEspera').textContent = by('lista_espera');
    document.getElementById('servoStatCanc').textContent = by('cancelada');

    const list = filteredServos();
    tbody.innerHTML = list.map(r => {
      const st = r.status || 'nova';
      const camisa = r.camisa === 'sim' ? (r.tamanho_camisa || 'Sim') : (r.camisa === 'nao' ? 'Não' : '—');
      const tel = waLink(r.telefone);
      const telCell = tel
        ? '<a class="wa-mini" href="'+esc(tel)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(r.telefone||'WhatsApp')+'</a>'
        : esc(r.telefone||'—');
      return '<tr data-servo-id="'+esc(r.id)+'"'+(r.id===selectedServoId?' class="active"':'')+'>' +
        '<td data-label="Status"><span class="pill pill-'+esc(st)+'">'+esc(STATUS_LABEL[st]||st)+'</span></td>' +
        '<td data-label="Nome"><strong>'+esc(r.nome||'—')+'</strong></td>' +
        '<td data-label="Idade">'+esc(r.idade != null ? r.idade : '—')+'</td>' +
        '<td data-label="Equipe">'+esc(r.equipe || 'A definir')+'</td>' +
        '<td data-label="Telefone">'+telCell+'</td>' +
        '<td data-label="Camisa">'+esc(camisa)+'</td>' +
        '<td data-label="Ano C.O.R">'+esc(r.ano_cor_jovem||'—')+'</td>' +
        '<td data-label="Quando">'+esc(fmtDate(r.created_at))+'</td>' +
      '</tr>';
    }).join('');

    empty.hidden = list.length > 0;
    const quer = list.filter(r => r.camisa === 'sim').length;
    document.getElementById('servoStatusText').textContent =
      list.length + ' de ' + total + ' servo(s)' +
      (quer ? ' · ' + quer + ' quer(em) camisa' : '');
  }

  function fillServoDrawer(r){
    document.getElementById('dNome').textContent = r.nome || '—';
    document.getElementById('dMeta').textContent =
      'Servo · Protocolo ' + protocol(r.id) +
      (r.idade ? ' · ' + r.idade + ' anos' : '') +
      (r.equipe ? ' · ' + r.equipe : '') +
      ' · ' + fmtDate(r.created_at);

    const wa = waLink(r.telefone);
    const waEl = document.getElementById('dWa');
    if(wa){ waEl.href = wa; waEl.hidden = false; }
    else waEl.hidden = true;

    document.getElementById('dStatus').value = r.status || 'nova';
    document.getElementById('dNotes').value = r.observacoes || '';
    fillEquipeSelect(r.equipe);

    if(editing) fillServoDrawerEdit(r);
    else fillServoDrawerView(r);
  }

  function fillServoDrawerView(r){
    const foto = r.foto_url
      ? '<div class="sec"><h3>Foto</h3><p><a href="'+esc(r.foto_url)+'" target="_blank" rel="noopener"><img src="'+esc(r.foto_url)+'" alt="Foto" style="max-width:100%;border-radius:6px;border:1px solid var(--mist)"></a></p></div>'
      : '';

    document.getElementById('drawerBody').innerHTML =
      '<div class="sec"><h3>Dados</h3><div class="grid">' +
        item('Nome completo', r.nome, true) +
        item('Nascimento', fmtDay(r.nascimento)) +
        item('Idade', r.idade) +
        item('Telefone', r.telefone) +
        item('Endereço', r.endereco, true) +
      '</div></div>' +
      '<div class="sec"><h3>Serviço</h3><div class="grid">' +
        item('Equipe', r.equipe || 'A definir pela organização') +
        item('Ano COR Jovem', r.ano_cor_jovem) +
        item('Quer camisa', simNao(r.camisa)) +
        item('Tamanho', r.tamanho_camisa) +
      '</div></div>' +
      '<div class="sec"><h3>Fé</h3><div class="grid">' +
        item('O que mais marcou', r.marco_cor, true) +
        item('Oração e sacramentos', r.oracao_sacramentos, true) +
        item('Sacramentos', r.sacramentos, true) +
      '</div></div>' +
      foto;
  }

  function fillServoDrawerEdit(r){
    const nasc = r.nascimento ? String(r.nascimento).slice(0,10) : '';
    const sac = Array.isArray(r.sacramentos) ? r.sacramentos.join(', ') : (r.sacramentos || '');
    const equipes = SERVO_EQUIPES.slice();
    if(r.equipe && !equipes.includes(r.equipe)) equipes.splice(equipes.length - 1, 0, r.equipe);

    document.getElementById('drawerBody').innerHTML =
      '<div class="sec"><h3>Editar servo</h3><div class="grid">' +
        field('nome','Nome completo', r.nome, { full:true }) +
        field('nascimento','Nascimento', nasc, { type:'date' }) +
        field('idade','Idade', r.idade, { type:'number', min:12, max:99 }) +
        field('telefone','Telefone', r.telefone) +
        field('endereco','Endereço', r.endereco, { type:'textarea', full:true }) +
      '</div></div>' +
      '<div class="sec"><h3>Serviço</h3><div class="grid">' +
        field('equipe','Equipe', r.equipe, {
          type:'select',
          options:[{value:'',label:'—'}].concat(equipes.map(e=>({value:e,label:e})))
        }) +
        field('ano_cor_jovem','Ano COR Jovem', r.ano_cor_jovem) +
        yesNoSelect('camisa','Quer camisa', r.camisa) +
        field('tamanho_camisa','Tamanho', r.tamanho_camisa, {
          type:'select',
          options:[{value:'',label:'—'},'PP','P','M','G','GG','XG','XXG']
        }) +
      '</div></div>' +
      '<div class="sec"><h3>Fé</h3><div class="grid">' +
        field('marco_cor','O que mais marcou', r.marco_cor, { type:'textarea', full:true }) +
        field('oracao_sacramentos','Oração e sacramentos', r.oracao_sacramentos, { type:'textarea', full:true }) +
        field('sacramentos','Sacramentos (separados por vírgula)', sac, { full:true }) +
      '</div></div>' +
      '<div class="edit-actions">' +
        '<button class="btn btn-primary" type="button" id="saveEditBtn">Salvar alterações</button>' +
        '<button class="btn btn-ghost" type="button" id="cancelEditBtn">Cancelar</button>' +
      '</div>';

    const nascEl = document.getElementById('ef-nascimento');
    const idadeEl = document.getElementById('ef-idade');
    if(nascEl && idadeEl){
      nascEl.addEventListener('change', ()=>{
        const age = calcAge(nascEl.value);
        if(age != null) idadeEl.value = age;
      });
    }

    document.getElementById('saveEditBtn').addEventListener('click', saveServoEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', ()=>{
      const cur = servoRows.find(x => x.id === selectedServoId);
      setToolbarEditing(false);
      if(cur) fillServoDrawer(cur);
    });
  }

  async function saveServoEdit(){
    if(!selectedServoId) return;
    const nasc = g('nascimento');
    let idade = parseInt(g('idade'), 10);
    const ageCalc = calcAge(nasc);
    if(ageCalc != null) idade = ageCalc;

    const nome = g('nome');
    const telefone = g('telefone');
    const endereco = g('endereco');
    const equipe = g('equipe');
    const ano_cor_jovem = g('ano_cor_jovem');
    const marco_cor = g('marco_cor');
    const oracao_sacramentos = g('oracao_sacramentos');

    if(!nome || !nasc || !telefone || !endereco || !ano_cor_jovem || !marco_cor || !oracao_sacramentos){
      toast('Preencha os campos obrigatórios');
      return;
    }

    const sacRaw = g('sacramentos');
    const sacramentos = sacRaw
      ? sacRaw.split(',').map(s=>s.trim()).filter(Boolean)
      : [];

    const camisa = g('camisa') || null;
    const patch = {
      nome,
      nascimento: nasc,
      idade: idade || null,
      telefone,
      endereco,
      equipe: equipe || '',
      ano_cor_jovem,
      marco_cor,
      oracao_sacramentos,
      sacramentos,
      camisa,
      tamanho_camisa: camisa === 'sim' ? (g('tamanho_camisa') || null) : null
    };

    const btn = document.getElementById('saveEditBtn');
    if(btn){ btn.disabled = true; btn.textContent = 'Salvando…'; }

    try{
      const updated = await window.COR_API.updateServo(selectedServoId, patch);
      const row = Array.isArray(updated) && updated[0]
        ? updated[0]
        : Object.assign({}, servoRows.find(x=>x.id===selectedServoId), patch);
      const idx = servoRows.findIndex(x => x.id === selectedServoId);
      if(idx >= 0) servoRows[idx] = row;
      fillServoEquipeFilter();
      setToolbarEditing(false);
      fillServoDrawer(row);
      renderServos();
      renderShirts();
      toast('Ficha do servo atualizada');
    }catch(err){
      console.error(err);
      toast('Erro ao salvar alterações do servo');
      if(btn){ btn.disabled = false; btn.textContent = 'Salvar alterações'; }
    }
  }

  function openServoDetail(r){
    drawerMode = 'servo';
    selectedId = null;
    selectedServoId = r.id;
    setToolbarEditing(false);
    fillServoDrawer(r);
    renderServos();
    overlay.classList.add('open');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
  }
