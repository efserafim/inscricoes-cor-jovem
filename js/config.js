
window.COR_CONFIG = {
  supabaseUrl: 'https://bpsznzsgalubbltvcdrh.supabase.co',
  supabaseKey: 'sb_publishable_VWI7ct07ZZN0J-Y9s9D9dQ_XzXNlxkY',
  table: 'inscricoes_cor_jovem',
  decuriasTable: 'decurias_cor_jovem',
  servosTable: 'servos_cor_jovem',
  servosBucket: 'fotos-servos',
  comprovantesBucket: 'comprovantes-camisas',
  maxInscricoes: 70,

  event: {
    name: 'XVI C.O.R Jovem',
    parish: 'Paróquia Santo Antônio — Bacaxá · Arquidiocese de Niterói',
    dates: '12 e 13 de setembro',
    ageMin: 15,
    ageMax: 24
  }
};

window.COR_AUTH = {
  STORAGE_KEY: 'cor_auth_session_v1',

  getSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },

  saveSession(data) {
    if (!data || !data.access_token) {
      localStorage.removeItem(this.STORAGE_KEY);
      return;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || (Date.now() + (data.expires_in || 3600) * 1000),
      user: data.user || null
    }));
  },

  clearSession() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  isLoggedIn() {
    const s = this.getSession();
    return !!(s && s.access_token);
  },

  userEmail() {
    const s = this.getSession();
    return (s && s.user && s.user.email) || '';
  },

  userDisplayName() {
    const s = this.getSession();
    const u = s && s.user;
    if (!u) return '';
    const meta = u.user_metadata || {};
    return String(meta.display_name || meta.full_name || meta.name || '').trim() || u.email || '';
  },

  mustChangePassword() {
    const s = this.getSession();
    const meta = (s && s.user && s.user.user_metadata) || {};
    return meta.must_change_password === true || meta.must_change_password === 'true';
  },

  isTesoureiro() {
    const s = this.getSession();
    const meta = (s && s.user && s.user.user_metadata) || {};
    return String(meta.role || '').toLowerCase() === 'tesoureiro';
  },

  async updatePassword(newPassword, extraMeta) {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Sessão expirada. Faça login de novo.');
    const c = window.COR_CONFIG;
    const body = { password: String(newPassword || '') };
    if (extraMeta && typeof extraMeta === 'object') body.data = extraMeta;
    const res = await fetch(this.authUrl('/user'), {
      method: 'PUT',
      headers: {
        apikey: c.supabaseKey,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error_description || data.msg || data.error || 'Não foi possível alterar a senha';
      throw new Error(msg);
    }
    const s = this.getSession() || {};
    this.saveSession({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      user: data || s.user
    });
    return data;
  },

  async getAccessToken() {
    const s = this.getSession();
    if (!s || !s.access_token) return null;

    if (s.expires_at && Date.now() > s.expires_at - 60000) {
      const ok = await this.refresh();
      if (!ok) return null;
      return (this.getSession() || {}).access_token || null;
    }
    return s.access_token;
  },

  authUrl(path) {
    return window.COR_CONFIG.supabaseUrl + '/auth/v1' + path;
  },

  async login(email, password) {
    const c = window.COR_CONFIG;
    const res = await fetch(this.authUrl('/token?grant_type=password'), {
      method: 'POST',
      headers: {
        apikey: c.supabaseKey,
        'Content-Type': 'application/json'

      },
      body: JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || '')
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error_description || data.msg || data.error || 'Falha no login';
      throw new Error(msg);
    }
    this.saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      user: data.user
    });
    return data.user;
  },

  async refresh() {
    const s = this.getSession();
    if (!s || !s.refresh_token) {
      this.clearSession();
      return false;
    }
    const c = window.COR_CONFIG;
    try {
      const res = await fetch(this.authUrl('/token?grant_type=refresh_token'), {
        method: 'POST',
        headers: {
          apikey: c.supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.clearSession();
        return false;
      }
      this.saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token || s.refresh_token,
        expires_in: data.expires_in,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        user: data.user || s.user
      });
      return true;
    } catch (_) {
      this.clearSession();
      return false;
    }
  },

  async logout() {
    const token = (this.getSession() || {}).access_token;
    const c = window.COR_CONFIG;
    if (token) {
      try {
        await fetch(this.authUrl('/logout'), {
          method: 'POST',
          headers: {
            apikey: c.supabaseKey,
            Authorization: 'Bearer ' + token
          }
        });
      } catch (_) {  }
    }
    this.clearSession();
  },

  async ensureSession() {
    if (!this.isLoggedIn()) return false;
    const token = await this.getAccessToken();
    return !!token;
  }
};

