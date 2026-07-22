/* Config compartilhada — XVI C.O.R Jovem */
window.COR_CONFIG = {
  supabaseUrl: 'https://bpsznzsgalubbltvcdrh.supabase.co',
  supabaseKey: 'sb_publishable_VWI7ct07ZZN0J-Y9s9D9dQ_XzXNlxkY',
  table: 'inscricoes_cor_jovem',
  decuriasTable: 'decurias_cor_jovem',
  servosTable: 'servos_cor_jovem',
  servosBucket: 'fotos-servos',
  maxInscricoes: 70,
  /* Metadados do evento (referência / uso futuro nas páginas) */
  event: {
    name: 'XVI C.O.R Jovem',
    parish: 'Paróquia Santo Antônio — Bacaxá · Arquidiocese de Niterói',
    dates: '12 e 13 de setembro',
    ageMin: 15,
    ageMax: 24
  }
};

/* Sessão Supabase Auth (painel) */
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

  async getAccessToken() {
    const s = this.getSession();
    if (!s || !s.access_token) return null;
    /* renova ~60s antes de expirar */
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
      body: JSON.stringify({ email: String(email || '').trim(), password })
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
      } catch (_) { /* ignore */ }
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

  /** @param {object} [extra] @param {{ staff?: boolean }} [opts] staff=true usa JWT do painel */
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

  /** Conta inscrições ativas via RPC (público, sem expor fichas). */
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
      /* return=representation exige SELECT; com RLS só-insert usamos minimal */
      headers: await this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
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
    const res = await fetch(this.rpcUrl('buscar_inscricao_whatsapp'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ p_digits: digits })
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
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
    const res = await fetch(this.rpcUrl('buscar_servo_telefone'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ p_digits: digits })
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  },

  async uploadServoFoto(file) {
    const c = window.COR_CONFIG;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
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
  }
};
