import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { receipt, productId, userId } = await req.json();

    const verifyUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
    const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET')!;

    const verifyBody = {
      'receipt-data': receipt,
      'password': appleSharedSecret,
      'exclude-old-transactions': true
    };

    let appleRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyBody)
    });
    let appleData = await appleRes.json();

    if (appleData.status === 21007) {
      appleRes = await fetch(sandboxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyBody)
      });
      appleData = await appleRes.json();
    }

    if (appleData.status !== 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Apple 검증 실패: ${appleData.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const latestReceipts = appleData.latest_receipt_info || appleData.receipt?.in_app || [];
    const validTransaction = latestReceipts.find((t: any) => t.product_id === productId);

    if (!validTransaction) {
      return new Response(
        JSON.stringify({ success: false, error: '해당 상품 거래 없음' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactionId = validTransaction.transaction_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existing } = await supabase
      .from('iap_transactions')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: '이미 사용된 영수증입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('iap_transactions').insert({
      user_id: userId,
      transaction_id: transactionId,
      product_id: productId,
      purchased_at: new Date(Number(validTransaction.purchase_date_ms)).toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, transactionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '알 수 없는 오류';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});