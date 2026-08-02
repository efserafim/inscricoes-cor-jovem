import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'efserafimflu@gmail.com';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAdmin(user) {
  if (!user) return false;
  const role = String(user.user_metadata?.role || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return role === 'admin' || email === ADMIN_EMAIL;
}

function pickUser(u) {
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email || '',
    display_name: meta.display_name || meta.full_name || meta.name || '',
    role: meta.role || '',
    must_change_password: meta.must_change_password === true || meta.must_change_password === 'true',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'METODO_INVALIDO' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'CONFIG_INCOMPLETA' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'NAO_AUTORIZADO' }, 401);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  const user = userData?.user;
  if (userErr || !user || !isAdmin(user)) {
    return json({ error: 'NAO_AUTORIZADO' }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON_INVALIDO' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.action === 'list') {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      return json({ error: error.message || 'LISTAR_FALHOU' }, 500);
    }
    const users = (data?.users || [])
      .map(pickUser)
      .sort((a, b) => String(a.email).localeCompare(String(b.email), 'pt-BR'));
    return json({ users });
  }

  if (body.action === 'reset_password') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email) return json({ error: 'EMAIL_OBRIGATORIO' }, 400);
    if (password.length < 6) return json({ error: 'SENHA_CURTA' }, 400);

    const { data, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      return json({ error: listErr.message || 'BUSCAR_FALHOU' }, 500);
    }

    const target = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === email);
    if (!target) {
      return json({ error: 'USUARIO_NAO_ENCONTRADO' }, 404);
    }

    const meta = { ...(target.user_metadata || {}), must_change_password: true };
    const { error: updErr } = await admin.auth.admin.updateUserById(target.id, {
      password,
      user_metadata: meta,
    });
    if (updErr) {
      return json({ error: updErr.message || 'RESET_FALHOU' }, 500);
    }

    return json({ ok: true, email: target.email });
  }

  return json({ error: 'ACAO_INVALIDA' }, 400);
});
