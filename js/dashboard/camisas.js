
  function shirtTipo(){
    const el = document.getElementById('shirtTipo');
    return (el && el.value) || 'cursistas';
  }

  function shirtList(){
    const q = (document.getElementById('shirtSearch').value || '').trim().toLowerCase();
    const st = document.getElementById('shirtStatus').value;
    const size = document.getElementById('shirtSize').value;
    const sort = document.getElementById('shirtSort').value;
    const order = ['PP','P','M','G','GG','XG','XXG'];
    const tipo = shirtTipo();
    const isServo = tipo === 'servos';

    let list = (isServo ? servoRows : rows).filter(r =>
      r.camisa === 'sim' && r.status !== 'cancelada'
    );
    if(st) list = list.filter(r => (r.status||'nova') === st);
    if(size === '__empty__') list = list.filter(r => !r.tamanho_camisa);
    else if(size) list = list.filter(r => r.tamanho_camisa === size);
    if(q){
      list = list.filter(r => {
        const phone = isServo ? r.telefone : r.whatsapp;
        const grupo = isServo ? r.equipe : decuriaName(r.decuria_id);
        return String(r.nome||'').toLowerCase().includes(q) ||
          String(phone||'').toLowerCase().includes(q) ||
          String(grupo||'').toLowerCase().includes(q);
      });
    }

    if(sort === 'tamanho'){
      list.sort((a,b)=>{
        const ia = order.indexOf(a.tamanho_camisa); const ib = order.indexOf(b.tamanho_camisa);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a.nome).localeCompare(String(b.nome),'pt-BR');
      });
    }else if(sort === 'idade'){
      list.sort((a,b)=> (a.idade||0)-(b.idade||0) || String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    }else if(sort === 'grupo' || sort === 'decuria'){
      list.sort((a,b)=>{
        const ga = isServo ? (a.equipe||'') : decuriaName(a.decuria_id);
        const gb = isServo ? (b.equipe||'') : decuriaName(b.decuria_id);
        return ga.localeCompare(gb,'pt-BR') || String(a.nome).localeCompare(String(b.nome),'pt-BR');
      });
    }else{
      list.sort((a,b)=> String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
    }
    return list;
  }

  function renderShirts(){
    const tbody = document.getElementById('shirtTbody');
    const emptyEl = document.getElementById('shirtEmpty');
    const summary = document.getElementById('shirtSummary');
    if(!tbody) return;

    const isServo = shirtTipo() === 'servos';
    const phoneHead = document.getElementById('shirtColPhone');
    const groupHead = document.getElementById('shirtColGroup');
    if(phoneHead) phoneHead.textContent = isServo ? 'Telefone' : 'WhatsApp';
    if(groupHead) groupHead.textContent = isServo ? 'Equipe' : 'Decúria';

    const list = shirtList();
    const sizes = ['PP','P','M','G','GG','XG','XXG'];
    const counts = {};
    sizes.forEach(s => counts[s] = 0);
    let sem = 0;
    list.forEach(r=>{
      if(r.tamanho_camisa && counts[r.tamanho_camisa] != null) counts[r.tamanho_camisa]++;
      else sem++;
    });

    const tipoLabel = isServo ? 'Servos' : 'Cursistas';
    summary.innerHTML =
      '<span class="shirt-chip">'+tipoLabel+' · Total: <strong>'+list.length+'</strong></span>' +
      sizes.map(s => '<span class="shirt-chip">'+s+': <strong>'+counts[s]+'</strong></span>').join('') +
      (sem ? '<span class="shirt-chip">Sem tamanho: <strong>'+sem+'</strong></span>' : '');

    tbody.innerHTML = '';
    emptyEl.hidden = list.length > 0;
    list.forEach((r, idx)=>{
      const rawPhone = isServo ? r.telefone : r.whatsapp;
      const wa = waLink(rawPhone);
      const phoneCell = wa
        ? '<a class="wa-mini" href="'+esc(wa)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(rawPhone||'WhatsApp')+'</a>'
        : esc(rawPhone||'—');
      const grupo = isServo ? (r.equipe||'—') : (decuriaName(r.decuria_id)||'—');
      const phoneLabel = isServo ? 'Telefone' : 'WhatsApp';
      const groupLabel = isServo ? 'Equipe' : 'Decúria';
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML =
        '<td data-label="#" class="muted">'+(idx+1)+'</td>' +
        '<td data-label="Nome"><strong>'+esc(r.nome)+'</strong></td>' +
        '<td data-label="Tamanho"><span class="tag tag-shirt">'+esc(r.tamanho_camisa||'—')+'</span></td>' +
        '<td data-label="Idade">'+esc(r.idade)+'</td>' +
        '<td data-label="'+phoneLabel+'">'+phoneCell+'</td>' +
        '<td data-label="'+groupLabel+'">'+esc(grupo)+'</td>' +
        '<td data-label="Status"><span class="pill pill-'+esc(r.status||'nova')+'">'+esc(STATUS_LABEL[r.status||'nova'])+'</span></td>';
      tr.addEventListener('click', ()=>{
        if(isServo) openServoDetail(r);
        else openDetail(r);
      });
      tbody.appendChild(tr);
    });
    document.getElementById('shirtStatusText').textContent =
      list.length + ' pedido(s) de camisa · ' + tipoLabel.toLowerCase();
  }
