import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 🎯 Supabase 환경변수는 자동으로 제공됨!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 🔥 Firebase 서버 키만 직접 설정
const FIREBASE_SERVER_KEY = Deno.env.get('sb_publishable_HCg2sR7BiAM6sc7lcHh3oA_lzSk2Qca')!;

interface PushNotificationRequest {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const { userIds, title, body, data }: PushNotificationRequest = await req.json();
    console.log('📨 푸시 알림 요청:', { userIds, title, body });

    // Supabase 클라이언트 생성
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 사용자들의 FCM 토큰 가져오기
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('fcm_token')
      .in('id', userIds)
      .not('fcm_token', 'is', null);

    if (error) {
      console.error('❌ 프로필 조회 에러:', error);
      throw error;
    }

    const tokens = profiles
      .map((profile) => profile.fcm_token)
      .filter(Boolean);

    console.log(`📱 FCM 토큰 ${tokens.length}개 발견`);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No FCM tokens found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FCM에 푸시 알림 발송 (Legacy API)
    const fcmResponse = await fetch(
      'https://fcm.googleapis.com/fcm/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FIREBASE_SERVER_KEY}`,
        },
        body: JSON.stringify({
          registration_ids: tokens,
          notification: {
            title,
            body,
            sound: 'default',
            priority: 'high',
          },
          data: data || {},
          priority: 'high',
        }),
      }
    );

    const fcmResult = await fcmResponse.json();
    console.log('✅ FCM 응답:', fcmResult);

    return new Response(
      JSON.stringify({
        success: true,
        result: fcmResult,
        sentTo: tokens.length,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});