import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeHandle(raw: string) {
  return String(raw || '')
    .trim()
    .replace(/^\$+/, '')
    .replace(/-/g, '')
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, erro: 'METODO_INVALIDO' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, erro: 'CONFIG_INCOMPLETA' }, 500);
  }

  let body: { pagamentoId?: string; busca?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, erro: 'JSON_INVALIDO' }, 400);
  }

  const pagamentoId = String(body.pagamentoId || '').trim();
  const busca = String(body.busca || '').trim();
  if (!pagamentoId || busca.length < 4) {
    return json({ ok: false, erro: 'DADOS_INVALIDOS' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: check, error: checkErr } = await admin.rpc('consultar_pagamento_camisa', {
    p_busca: busca,
  });
  if (checkErr) {
    console.error(checkErr);
    return json({ ok: false, erro: 'CONSULTA_FALHOU' }, 500);
  }
  if (!check?.ok) {
    return json({ ok: false, erro: check?.erro || 'NAO_ENCONTRADO' }, 400);
  }

  const pay = check.pagamento as Record<string, unknown>;
  if (String(pay.id) !== pagamentoId) {
    return json({ ok: false, erro: 'ID_INVALIDO' }, 400);
  }
  if (pay.status === 'confirmado') {
    return json({ ok: false, erro: 'JA_CONFIRMADO' }, 400);
  }

  const pix = (check.pix || {}) as Record<string, unknown>;
  if (!pix.cartao_integrado) {
    return json({ ok: false, erro: 'CARTAO_INDISPONIVEL' }, 400);
  }

  const existingUrl = String(pay.gateway_checkout_url || '').trim();
  if (existingUrl) {
    return json({ ok: true, url: existingUrl, reused: true });
  }

  const { data: cfgRows, error: cfgErr } = await admin
    .from('config_camisa_pix')
    .select('infinitepay_handle,infinitepay_habilitado,valor_camisa')
    .order('created_at', { ascending: true })
    .limit(1);
  if (cfgErr || !cfgRows?.[0]) {
    console.error(cfgErr);
    return json({ ok: false, erro: 'CONFIG_NAO_ENCONTRADA' }, 500);
  }

  const cfg = cfgRows[0];
  const handle = normalizeHandle(cfg.infinitepay_handle);
  if (!cfg.infinitepay_habilitado || !handle) {
    return json({ ok: false, erro: 'CARTAO_INDISPONIVEL' }, 400);
  }

  const valor = Number(pay.valor_esperado ?? cfg.valor_camisa);
  if (!Number.isFinite(valor) || valor <= 0) {
    return json({ ok: false, erro: 'VALOR_INVALIDO' }, 400);
  }

  const siteUrl = (Deno.env.get('COR_SITE_URL') || 'https://corjovem.geucaristica.com.br').replace(/\/$/, '');
  const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook`;
  const redirectUrl = `${siteUrl}/pagamento-camisa.html?busca=${encodeURIComponent(busca)}&pago=1`;
  const protocolo = String(pay.protocolo || '').slice(0, 8);
  const nome = String(pay.nome || '').slice(0, 40);

  const payload = {
    handle,
    order_nsu: pagamentoId,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    items: [{
      quantity: 1,
      price: Math.round(valor * 100),
      description: `Camisa COR Jovem · ${protocolo}${nome ? ' · ' + nome : ''}`.slice(0, 120),
    }],
  };

  let ipData: Record<string, unknown>;
  try {
    const ipRes = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    ipData = await ipRes.json().catch(() => ({}));
    if (!ipRes.ok || !ipData.url) {
      console.error('InfinitePay links', ipRes.status, ipData);
      return json({ ok: false, erro: 'CHECKOUT_FALHOU', detalhe: ipData }, 502);
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, erro: 'CHECKOUT_FALHOU' }, 502);
  }

  const checkoutUrl = String(ipData.url);
  const invoiceSlug = ipData.invoice_slug || ipData.slug || null;

  const { error: updErr } = await admin
    .from('pagamentos_camisas')
    .update({
      gateway_checkout_url: checkoutUrl,
      gateway_reference_id: pagamentoId,
      gateway_checkout_id: invoiceSlug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pagamentoId);

  if (updErr) {
    console.error(updErr);
    return json({ ok: true, url: checkoutUrl, aviso: 'URL_GERADA_SEM_SALVAR' });
  }

  return json({ ok: true, url: checkoutUrl });
});
