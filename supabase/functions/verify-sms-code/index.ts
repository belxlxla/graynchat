import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // ✅ CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return new Response(
        JSON.stringify({ error: '휴대폰 번호와 인증번호를 입력해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 📝 인증 코드 조회
    const { data, error } = await supabase
      .from('sms_verifications')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('verification_code', code)
      .eq('is_verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: '인증번호가 일치하지 않거나 만료되었습니다.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 인증 완료 처리
    await supabase
      .from('sms_verifications')
      .update({ 
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: '인증이 완료되었습니다.',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '인증 중 오류가 발생했습니다.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});