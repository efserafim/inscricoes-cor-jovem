

  const EXPORT_FIELDS = [
    { id:'nome', label:'Nome', group:'essencial', get:r => r.nome },
    { id:'status', label:'Status', group:'essencial', get:r => STATUS_LABEL[r.status||'nova'] },
    { id:'idade', label:'Idade', group:'essencial', get:r => r.idade },
    { id:'nascimento', label:'Nascimento', group:'completo', get:r => fmtDay(r.nascimento) },
    { id:'whatsapp', label:'WhatsApp / Tel.', group:'contato', get:r => r.whatsapp || r.telefone },
    { id:'decuria', label:'Decúria / Equipe', group:'essencial', get:r => r.equipe || decuriaName(r.decuria_id) || '—' },
    { id:'cidade', label:'Cidade', group:'contato', get:r => r.cidade },
    { id:'uf', label:'UF', group:'contato', get:r => r.uf },
    { id:'bairro', label:'Bairro', group:'completo', get:r => r.bairro },
    { id:'endereco', label:'Endereço', group:'completo', get:r => r.endereco },
    { id:'camisa', label:'Quer camisa', group:'camisas', get:r => simNao(r.camisa) },
    { id:'tamanho', label:'Tamanho', group:'camisas', get:r => r.tamanho_camisa || '—' },
    { id:'responsavel', label:'Responsável', group:'completo', get:r => r.responsavel_nome },
    { id:'resp_tel', label:'Tel. responsável', group:'completo', get:r => r.responsavel_telefone },
    { id:'urgencia', label:'Urgência', group:'completo', get:r => [r.urgencia_nome, r.urgencia_parentesco, r.urgencia_telefone].filter(Boolean).join(' — ') },
    { id:'saude', label:'Saúde', group:'completo', get:r => {
      const bits = [];
      if(r.comorbidade === 'sim') bits.push('Comorbidade: '+(r.comorbidade_qual||'sim'));
      if(r.medicamento === 'sim') bits.push('Med: '+(r.medicamento_qual||'sim'));
      if(r.alergia === 'sim') bits.push('Alergia: '+(r.alergia_qual||'sim'));
      return bits.join(' · ') || '—';
    }},
    { id:'sacramentos', label:'Sacramentos', group:'completo', get:r => Array.isArray(r.sacramentos) ? r.sacramentos.join('; ') : (r.sacramentos||'') },
    { id:'expectativa', label:'Expectativa', group:'completo', get:r => r.expectativa },
    { id:'observacoes', label:'Obs. equipe', group:'completo', get:r => r.observacoes },
    { id:'quando', label:'Inscrição em', group:'completo', get:r => fmtDate(r.created_at) },
    { id:'protocolo', label:'Protocolo', group:'completo', get:r => protocol(r.id) }
  ];

  const PRESETS = {
    essencial: ['nome','status','idade','whatsapp','decuria'],
    camisas: ['nome','tamanho','idade','whatsapp','decuria','status'],
    contato: ['nome','whatsapp','cidade','uf','decuria','status'],
    completo: EXPORT_FIELDS.map(f => f.id),
    nenhum: []
  };

  let exportSource = 'inscricoes';

  function currentExportList(){
    if(exportSource === 'camisas') return shirtList();
    if(exportSource === 'servos') return filteredServos();
    return filtered();
  }

  function filterSummaryText(){
    const bits = [];
    if(exportSource === 'camisas'){
      bits.push(shirtTipo() === 'servos' ? 'Camisas · Servos' : 'Camisas · Cursistas');
      const st = document.getElementById('shirtStatus').value;
      const size = document.getElementById('shirtSize').value;
      if(st) bits.push(STATUS_LABEL[st] || st);
      if(size === '__empty__') bits.push('Sem tamanho');
      else if(size) bits.push('Tam. '+size);
      const q = (document.getElementById('shirtSearch').value || '').trim();
      if(q) bits.push('Busca: '+q);
    }else if(exportSource === 'servos'){
      bits.push('Servos');
      if(servoStatusFilter) bits.push(STATUS_LABEL[servoStatusFilter] || servoStatusFilter);
      const camisa = document.getElementById('servoFilterCamisa').value;
      const eq = document.getElementById('servoFilterEquipe').value;
      if(camisa === 'sim') bits.push('Quer camisa');
      if(camisa === 'nao') bits.push('Sem camisa');
      if(eq) bits.push(eq);
      const q = (document.getElementById('servoSearch').value || '').trim();
      if(q) bits.push('Busca: '+q);
    }else{
      bits.push('Cursistas');
      if(statusFilter) bits.push(STATUS_LABEL[statusFilter] || statusFilter);
      if(quickFilter === 'menor') bits.push('Menores');
      if(quickFilter === 'saude') bits.push('Alerta saúde');
      const fCamisa = document.getElementById('filterCamisa').value;
      const fDecuria = document.getElementById('filterDecuria').value;
      if(fCamisa === 'sim') bits.push('Quer camisa');
      if(fCamisa === 'nao') bits.push('Sem camisa');
      if(fDecuria === '__none__') bits.push('Sem Decúria');
      else if(fDecuria) bits.push(decuriaName(fDecuria));
      const q = document.getElementById('search').value.trim();
      if(q) bits.push('Busca: '+q);
    }
    return bits.join(' · ');
  }

  function renderExportCols(selected){
    const box = document.getElementById('exportCols');
    const set = new Set(selected);
    box.innerHTML = EXPORT_FIELDS.map(f =>
      '<label><input type="checkbox" data-col="'+f.id+'"'+(set.has(f.id)?' checked':'')+'> '+esc(f.label)+'</label>'
    ).join('');
  }

  function selectedExportFields(){
    const ids = [...document.querySelectorAll('#exportCols input[data-col]:checked')].map(i => i.getAttribute('data-col'));
    return EXPORT_FIELDS.filter(f => ids.includes(f.id));
  }

  let exportScrollY = 0;

  function openExportModal(source){
    if(source) exportSource = source;
    else {
      const view = ((document.querySelector('.tab.active') || {}).dataset || {}).view;
      if(view === 'camisas') exportSource = 'camisas';
      else if(view === 'servos') exportSource = 'servos';
      else exportSource = 'inscricoes';
    }
    const list = currentExportList();
    const title = document.getElementById('exportTitle');
    const sub = document.getElementById('exportSubtitle');
    if(exportSource === 'camisas'){
      title.value = shirtTipo() === 'servos'
        ? 'XVI C.O.R Jovem — Camisas dos servos'
        : 'XVI C.O.R Jovem — Camisas dos cursistas';
    }else if(exportSource === 'servos'){
      title.value = 'XVI C.O.R Jovem — Servos';
    }else{
      title.value = 'XVI C.O.R Jovem — Cursistas';
    }
    sub.value = filterSummaryText();
    document.getElementById('exportHint').textContent =
      list.length + ' registro(s) no filtro atual · personalize colunas e baixe Excel ou PDF';
    const preset = exportSource === 'camisas' ? 'camisas' : 'essencial';
    renderExportCols(PRESETS[preset] || PRESETS.essencial);
    const presetSelect = document.getElementById('exportPresetSelect');
    if(presetSelect) presetSelect.value = preset;
    document.getElementById('exportCheckCol').checked = exportSource === 'camisas';

    exportScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    document.body.classList.add('export-lock');
    document.body.style.top = '-' + exportScrollY + 'px';

    document.getElementById('exportOverlay').classList.add('open');
    document.getElementById('exportOverlay').setAttribute('aria-hidden','false');
  }

  function closeExportModal(){
    document.getElementById('exportOverlay').classList.remove('open');
    document.getElementById('exportOverlay').setAttribute('aria-hidden','true');
    document.body.classList.remove('export-lock');
    document.body.style.top = '';
    window.scrollTo(0, exportScrollY);
  }

  function shirtSizeSummary(list){
    const sizes = ['PP','P','M','G','GG','XG','XXG'];
    const counts = {};
    sizes.forEach(s => counts[s] = 0);
    let sem = 0, quer = 0;
    list.forEach(r=>{
      if(r.camisa === 'sim'){
        quer++;
        if(r.tamanho_camisa && counts[r.tamanho_camisa] != null) counts[r.tamanho_camisa]++;
        else sem++;
      }
    });
    return { sizes, counts, sem, quer };
  }

  function xmlEsc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function downloadExcel(list, fields, meta){
    const withNum = document.getElementById('exportNumbering').checked;
    const headers = [];
    if(withNum) headers.push('#');
    fields.forEach(f => headers.push(f.label));

    const rowsXml = list.map((r, i) => {
      let cells = '';
      if(withNum) cells += '<Cell ss:StyleID="cell"><Data ss:Type="Number">'+(i+1)+'</Data></Cell>';
      fields.forEach(f => {
        const v = f.get(r);
        const num = typeof v === 'number' && !isNaN(v);
        cells += '<Cell ss:StyleID="cell"><Data ss:Type="'+(num?'Number':'String')+'">'+xmlEsc(v == null ? '' : v)+'</Data></Cell>';
      });
      return '<Row>'+cells+'</Row>';
    }).join('');

    let summaryRows = '';
    if(document.getElementById('exportSummary').checked){
      const sum = shirtSizeSummary(list);
      summaryRows =
        '<Row><Cell ss:StyleID="title"><Data ss:Type="String">Resumo</Data></Cell></Row>' +
        '<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Total na lista</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">'+list.length+'</Data></Cell></Row>' +
        (sum.quer ? (
          '<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Quer camisa</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">'+sum.quer+'</Data></Cell></Row>' +
          sum.sizes.map(s => '<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Tamanho '+s+'</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">'+sum.counts[s]+'</Data></Cell></Row>').join('') +
          (sum.sem ? '<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Sem tamanho</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">'+sum.sem+'</Data></Cell></Row>' : '')
        ) : '') +
        '<Row></Row>';
    }

    const colCount = headers.length;
    const colXml = Array.from({length: colCount}, (_,i) =>
      '<Column ss:AutoFitWidth="1" ss:Width="'+(i===0 && withNum ? 36 : (i===1 || (!withNum && i===0) ? 160 : 90))+'" />'
    ).join('');

    const headerCells = headers.map(h =>
      '<Cell ss:StyleID="header"><Data ss:Type="String">'+xmlEsc(h)+'</Data></Cell>'
    ).join('');

    const xml =
      '<?xml version="1.0"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      ' xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      ' xmlns:html="http://www.w3.org/TR/REC-html40">\n' +
      '<Styles>\n' +
      '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#2A3238"/><Alignment ss:Vertical="Center"/></Style>\n' +
      '<Style ss:ID="sub"><Font ss:Size="11" ss:Color="#4A5560"/><Alignment ss:WrapText="1"/></Style>\n' +
      '<Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#2A3238" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/></Style>\n' +
      '<Style ss:ID="cell"><Font ss:Size="11" ss:Color="#2A3238"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C5CED6"/></Borders></Style>\n' +
      '<Style ss:ID="accent"><Font ss:Bold="1" ss:Color="#C45C26" ss:Size="11"/></Style>\n' +
      '</Styles>\n' +
      '<Worksheet ss:Name="Lista">\n' +
      '<Table>\n' + colXml +
      '<Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="'+(Math.max(0,colCount-1))+'"><Data ss:Type="String">'+xmlEsc(meta.title)+'</Data></Cell></Row>\n' +
      '<Row><Cell ss:StyleID="sub" ss:MergeAcross="'+(Math.max(0,colCount-1))+'"><Data ss:Type="String">'+xmlEsc(meta.subtitle)+' · '+list.length+' registro(s) · '+xmlEsc(meta.when)+'</Data></Cell></Row>\n' +
      '<Row></Row>\n' +
      summaryRows +
      '<Row ss:Height="22">'+headerCells+'</Row>\n' +
      rowsXml +
      '</Table>\n</Worksheet>\n</Workbook>';

    const blob = new Blob([xml], { type:'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (meta.filename || 'lista-cor-jovem') + '.xls';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function buildPrintHtml(list, fields, meta, forPdf){
    const withNum = document.getElementById('exportNumbering').checked;
    const withCheck = document.getElementById('exportCheckCol').checked;
    const withSummary = document.getElementById('exportSummary').checked;
    const sum = shirtSizeSummary(list);
    const showShirtSum = withSummary && (exportSource === 'camisas' || sum.quer > 0);

    const headCells =
      (withNum ? '<th>#</th>' : '') +
      fields.map(f => '<th>'+esc(f.label)+'</th>').join('') +
      (withCheck ? '<th style="width:28px">✓</th>' : '');

    const body = list.map((r,i) => {
      const cells = fields.map(f => {
        const v = f.get(r);
        return '<td>'+esc(v == null || v === '' ? '—' : v)+'</td>';
      }).join('');
      return '<tr>' +
        (withNum ? '<td class="n">'+(i+1)+'</td>' : '') +
        cells +
        (withCheck ? '<td class="chk"></td>' : '') +
      '</tr>';
    }).join('');

    const chips = showShirtSum
      ? '<div class="chips">' +
          '<span class="chip">Total: <b>'+list.length+'</b></span>' +
          (exportSource !== 'camisas' ? '<span class="chip">Camisas: <b>'+sum.quer+'</b></span>' : '') +
          sum.sizes.filter(s => sum.counts[s]).map(s => '<span class="chip">'+s+': <b>'+sum.counts[s]+'</b></span>').join('') +
          (sum.sem ? '<span class="chip">Sem tam.: <b>'+sum.sem+'</b></span>' : '') +
        '</div>'
      : (withSummary ? '<div class="chips"><span class="chip">Total: <b>'+list.length+'</b></span></div>' : '');

    return (
      '<div class="doc'+(forPdf?' pdf-root':'')+'">' +
        '<div class="banner">' +
          '<div class="eyebrow">Paróquia Santo Antônio — Bacaxá</div>' +
          '<h1>'+esc(meta.title)+'</h1>' +
          '<p class="sub">'+esc(meta.subtitle || '')+'</p>' +
          '<p class="meta">'+esc(meta.when)+' · <strong>'+list.length+'</strong> registro(s)</p>' +
        '</div>' +
        chips +
        '<table class="doc-table"><thead><tr>'+headCells+'</tr></thead><tbody>'+body+'</tbody></table>' +
        '<p class="foot">XVI C.O.R Jovem · Verso l\'alto · Documento gerado pelo painel da equipe</p>' +
      '</div>'
    );
  }

  function printStyles(){
    return (
      '<style>' +
      '.doc{font-family:"Source Sans 3",Segoe UI,sans-serif;color:#2a3238;}' +
      '.banner{border-bottom:3px solid #c45c26;padding:0 0 14px;margin:0 0 14px;}' +
      '.eyebrow{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c45c26;margin:0 0 6px;}' +
      'h1{font-family:Outfit,Impact,sans-serif;font-size:26px;margin:0;letter-spacing:.04em;text-transform:uppercase;line-height:1.05;}' +
      '.sub{margin:8px 0 0;color:#4a5560;font-size:13px;font-weight:600;}' +
      '.meta{margin:6px 0 0;font-size:12px;color:#4a5560;}' +
      '.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;}' +
      '.chip{background:rgba(196,92,38,.12);color:#c45c26;font-size:11px;font-weight:700;padding:5px 9px;border-radius:3px;}' +
      '.chip b{color:#2a3238;}' +
      '.doc-table{width:100%;border-collapse:collapse;font-size:11.5px;}' +
      '.doc-table th{text-align:left;background:#2a3238;color:#fff;padding:8px 7px;font-size:10px;letter-spacing:.05em;text-transform:uppercase;}' +
      '.doc-table td{padding:7px;border-bottom:1px solid #d5dde4;vertical-align:top;}' +
      '.doc-table tr:nth-child(even) td{background:#f4f8fb;}' +
      '.doc-table .n{color:#8a949c;width:28px;}' +
      '.doc-table .chk{width:22px;border:1px solid #9aa5ad;background:#fff;}' +
      '.foot{margin:16px 0 0;font-size:10.5px;color:#8a949c;border-top:1px solid #d5dde4;padding-top:10px;}' +
      '</style>'
    );
  }

  function renderExportSheet(list, fields, meta){
    const sheet = document.getElementById('printSheet');
    sheet.innerHTML = printStyles() + buildPrintHtml(list, fields, meta, false);
  }

  function loadScript(src){
    return new Promise((resolve, reject)=>{
      if([...document.scripts].some(s => s.src === src || s.getAttribute('data-src') === src)){
        resolve(); return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.setAttribute('data-src', src);
      s.onload = ()=> resolve();
      s.onerror = ()=> reject(new Error('Falha ao carregar '+src));
      document.head.appendChild(s);
    });
  }

  async function downloadPdf(list, fields, meta){
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;background:#fff;padding:28px;';
    wrap.innerHTML = printStyles() + buildPrintHtml(list, fields, meta, true);
    document.body.appendChild(wrap);

    try{
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
      const opt = {
        margin: [10, 10, 12, 10],
        filename: (meta.filename || 'lista-cor-jovem') + '.pdf',
        image: { type:'jpeg', quality:0.98 },
        html2canvas: { scale:2, useCORS:true, letterRendering:true },
        jsPDF: { unit:'mm', format:'a4', orientation: fields.length > 6 ? 'landscape' : 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };
      await window.html2pdf().set(opt).from(wrap.querySelector('.doc')).save();
      toast('PDF baixado');
    }catch(err){
      console.error(err);
      renderExportSheet(list, fields, meta);
      toast('PDF online indisponível — use Imprimir → Salvar como PDF');
      setTimeout(()=> window.print(), 250);
    }finally{
      wrap.remove();
    }
  }

  function runExport(mode){
    const list = currentExportList();
    if(!list.length){ toast('Nada para exportar neste filtro'); return; }
    const fields = selectedExportFields();
    if(!fields.length){ toast('Marque ao menos uma coluna'); return; }

    const meta = {
      title: (document.getElementById('exportTitle').value || 'XVI C.O.R Jovem').trim(),
      subtitle: (document.getElementById('exportSubtitle').value || '').trim(),
      when: new Date().toLocaleString('pt-BR'),
      filename: (exportSource === 'camisas'
        ? (shirtTipo() === 'servos' ? 'camisas-servos' : 'camisas-cursistas')
        : 'inscricoes') + '-cor-jovem'
    };

    if(mode === 'excel'){
      downloadExcel(list, fields, meta);
      toast('Excel baixado');
      return;
    }
    if(mode === 'pdf'){
      downloadPdf(list, fields, meta);
      return;
    }
    renderExportSheet(list, fields, meta);
    closeExportModal();
    setTimeout(()=> window.print(), 150);
  }
