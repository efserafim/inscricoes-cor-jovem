window.COR_PIX = {
  onlyDigits(s) {
    return String(s || '').replace(/\D/g, '');
  },

  sanitizeText(s, max) {
    const t = String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    return t.slice(0, max || 25) || 'RECEBEDOR';
  },

  normalizeKey(chave, tipo) {
    const raw = String(chave || '').trim();
    const t = String(tipo || '').toLowerCase();
    if (t === 'cpf' || t === 'cnpj' || t === 'telefone') return this.onlyDigits(raw);
    if (t === 'email') return raw.toLowerCase();
    return raw;
  },

  tlv(id, value) {
    const v = String(value);
    const len = String(v.length).padStart(2, '0');
    return id + len + v;
  },

  crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
        else crc = (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  },

  /**
   * Gera payload PIX estático (BR Code) copia-e-cola.
   * opts: { chave, tipoChave, nome, cidade, valor, txid }
   */
  buildPayload(opts) {
    const chave = this.normalizeKey(opts.chave, opts.tipoChave);
    const nome = this.sanitizeText(opts.nome, 25);
    const cidade = this.sanitizeText(opts.cidade, 15);
    const txid = this.sanitizeText(opts.txid || '***', 25).replace(/\s/g, '') || '***';
    const valor = opts.valor != null && opts.valor !== ''
      ? Number(opts.valor).toFixed(2)
      : null;

    const gui = this.tlv('00', 'BR.GOV.BCB.PIX') + this.tlv('01', chave);
    const merchantAccount = this.tlv('26', gui);

    let payload = '';
    payload += this.tlv('00', '01');
    payload += this.tlv('01', '11');
    payload += merchantAccount;
    payload += this.tlv('52', '0000');
    payload += this.tlv('53', '986');
    if (valor) payload += this.tlv('54', valor);
    payload += this.tlv('58', 'BR');
    payload += this.tlv('59', nome);
    payload += this.tlv('60', cidade);
    payload += this.tlv('62', this.tlv('05', txid));
    payload += '6304';
    payload += this.crc16(payload);
    return payload;
  },

  formatBRL(n) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  parseMoney(str) {
    let s = String(str || '').trim();
    if (!s) return null;
    s = s.replace(/[R$\s]/gi, '');
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') >= 0) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
};