window.COR_API = {
  newId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const n = (Math.random() * 16) | 0;
      const v = ch === 'x' ? n : (n & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  async headers(extra, opts) {
    const c = window.COR_CONFIG;
    const staff = opts && opts.staff;
    let token = c.supabaseKey;
    if (staff) {
      const t = await window.COR_AUTH.getAccessToken();
      if (!t) throw new Error('Sessão expirada. Faça login de novo.');
      token = t;
    }
    return Object.assign({
      apikey: c.supabaseKey,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }, extra || {});
  },

  url(pathQuery) {
    const c = window.COR_CONFIG;
    return c.supabaseUrl + '/rest/v1/' + c.table + (pathQuery || '');
  },

  decuriasUrl(pathQuery) {
    const c = window.COR_CONFIG;
    return c.supabaseUrl + '/rest/v1/' + c.decuriasTable + (pathQuery || '');
  },

  servosUrl(pathQuery) {
    const c = window.COR_CONFIG;
    return c.supabaseUrl + '/rest/v1/' + c.servosTable + (pathQuery || '');
  },

  rpcUrl(fn) {
    return window.COR_CONFIG.supabaseUrl + '/rest/v1/rpc/' + fn;
  },

  storageUrl(path) {
    const c = window.COR_CONFIG;
    return c.supabaseUrl + '/storage/v1/object/' + c.servosBucket + '/' + path;
  },

  async list() {
    const res = await fetch(this.url('?select=*&order=created_at.desc'), {
      headers: await this.headers(null, { staff: true })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async countActive() {
    const res = await fetch(this.rpcUrl('count_inscricoes_ativas'), {
      method: 'POST',
      headers: await this.headers(),
      body: '{}'
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return typeof data === 'number' ? data : parseInt(data, 10) || 0;
  },

  async insert(row) {
    const payload = Object.assign({}, row);
    if (!payload.id) payload.id = this.newId();
    const res = await fetch(this.url(), {
      method: 'POST',

      headers: await this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      if (/VAGAS_ESGOTADAS/i.test(text)) {
        const err = new Error('VAGAS_ESGOTADAS');
        err.code = 'VAGAS_ESGOTADAS';
        throw err;
      }
      throw new Error(text);
    }
    return [{ id: payload.id }];
  },

  async update(id, patch) {
    const res = await fetch(this.url('?id=eq.' + encodeURIComponent(id)), {
      method: 'PATCH',
      headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async remove(id) {
    const res = await fetch(this.url('?id=eq.' + encodeURIComponent(id)), {
      method: 'DELETE',
      headers: await this.headers({ Prefer: 'return=minimal' }, { staff: true })
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async findByWhatsapp(whatsapp) {
    const digits = String(whatsapp || '').replace(/\D/g, '');
    if (digits.length < 10) return [];
    const res = await fetch(this.rpcUrl('existe_inscricao_whatsapp'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ p_digits: digits })
    });
    if (!res.ok) {
      const t = await res.text();
      if (/RATE_LIMITED/i.test(t)) {
        const err = new Error('RATE_LIMITED');
        err.code = 'RATE_LIMITED';
        throw err;
      }
      return [];
    }
    const exists = await res.json();
    return exists === true ? [{ status: 'ativa' }] : [];
  },

  async listDecurias() {
    const res = await fetch(this.decuriasUrl('?select=*&order=nome.asc'), {
      headers: await this.headers(null, { staff: true })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createDecuria(row) {
    const res = await fetch(this.decuriasUrl(), {
      method: 'POST',
      headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateDecuria(id, patch) {
    const res = await fetch(this.decuriasUrl('?id=eq.' + encodeURIComponent(id)), {
      method: 'PATCH',
      headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async removeDecuria(id) {
    await fetch(this.url('?decuria_id=eq.' + encodeURIComponent(id)), {
      method: 'PATCH',
      headers: await this.headers({ Prefer: 'return=minimal' }, { staff: true }),
      body: JSON.stringify({ decuria_id: null })
    });
    const res = await fetch(this.decuriasUrl('?id=eq.' + encodeURIComponent(id)), {
      method: 'DELETE',
      headers: await this.headers({ Prefer: 'return=minimal' }, { staff: true })
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async listServos() {
    const res = await fetch(this.servosUrl('?select=*&order=created_at.desc'), {
      headers: await this.headers(null, { staff: true })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async insertServo(row) {
    const payload = Object.assign({}, row);
    if (!payload.id) payload.id = this.newId();
    const res = await fetch(this.servosUrl(), {
      method: 'POST',
      headers: await this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return [{ id: payload.id }];
  },

  async updateServo(id, patch) {
    const res = await fetch(this.servosUrl('?id=eq.' + encodeURIComponent(id)), {
      method: 'PATCH',
      headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async removeServo(id) {
    const res = await fetch(this.servosUrl('?id=eq.' + encodeURIComponent(id)), {
      method: 'DELETE',
      headers: await this.headers({ Prefer: 'return=minimal' }, { staff: true })
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async findServoByTelefone(telefone) {
    const digits = String(telefone || '').replace(/\D/g, '');
    if (digits.length < 10) return [];
    const res = await fetch(this.rpcUrl('existe_servo_telefone'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ p_digits: digits })
    });
    if (!res.ok) {
      const t = await res.text();
      if (/RATE_LIMITED/i.test(t)) {
        const err = new Error('RATE_LIMITED');
        err.code = 'RATE_LIMITED';
        throw err;
      }
      return [];
    }
    const exists = await res.json();
    return exists === true ? [{ status: 'ativa' }] : [];
  },

  async uploadServoFoto(file) {
    if (!file) throw new Error('Arquivo inválido');
    const maxBytes = 2.5 * 1024 * 1024;
    const okType = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type || '');
    if (!okType) throw new Error('Envie apenas imagem (JPG, PNG ou WEBP).');
    if (file.size > maxBytes) throw new Error('Imagem muito grande (máx. 2,5 MB).');
    const c = window.COR_CONFIG;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    if (!/^(jpe?g|png|webp|gif)$/.test(ext)) throw new Error('Extensão de imagem inválida.');
    const path = 'servos/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const res = await fetch(this.storageUrl(path), {
      method: 'POST',
      headers: {
        apikey: c.supabaseKey,
        Authorization: 'Bearer ' + c.supabaseKey,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false'
      },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    return c.supabaseUrl + '/storage/v1/object/public/' + c.servosBucket + '/' + path;
  },

  comprovantesStorageUrl(path) {
    const c = window.COR_CONFIG;
    return c.supabaseUrl + '/storage/v1/object/' + c.comprovantesBucket + '/' + path;
  },

  async getPixPublico() {
    const res = await fetch(this.rpcUrl('get_pix_publico'), {
      method: 'POST',
      headers: await this.headers(),
      body: '{}'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async consultarPagamentoCamisa(busca) {
    const res = await fetch(this.rpcUrl('consultar_pagamento_camisa'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ p_busca: String(busca || '').trim() })
    });
    if (!res.ok) {
      const t = await res.text();
      if (/RATE_LIMITED/i.test(t)) {
        const err = new Error('RATE_LIMITED');
        err.code = 'RATE_LIMITED';
        throw err;
      }
      throw new Error(t);
    }
    return res.json();
  },

  async enviarComprovanteCamisa(payload) {
    const res = await fetch(this.rpcUrl('enviar_comprovante_camisa'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        p_pagamento_id: payload.pagamentoId,
        p_busca: payload.busca,
        p_valor_informado: payload.valorInformado,
        p_comprovante_url: payload.comprovanteUrl,
        p_comprovante_path: payload.comprovantePath
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async consultarPagamentoContribuicao(busca) {
    const res = await fetch(this.rpcUrl('consultar_pagamento_contribuicao'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ p_busca: String(busca || '').trim() })
    });
    if (!res.ok) {
      const t = await res.text();
      if (/RATE_LIMITED/i.test(t)) {
        const err = new Error('RATE_LIMITED');
        err.code = 'RATE_LIMITED';
        throw err;
      }
      throw new Error(t);
    }
    return res.json();
  },

  async enviarComprovanteContribuicao(payload) {
    const res = await fetch(this.rpcUrl('enviar_comprovante_contribuicao'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        p_pagamento_id: payload.pagamentoId,
        p_busca: payload.busca,
        p_valor_informado: payload.valorInformado,
        p_comprovante_url: payload.comprovanteUrl,
        p_comprovante_path: payload.comprovantePath
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async uploadComprovante(file, folder) {
    if (!file) throw new Error('Arquivo inválido');
    const maxBytes = 4 * 1024 * 1024;
    const okType = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/i.test(file.type || '');
    if (!okType) throw new Error('Envie imagem (JPG, PNG, WEBP) ou PDF.');
    if (file.size > maxBytes) throw new Error('Arquivo muito grande (máx. 4 MB).');
    const c = window.COR_CONFIG;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    if (!/^(jpe?g|png|webp|gif|pdf)$/.test(ext)) throw new Error('Extensão inválida.');
    const path = (folder || 'camisas') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const res = await fetch(this.comprovantesStorageUrl(path), {
      method: 'POST',
      headers: {
        apikey: c.supabaseKey,
        Authorization: 'Bearer ' + c.supabaseKey,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false'
      },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    const url = c.supabaseUrl + '/storage/v1/object/public/' + c.comprovantesBucket + '/' + path;
    return { url: url, path: path };
  },

  async getPixConfigStaff() {
    const c = window.COR_CONFIG;
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/config_camisa_pix?select=*&order=created_at.asc&limit=1',
      { headers: await this.headers(null, { staff: true }) }
    );
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  },

  async savePixConfigStaff(id, patch) {
    const c = window.COR_CONFIG;
    const body = Object.assign({}, patch, { updated_at: new Date().toISOString() });
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/config_camisa_pix?id=eq.' + encodeURIComponent(id),
      {
        method: 'PATCH',
        headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
        body: JSON.stringify(body)
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async listPagamentosCamisas() {
    const c = window.COR_CONFIG;
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/pagamentos_camisas?select=*&order=enviado_em.desc.nullslast,created_at.desc',
      { headers: await this.headers(null, { staff: true }) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async listPagamentosContribuicao() {
    const c = window.COR_CONFIG;
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/pagamentos_contribuicao?select=*&order=enviado_em.desc.nullslast,created_at.desc',
      { headers: await this.headers(null, { staff: true }) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updatePagamentoCamisa(id, patch) {
    const c = window.COR_CONFIG;
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/pagamentos_camisas?id=eq.' + encodeURIComponent(id),
      {
        method: 'PATCH',
        headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
        body: JSON.stringify(patch)
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async function updatePagamentoContribuicao(id, patch) {
    const c = window.COR_CONFIG;
    const res = await fetch(
      c.supabaseUrl + '/rest/v1/pagamentos_contribuicao?id=eq.' + encodeURIComponent(id),
      {
        method: 'PATCH',
        headers: await this.headers({ Prefer: 'return=representation' }, { staff: true }),
        body: JSON.stringify(patch)
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async registrarPagamentoDinheiro(busca, tipo) {
    const res = await fetch(this.rpcUrl('registrar_pagamento_dinheiro'), {
      method: 'POST',
      headers: await this.headers(null, { staff: true }),
      body: JSON.stringify({
        p_busca: String(busca || '').trim(),
        p_tipo: tipo === 'contribuicao' ? 'contribuicao' : 'camisa'
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};
