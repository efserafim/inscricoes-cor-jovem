import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('Config error', { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const orderNsu = String(body.order_nsu || '').trim();
  if (!orderNsu) {
    return new Response('Missing order_nsu', { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const paidAmount = body.paid_amount ?? body.amount ?? null;
  const paidCents = paidAmount == null ? null : Number(paidAmount);

  const { data, error } = await admin.rpc('confirmar_pagamento_infinitepay', {
    p_order_nsu: orderNsu,
    p_transaction_nsu: body.transaction_nsu ? String(body.transaction_nsu) : null,
    p_invoice_slug: body.invoice_slug ? String(body.invoice_slug) : null,
    p_paid_amount_cents: Number.isFinite(paidCents) ? paidCents : null,
    p_capture_method: body.capture_method ? String(body.capture_method) : null,
    p_receipt_url: body.receipt_url ? String(body.receipt_url) : null,
  });

  if (error) {
    console.error('confirmar_pagamento_infinitepay', error);
    return new Response('Error', { status: 400 });
  }

  if (!data?.ok) {
    console.error('webhook rejected', data);
    return new Response('Rejected', { status: 400 });
  }

  return new Response('OK', { status: 200 });
});
