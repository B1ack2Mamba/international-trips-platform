import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const payload = await req.json()
    const externalPaymentId = payload.external_payment_id

    if (!externalPaymentId) {
      return new Response(JSON.stringify({ ok: false, error: 'external_payment_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: payment, error: paymentError } = await supabase.from('payments').select('id, status').eq('external_payment_id', externalPaymentId).maybeSingle()
    if (paymentError || !payment) {
      return new Response(JSON.stringify({ ok: false, error: paymentError?.message ?? 'payment_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (payload.status === 'paid' || payload.status === 'succeeded' || payload.status === 'success') {
      const { error } = await supabase.rpc('mark_payment_paid', {
        p_payment_id: payment.id,
        p_paid_amount: payload.paid_amount ?? null,
        p_paid_at: payload.paid_at ?? new Date().toISOString(),
        p_note: payload.note ?? 'Платёж подтверждён вебхуком',
      })
      if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      const { error } = await supabase.from('payments').update({ status: payload.status ?? 'pending', metadata: payload }).eq('id', payment.id)
      if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
