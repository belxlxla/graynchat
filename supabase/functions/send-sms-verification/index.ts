import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber || !/^01[0-9]{8,9}$/.test(phoneNumber)) {
      return new Response(
        JSON.stringify({ error: '올바른 휴대폰 번호를 입력해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔢 6자리 랜덤 인증번호 생성
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 📅 만료 시간 (3분)
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    // 🗄️ Supabase에 인증 코드 저장
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from('sms_verifications')
      .insert({
        phone_number: phoneNumber,
        verification_code: verificationCode,
        expires_at: expiresAt,
      });

    if (dbError) throw dbError;

    // 📱 네이버 클라우드 SENS SMS 발송
    const serviceId = Deno.env.get('NCLOUD_SENS_SERVICE_ID')!;
    const accessKey = Deno.env.get('NCLOUD_ACCESS_KEY')!;
    const secretKey = Deno.env.get('NCLOUD_SECRET_KEY')!;
    const fromNumber = Deno.env.get('NCLOUD_FROM_NUMBER')!; // 발신번호

    const timestamp = Date.now().toString();
    const method = 'POST';
    const url = `/sms/v2/services/${serviceId}/messages`;
    const space = ' ';
    const newLine = '\n';

    // 🔐 HMAC-SHA256 서명 생성
    const message = method + space + url + newLine + timestamp + newLine + accessKey;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // 📤 SMS 발송 요청
    const smsResponse = await fetch(
      `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': accessKey,
          'x-ncp-apigw-signature-v2': base64Signature,
        },
        body: JSON.stringify({
          type: 'SMS',
          from: fromNumber,
          content: `[Grayn] 인증번호 [${verificationCode}]를 입력해주세요.`,
          messages: [
            {
              to: phoneNumber,
            },
          ],
        }),
      }
    );

    const smsResult = await smsResponse.json();

    if (smsResponse.status !== 202) {
      console.error('SMS 발송 실패:', smsResult);
      throw new Error('SMS 발송에 실패했습니다.');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: '인증번호가 발송되었습니다.',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'SMS 발송 중 오류가 발생했습니다.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});