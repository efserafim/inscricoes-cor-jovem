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

  let body: {
    busca?: string;
    order_nsu?: string;
    transaction_nsu?: string;
    slug?: string;
    tipo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, erro: 'JSON_INVALIDO' }, 400);
  }

  const busca = String(body.busca || '').trim();
  const tipo = String(body.tipo || 'camisa').trim().toLowerCase();
  const isContrib = tipo === 'contribuicao';
  if (busca.length < 4) {
    return json({ ok: false, erro: 'BUSCA_INVALIDA' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rpcName = isContrib ? 'consultar_pagamento_contribuicao' : 'consultar_pagamento_camisa';
  const { data: check, error: checkErr } = await admin.rpc(rpcName, {
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
  if (pay.status === 'confirmado') {
    return json({ ok: true, confirmado: true, ja_confirmado: true });
  }

  const orderNsu = String(body.order_nsu || pay.id || '').trim();
  const transactionNsu = String(
    body.transaction_nsu || pay.gateway_charge_id || '',
  ).trim();
  const slug = String(body.slug || pay.gateway_checkout_id || '').trim();

  if (!orderNsu) {
    return json({ ok: false, erro: 'SEM_PEDIDO' }, 400);
  }

  const { data: cfgRows } = await admin
    .from('config_camisa_pix')
    .select('infinitepay_handle,infinitepay_habilitado')
    .order('created_at', { ascending: true })
    .limit(1);

  const cfg = cfgRows?.[0];
  const handle = normalizeHandle(cfg?.infinitepay_handle || '');
  if (!cfg?.infinitepay_habilitado || !handle) {
    return json({ ok: false, erro: 'CARTAO_INDISPONIVEL' }, 400);
  }

  if (!transactionNsu && !slug) {
    return json({ ok: false, erro: 'SEM_TRANSACAO' }, 400);
  }

  let ipData: Record<string, unknown>;
  try {
    const ipRes = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu || undefined,
        slug: slug || undefined,
      }),
    });
    ipData = await ipRes.json().catch(() => ({}));
    if (!ipRes.ok) {
      console.error('payment_check', ipRes.status, ipData);
      return json({ ok: false, erro: 'CONSULTA_FALHOU' }, 502);
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, erro: 'CONSULTA_FALHOU' }, 502);
  }

  if (!ipData.paid && !ipData.success) {
    return json({ ok: true, confirmado: false, paid: false });
  }

  const paidAmount = ipData.paid_amount ?? ipData.amount ?? null;
  const paidCents = paidAmount == null ? null : Number(paidAmount);

  const { data: confirmed, error: confErr } = await admin.rpc('confirmar_pagamento_infinitepay', {
    p_order_nsu: orderNsu,
    p_transaction_nsu: transactionNsu || (ipData.transaction_nsu ? String(ipData.transaction_nsu) : null),
    p_invoice_slug: slug || (ipData.slug ? String(ipData.slug) : null),
    p_paid_amount_cents: Number.isFinite(paidCents) ? paidCents : null,
    p_capture_method: ipData.capture_method ? String(ipData.capture_method) : null,
    p_receipt_url: ipData.receipt_url ? String(ipData.receipt_url) : null,
  });

  if (confErr || !confirmed?.ok) {
    console.error(confErr, confirmed);
    return json({ ok: false, erro: confirmed?.erro || 'CONFIRMACAO_FALHOU' }, 400);
  }

  return json({
    ok: true,
    confirmado: true,
    ja_confirmado: !!confirmed.ja_confirmado,
  });
});
