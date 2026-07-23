
  function filtered(){
    const q = document.getElementById('search').value.trim().toLowerCase();
    const fCamisa = document.getElementById('filterCamisa').value;
    const fDecuria = document.getElementById('filterDecuria').value;
    const sort = document.getElementById('filterSort').value;

    let list = rows.slice();

    if(statusFilter) list = list.filter(r => (r.status || 'nova') === statusFilter);
    if(quickFilter === 'menor') list = list.filter(r => r.menor_idade);
    if(quickFilter === 'saude') list = list.filter(hasHealth);
    if(fCamisa) list = list.filter(r => r.camisa === fCamisa);
    if(fDecuria === '__none__') list = list.filter(r => !r.decuria_id);
    else if(fDecuria) list = list.filter(r => r.decuria_id === fDecuria);

    if(q){
      list = list.filter(r=>{
        const blob = [
          r.nome, r.whatsapp, r.cidade, r.bairro, r.endereco, r.uf,
          r.responsavel_nome, r.urgencia_nome, r.como_soube, r.observacoes,
          protocol(r.id), decuriaName(r.decuria_id)
        ].join(' ').toLowerCase();
        return blob.includes(q);
      });
    }

    if(sort === 'nome') list.sort((a,b)=> String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
    else if(sort === 'idade') list.sort((a,b)=> (a.idade||0) - (b.idade||0));
    else list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));

    return list;
  }

  function renderStats(){
    const health = rows.filter(hasHealth).length;
    document.getElementById('statTotal').textContent = rows.length;
    document.getElementById('statNova').textContent = rows.filter(r => (r.status||'nova') === 'nova').length;
    document.getElementById('statConf').textContent = rows.filter(r => r.status === 'confirmada').length;
    document.getElementById('statEspera').textContent = rows.filter(r => r.status === 'lista_espera').length;
    document.getElementById('statMenores').textContent = rows.filter(r => r.menor_idade).length;
    document.getElementById('statSaude').textContent = health;

    document.querySelectorAll('#stats .stat').forEach(el=>{
      const st = el.getAttribute('data-status');
      const fl = el.getAttribute('data-filter');
      let on = false;
      if(st !== null && st !== undefined && !fl){
        on = statusFilter === st && !quickFilter;
      }
      if(fl) on = quickFilter === fl && !statusFilter;
      if(st === '' && !fl) on = !statusFilter && !quickFilter;
      el.classList.toggle('active', on);
    });
  }

  function renderSide(){
    const sizes = ['PP','P','M','G','GG','XG','XXG'];
    const counts = {};
    sizes.forEach(s => counts[s] = 0);
    let totalShirts = 0;
    rows.forEach(r=>{
      if(r.camisa === 'sim' && r.tamanho_camisa && counts[r.tamanho_camisa] != null){
        counts[r.tamanho_camisa]++;
        totalShirts++;
      }
    });
    const max = Math.max(1, ...Object.values(counts));
    document.getElementById('shirtBars').innerHTML = sizes.map(s=>{
      const n = counts[s];
      const pct = Math.round((n / max) * 100);
      return '<div class="bar-row"><span class="lab">'+s+'</span><div class="track"><div class="fill" style="width:'+pct+'%"></div></div><span class="num">'+n+'</span></div>';
    }).join('') + '<p class="muted" style="margin:8px 0 0">'+totalShirts+' camisa(s) de cursistas</p>';

    const allAlerts = rows.filter(hasHealth);
    const alerts = allAlerts.slice(0, 8);
    const hl = document.getElementById('healthList');
    if(!allAlerts.length){
      hl.innerHTML = '<p class="muted" style="margin:0">Nenhum alerta no momento.</p>';
    }else{
      hl.innerHTML =
        '<div class="alert-list-head">' +
          '<span class="count">'+allAlerts.length+' alerta'+(allAlerts.length===1?'':'s')+'</span>' +
          '<button type="button" id="healthSeeAll">Ver na lista</button>' +
        '</div>' +
        '<div class="alert-list" id="healthScroll">' +
          alerts.map(r=>{
            const bits = [];
            if(r.comorbidade === 'sim') bits.push('Comorbidade: ' + (r.comorbidade_qual || '—'));
            if(r.medicamento === 'sim') bits.push('Med: ' + (r.medicamento_qual || '—'));
            if(r.alergia === 'sim') bits.push('Alergia: ' + (r.alergia_qual || '—'));
            return '<div class="alert-item" data-id="'+esc(r.id)+'"><strong>'+esc(r.nome)+'</strong><span class="sub">'+esc(bits.join(' · '))+'</span></div>';
          }).join('') +
          (allAlerts.length > alerts.length
            ? '<p class="muted" style="margin:4px 0 0;font-size:11.5px">+ '+(allAlerts.length - alerts.length)+' na lista completa</p>'
            : '') +
        '</div>';
      hl.querySelectorAll('.alert-item').forEach(el=>{
        el.addEventListener('click', ()=>{
          const r = rows.find(x => x.id === el.getAttribute('data-id'));
          if(r) openDetail(r);
        });
      });
      const seeAll = document.getElementById('healthSeeAll');
      if(seeAll){
        seeAll.addEventListener('click', ()=>{
          statusFilter = '';
          quickFilter = 'saude';
          render();
          document.getElementById('viewInscricoes')?.scrollIntoView({ behavior:'smooth', block:'start' });
        });
      }
    }
  }

  function render(){
    renderStats();
    renderSide();
    const list = filtered();
    tbody.innerHTML = '';
    empty.hidden = list.length > 0;

    list.forEach(r=>{
      const st = r.status || 'nova';
      const wa = waLink(r.whatsapp);
      const waCell = wa
        ? '<a class="wa-mini" href="'+esc(wa)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(r.whatsapp||'WhatsApp')+'</a>'
        : esc(r.whatsapp||'—');
      const tr = document.createElement('tr');
      if(r.id === selectedId) tr.classList.add('active');
      tr.innerHTML =
        '<td data-label="Status"><span class="pill pill-'+esc(st)+'">'+esc(STATUS_LABEL[st]||st)+'</span></td>' +
        '<td data-label="Nome"><strong>'+esc(r.nome)+'</strong>' +
          (r.menor_idade ? '<span class="tag tag-minor">Menor</span>' : '') +
          (hasHealth(r) ? '<span class="tag tag-health">Saúde</span>' : '') +
        '</td>' +
        '<td data-label="Idade">'+esc(r.idade)+'</td>' +
        '<td data-label="Decúria">'+(r.decuria_id
          ? '<span class="tag tag-shirt">'+esc(decuriaName(r.decuria_id))+'</span>'
          : '<span class="muted">—</span>')+'</td>' +
        '<td data-label="WhatsApp">'+waCell+'</td>' +
        '<td data-label="Cidade">'+esc(r.cidade)+' <span class="muted">'+esc(r.uf)+'</span></td>' +
        '<td data-label="Camisa">'+(r.camisa==='sim'
          ? '<span class="tag tag-shirt">'+esc(r.tamanho_camisa||'Sim')+'</span>'
          : '<span class="muted">—</span>')+'</td>' +
        '<td data-label="Quando" class="muted">'+esc(fmtDate(r.created_at))+'</td>';
      tr.addEventListener('click', ()=> openDetail(r));
      tbody.appendChild(tr);
    });

    document.getElementById('statusText').textContent =
      list.length + ' cursista(s) neste filtro · ' + rows.length + ' no total';
    document.getElementById('autoText').textContent = 'Atualiza a cada 45s · só cursistas';
  }
  function fillDrawerView(r){
    document.getElementById('drawerBody').innerHTML =
      '<div class="sec"><h3>Dados do jovem</h3><div class="grid">' +
        item('Nome completo', r.nome, true) +
        item('Nascimento', fmtDay(r.nascimento)) +
        item('Idade', r.idade) +
        item('WhatsApp', r.whatsapp) +
        item('Endereço', r.endereco, true) +
        item('Bairro', r.bairro) +
        item('Cidade / UF', (r.cidade||'') + (r.uf ? ' — ' + r.uf : '')) +
        item('Instagram', r.rede_usuario ? ((r.rede_nome && r.rede_nome !== 'Instagram' ? r.rede_nome+': ' : '') + r.rede_usuario) : null, true) +
      '</div></div>' +

      '<div class="sec"><h3>Responsável</h3><div class="grid">' +
        item('Menor de idade', r.menor_idade ? 'Sim' : 'Não') +
        item('Nome', r.responsavel_nome, true) +
        itemPhone('Telefone do responsável', r.responsavel_telefone, true) +
        item('CPF', r.responsavel_cpf) +
      '</div></div>' +

      '<div class="sec"><h3>Fé e vida na igreja</h3><div class="grid">' +
        item('Pais católicos', simNao(r.pais_catolicos)) +
        item('É católico', simNao(r.eh_catolico)) +
        item('Sacramentos', r.sacramentos, true) +
        item('Movimento / pastoral', r.movimento_pastoral, true) +
        item('Missas dominicais', simNao(r.missas_dominicais)) +
        item('Onde', r.missas_onde) +
      '</div></div>' +

      '<div class="sec"><h3>Saúde</h3><div class="grid">' +
        item('Comorbidade', r.comorbidade==='sim' ? ('Sim — ' + (r.comorbidade_qual||'')) : simNao(r.comorbidade), true) +
        item('Medicamento', r.medicamento==='sim' ? ('Sim — ' + (r.medicamento_qual||'')) : simNao(r.medicamento), true) +
        item('Alergia', r.alergia==='sim' ? ('Sim — ' + (r.alergia_qual||'')) : simNao(r.alergia), true) +
        item('Urgência — nome', r.urgencia_nome) +
        item('Parentesco', r.urgencia_parentesco) +
        itemPhone('Urgência — telefone', r.urgencia_telefone, true) +
      '</div></div>' +

      '<div class="sec"><h3>Sobre o retiro</h3><div class="grid">' +
        item('Decúria', decuriaName(r.decuria_id) || null) +
        item('Como soube', r.como_soube, true) +
        item('Expectativa', r.expectativa, true) +
        item('Quer camisa', simNao(r.camisa)) +
        item('Tamanho', r.tamanho_camisa) +
      '</div></div>';
  }

  function fillDrawerEdit(r){
    const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    const nasc = r.nascimento ? String(r.nascimento).slice(0,10) : '';
    const sac = Array.isArray(r.sacramentos) ? r.sacramentos.join(', ') : (r.sacramentos || '');

    document.getElementById('drawerBody').innerHTML =
      '<div class="sec"><h3>Editar dados</h3><div class="grid">' +
        field('nome','Nome completo', r.nome, { full:true }) +
        field('nascimento','Nascimento', nasc, { type:'date' }) +
        field('idade','Idade', r.idade, { type:'number', min:10, max:30 }) +
        field('whatsapp','WhatsApp', r.whatsapp) +
        field('endereco','Endereço', r.endereco, { full:true }) +
        field('bairro','Bairro', r.bairro) +
        field('cidade','Cidade', r.cidade) +
        field('uf','UF', r.uf, { type:'select', options: ufs.map(u=>({value:u,label:u})) }) +
        field('rede_usuario','Instagram', r.rede_usuario) +
        field('rede_nome','Rede', r.rede_nome || 'Instagram') +
      '</div></div>' +

      '<div class="sec"><h3>Responsável</h3><div class="grid">' +
        field('responsavel_nome','Nome', r.responsavel_nome, { full:true }) +
        field('responsavel_telefone','Telefone', r.responsavel_telefone) +
        field('responsavel_cpf','CPF', r.responsavel_cpf) +
      '</div></div>' +

      '<div class="sec"><h3>Fé e igreja</h3><div class="grid">' +
        yesNoSelect('pais_catolicos','Pais católicos', r.pais_catolicos) +
        yesNoSelect('eh_catolico','É católico', r.eh_catolico) +
        field('sacramentos','Sacramentos (separados por vírgula)', sac, { full:true }) +
        field('movimento_pastoral','Movimento / pastoral', r.movimento_pastoral, { full:true }) +
        yesNoSelect('missas_dominicais','Missas dominicais', r.missas_dominicais) +
        field('missas_onde','Onde', r.missas_onde) +
      '</div></div>' +

      '<div class="sec"><h3>Saúde</h3><div class="grid">' +
        yesNoSelect('comorbidade','Comorbidade', r.comorbidade) +
        field('comorbidade_qual','Qual comorbidade', r.comorbidade_qual, { full:true }) +
        yesNoSelect('medicamento','Medicamento', r.medicamento) +
        field('medicamento_qual','Qual medicamento', r.medicamento_qual, { full:true }) +
        yesNoSelect('alergia','Alergia', r.alergia) +
        field('alergia_qual','Qual alergia', r.alergia_qual, { full:true }) +
        field('urgencia_nome','Urgência — nome', r.urgencia_nome) +
        field('urgencia_parentesco','Parentesco', r.urgencia_parentesco, {
          type:'select',
          options:[
            {value:'',label:'—'},
            'Pai','Mãe','Avô/Avó','Irmão/Irmã','Tio/Tia','Cônjuge','Responsável legal','Outro'
          ]
        }) +
        field('urgencia_telefone','Urgência — telefone', r.urgencia_telefone) +
      '</div></div>' +

      '<div class="sec"><h3>Retiro</h3><div class="grid">' +
        field('como_soube','Como soube', r.como_soube, { full:true }) +
        field('expectativa','Expectativa', r.expectativa, { type:'textarea', full:true }) +
        yesNoSelect('camisa','Quer camisa', r.camisa) +
        field('tamanho_camisa','Tamanho', r.tamanho_camisa, {
          type:'select',
          options:[
            {value:'',label:'—'},
            'PP','P','M','G','GG','XG','XXG'
          ]
        }) +
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

    document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
    document.getElementById('cancelEditBtn').addEventListener('click', ()=>{
      const cur = rows.find(x => x.id === selectedId);
      setToolbarEditing(false);
      if(cur) fillDrawer(cur);
    });
  }
  async function saveEdit(){
    if(!selectedId) return;
    const nasc = g('nascimento');
    let idade = parseInt(g('idade'), 10);
    const ageCalc = calcAge(nasc);
    if(ageCalc != null) idade = ageCalc;

    const nome = g('nome');
    const whatsapp = g('whatsapp');
    const endereco = g('endereco');
    const bairro = g('bairro');
    const cidade = g('cidade');
    const uf = g('uf');
    const urgencia_nome = g('urgencia_nome');
    const urgencia_parentesco = g('urgencia_parentesco');
    const urgencia_telefone = g('urgencia_telefone');

    if(!nome || !nasc || !whatsapp || !endereco || !bairro || !cidade || !uf || !urgencia_nome || !urgencia_telefone){
      toast('Preencha os campos obrigatórios');
      return;
    }

    const sacRaw = g('sacramentos');
    const sacramentos = sacRaw
      ? sacRaw.split(',').map(s=>s.trim()).filter(Boolean)
      : [];

    const patch = {
      nome,
      nascimento: nasc,
      idade: idade || null,
      whatsapp,
      endereco,
      bairro,
      cidade,
      uf,
      rede_usuario: g('rede_usuario') || null,
      rede_nome: g('rede_nome') || null,
      menor_idade: !!(idade && idade < 18),
      responsavel_nome: g('responsavel_nome') || null,
      responsavel_telefone: g('responsavel_telefone') || null,
      responsavel_cpf: g('responsavel_cpf') || null,
      pais_catolicos: g('pais_catolicos') || null,
      eh_catolico: g('eh_catolico') || null,
      sacramentos,
      movimento_pastoral: g('movimento_pastoral') || null,
      missas_dominicais: g('missas_dominicais') || null,
      missas_onde: g('missas_onde') || null,
      comorbidade: g('comorbidade') || null,
      comorbidade_qual: g('comorbidade_qual') || null,
      medicamento: g('medicamento') || null,
      medicamento_qual: g('medicamento_qual') || null,
      alergia: g('alergia') || null,
      alergia_qual: g('alergia_qual') || null,
      urgencia_nome,
      urgencia_parentesco: urgencia_parentesco || null,
      urgencia_telefone,
      como_soube: g('como_soube') || null,
      expectativa: g('expectativa') || null,
      camisa: g('camisa') || null,
      tamanho_camisa: g('tamanho_camisa') || null
    };

    const btn = document.getElementById('saveEditBtn');
    if(btn){ btn.disabled = true; btn.textContent = 'Salvando…'; }

    try{
      const updated = await window.COR_API.update(selectedId, patch);
      const row = Array.isArray(updated) && updated[0] ? updated[0] : Object.assign({}, rows.find(x=>x.id===selectedId), patch);
      const idx = rows.findIndex(x => x.id === selectedId);
      if(idx >= 0) rows[idx] = row;
      setToolbarEditing(false);
      fillDrawer(row);
      render();
      toast('Inscrição atualizada');
    }catch(err){
      console.error(err);
      toast('Erro ao salvar alterações');
      if(btn){ btn.disabled = false; btn.textContent = 'Salvar alterações'; }
    }
  }

  function fillDrawer(r){
    document.getElementById('dNome').textContent = r.nome || '—';
    document.getElementById('dMeta').textContent =
      'Protocolo ' + protocol(r.id) +
      (r.idade ? ' · ' + r.idade + ' anos' : '') +
      (r.menor_idade ? ' · menor' : '') +
      ' · ' + fmtDate(r.created_at);

    const wa = waLink(r.whatsapp);
    const waEl = document.getElementById('dWa');
    if(wa){ waEl.href = wa; waEl.hidden = false; }
    else waEl.hidden = true;

    document.getElementById('dStatus').value = r.status || 'nova';
    document.getElementById('dDecuria').value = r.decuria_id || '';
    document.getElementById('dNotes').value = r.observacoes || '';

    if(editing) fillDrawerEdit(r);
    else fillDrawerView(r);
  }

  function openDetail(r){
    drawerMode = 'inscricao';
    selectedServoId = null;
    selectedId = r.id;
    setToolbarEditing(false);
    document.getElementById('dDecuria').hidden = false;
    document.getElementById('dEquipe').hidden = true;
    fillDrawer(r);
    render();
    overlay.classList.add('open');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
  }
