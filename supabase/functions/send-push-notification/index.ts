import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getFCMAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
  const now = getNumericDate(0);
  const exp = getNumericDate(60 * 60);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const rawKey = serviceAccount.private_key
    .replace(pemHeader, '').replace(pemFooter, '').replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, cryptoKey);
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Database Webhook에서 직접 호출되는 경우 (messages INSERT)
    if (body.type === 'INSERT' && body.table === 'messages') {
      const message = body.record;
      const senderId = message.sender_id;
      const roomId = message.room_id;
      const content = message.content;

      // 채팅방 멤버 조회 (보낸 사람 제외)
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .neq('user_id', senderId)
        .is('left_at', null);

      if (!members || members.length === 0) {
        return new Response(JSON.stringify({ message: 'No members' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const receiverIds = members.map(m => m.user_id);

      // 알림 설정 + FCM 토큰 조회 (notify_all이 true인 사람만)
      const { data: settings } = await supabase
        .from('user_settings')
        .select('user_id, fcm_token, notify_all')
        .in('user_id', receiverIds)
        .eq('notify_all', true)
        .not('fcm_token', 'is', null);

      if (!settings || settings.length === 0) {
        return new Response(JSON.stringify({ message: 'No tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 보낸 사람 이름 조회
      const { data: sender } = await supabase
        .from('users')
        .select('name')
        .eq('id', senderId)
        .single();

      const senderName = sender?.name || '새 메시지';
      const tokens = settings.map(s => s.fcm_token).filter(Boolean);

      // FCM 발송
      const accessToken = await getFCMAccessToken();
      const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
      const projectId = serviceAccount.project_id;

      await Promise.allSettled(
        tokens.map((token) =>
          fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token,
                notification: {
                  title: senderName,
                  body: content.length > 50 ? content.substring(0, 47) + '...' : content,
                },
                data: { roomId, type: 'message' },
                apns: {
                  payload: { aps: { sound: 'default' } },
                },
              },
            }),
          })
        )
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 기존 방식 (직접 호출)
    const { userIds, title, body: notifBody, data } = body;
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('user_id, fcm_token, notify_all')
      .in('user_id', userIds)
      .eq('notify_all', true)
      .not('fcm_token', 'is', null);

    const tokens = (userSettings || []).map(s => s.fcm_token).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No tokens' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = await getFCMAccessToken();
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
    const projectId = serviceAccount.project_id;

    await Promise.allSettled(
      tokens.map((token) =>
        fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body: notifBody },
              data: data || {},
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        })
      )
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
