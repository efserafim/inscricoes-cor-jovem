
  function item(label, value, full){
    const v = val(value);
    return '<div class="item'+(full?' full':'')+'"><span class="l">'+esc(label)+'</span><div class="d'+(v?'':' empty')+'">'+(v ? esc(Array.isArray(v)?v.join(', '):v) : 'Não informado')+'</div></div>';
  }

  function itemPhone(label, phone, full){
    const v = val(phone);
    const link = v ? waLink(v) : null;
    const btn = link
      ? '<a class="wa-mini" href="'+esc(link)+'" target="_blank" rel="noopener">WhatsApp</a>'
      : '';
    return '<div class="item'+(full?' full':'')+'"><span class="l">'+esc(label)+'</span>' +
      '<div class="d phone-row'+(v?'':' empty')+'">' +
        '<span>'+(v ? esc(v) : 'Não informado')+'</span>' +
        btn +
      '</div></div>';
  }

  function field(name, label, value, opts){
    opts = opts || {};
    const full = opts.full ? ' full' : '';
    const type = opts.type || 'text';
    if(type === 'select'){
      const options = (opts.options || []).map(o=>{
        const v = typeof o === 'string' ? o : o.value;
        const t = typeof o === 'string' ? o : o.label;
        const sel = String(value||'') === String(v) ? ' selected' : '';
        return '<option value="'+esc(v)+'"'+sel+'>'+esc(t)+'</option>';
      }).join('');
      return '<div class="edit-field'+full+'"><label for="ef-'+name+'">'+esc(label)+'</label><select id="ef-'+name+'" name="'+name+'">'+options+'</select></div>';
    }
    if(type === 'textarea'){
      return '<div class="edit-field'+full+'"><label for="ef-'+name+'">'+esc(label)+'</label><textarea id="ef-'+name+'" name="'+name+'">'+esc(value||'')+'</textarea></div>';
    }
    return '<div class="edit-field'+full+'"><label for="ef-'+name+'">'+esc(label)+'</label><input id="ef-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(value||'')+'"'+(opts.min!=null?' min="'+opts.min+'"':'')+(opts.max!=null?' max="'+opts.max+'"':'')+'></div>';
  }

  function yesNoSelect(name, label, value, full){
    return field(name, label, value, {
      type:'select', full:!!full,
      options:[
        { value:'', label:'—' },
        { value:'sim', label:'Sim' },
        { value:'nao', label:'Não' }
      ]
    });
  }

  function calcAge(dateStr){
    if(!dateStr) return null;
    const birth = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if(m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function setToolbarEditing(on){
    editing = !!on;
    document.getElementById('editBtn').hidden = on;
    document.getElementById('deleteBtn').hidden = on;
    document.getElementById('printBtn').hidden = on;
    document.getElementById('saveNotesBtn').hidden = on;
    document.getElementById('dStatus').disabled = on;
    document.getElementById('dDecuria').disabled = on || drawerMode === 'servo';
    document.getElementById('dDecuria').hidden = drawerMode === 'servo';
    document.getElementById('dEquipe').hidden = drawerMode !== 'servo';
    document.getElementById('dEquipe').disabled = on || drawerMode !== 'servo';
    document.getElementById('dNotes').disabled = on;
  }

  function fillEquipeSelect(current){
    const sel = document.getElementById('dEquipe');
    if(!sel) return;
    const cur = current || '';
    sel.innerHTML =
      '<option value="">Sem equipe</option>' +
      SERVO_EQUIPES.filter(e => e !== 'Outro').map(e =>
        '<option value="'+esc(e)+'">'+esc(e)+'</option>'
      ).join('') +
      (cur && !SERVO_EQUIPES.includes(cur)
        ? '<option value="'+esc(cur)+'">'+esc(cur)+'</option>'
        : '') +
      '<option value="__outro__">Outra…</option>';
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
  }
  function g(name){
    const el = document.getElementById('ef-'+name);
    return el ? el.value.trim() : '';
  }
  function closeDetail(){
    if(editing && !confirm('Descartar alterações e fechar?')) return;
    setToolbarEditing(false);
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    selectedId = null;
    selectedServoId = null;
    drawerMode = 'inscricao';
    document.getElementById('dDecuria').hidden = false;
    document.getElementById('dEquipe').hidden = true;
    render();
    renderServos();
  }
