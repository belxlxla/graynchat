import { supabase } from '../../../shared/lib/supabaseClient';

// ─── 점수 구성 요소별 가중치 (조정됨) ────────────────────────
const WEIGHTS = {
  MESSAGE_COUNT:   0.30,  // 메시지 수 (30%) - 누적량이 깡패
  RECENCY:         0.15,  // 최근 대화 (15%)
  FREQUENCY:       0.20,  // 대화 빈도 (20%)
  BALANCE:         0.10,  // 양방향 소통 (10%)
  DURATION:        0.15,  // 친구 기간 (15%) - 신뢰의 척도
  CONSISTENCY:     0.10,  // 지속성 (10%)
};

// ─── 점수별 색상 매핑 ─────────────────────────────────────
export const getScoreColor = (score: number): string => {
  if (score >= 90) return '#FF203A';  // 레드 (찐친) - 기준 상향
  if (score >= 75) return '#ff6b35';  // 주황 (친한 친구)
  if (score >= 50) return '#fbbf24';  // 노랑 (친구)
  if (score >= 20) return '#60a5fa';  // 파랑 (아는 사이)
  return '#9ca3af';                   // 회색 (낯선 사이)
};

export const getScoreLabel = (score: number): string => {
  if (score >= 90) return '영혼의 단짝';
  if (score >= 75) return '베프';
  if (score >= 50) return '친한 친구';
  if (score >= 20) return '알아가는 중';
  return '서먹한 사이';
};

// ─── 메시지 데이터 타입 ───────────────────────────────────
interface Message {
  sender_id: string;
  created_at: string;
}

export interface ScoreBreakdown {
  total: number;
  messageCount: number;
  recency: number;
  frequency: number;
  balance: number;
  duration: number;
  consistency: number;
}

// ─── 로그 스케일 점수 계산 (난이도 대폭 상승) ──────────────
const logScale = (value: number, max: number, ceiling: number): number => {
  if (value === 0) return 0;
  // 로그 스케일을 적용하되, 초기 진입 장벽을 높임
  return Math.min(ceiling, (Math.log(value + 1) / Math.log(max + 1)) * ceiling);
};

// ─── 1. 메시지 수 점수 (0-100) - 난이도: 매우 어려움 ────────
const calculateMessageCountScore = (count: number): number => {
  // 기존 5000개 -> 20,000개 만점 (대화량이 엄청 많아야 함)
  // 100개 = 25점, 1000개 = 50점, 10000개 = 85점
  return logScale(count, 20000, 100);
};

// ─── 2. 최근성 점수 (0-100) - 감점 폭 확대 ────────────────
const calculateRecencyScore = (lastMessageDate: Date): number => {
  const hoursSince = (Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursSince < 1)    return 100; // 1시간 이내
  if (hoursSince < 12)   return 90;  // 반나절 이내
  if (hoursSince < 24)   return 80;  // 하루 이내
  if (hoursSince < 48)   return 60;  // 2일 이내 (급격히 하락)
  if (hoursSince < 168)  return 40;  // 1주 이내
  if (hoursSince < 720)  return 10;  // 1달 이내
  return 0;                           // 1달 이상 시 0점
};

// ─── 3. 대화 빈도 점수 (0-100) - 기준 강화 ────────────────
const calculateFrequencyScore = (messages: Message[]): number => {
  if (messages.length < 10) return 0; // 메시지 10개 미만은 빈도 계산 의미 없음
  
  // 최근 60일(2달) 동안의 대화 날짜 분석
  const twoMonthsAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
  const recentMessages = messages.filter(m => 
    new Date(m.created_at).getTime() > twoMonthsAgo
  );
  
  if (recentMessages.length === 0) return 0;
  
  // 대화한 날짜들 추출
  const uniqueDays = new Set(
    recentMessages.map(m => new Date(m.created_at).toDateString())
  );
  
  const activeDays = uniqueDays.size;
  
  // 60일 중 40일 이상(약 66%) 대화해야 만점
  // 10일 대화 = 25점, 20일 = 50점, 30일 = 75점
  return Math.min(100, (activeDays / 40) * 100);
};

// ─── 4. 양방향 균형 점수 (0-100) ────────────────────────
const calculateBalanceScore = (messages: Message[], userId: string): number => {
  if (messages.length < 10) return 50; // 데이터 부족 시 기본 점수
  
  const myMessages = messages.filter(m => m.sender_id === userId).length;
  const theirMessages = messages.length - myMessages;
  
  if (myMessages === 0 || theirMessages === 0) return 10; // 일방적인 대화는 낮은 점수
  
  // 비율 계산 (0.5가 완벽한 균형)
  const ratio = Math.min(myMessages, theirMessages) / Math.max(myMessages, theirMessages);
  
  // ratio 1.0 = 100점, 0.5(2:1 비율) = 50점, 0.1(10:1 비율) = 10점
  return Math.pow(ratio, 0.8) * 100; // 약간 보정
};

// ─── 5. 친구 기간 점수 (0-100) - 장기 관계 우대 ───────────
const calculateDurationScore = (friendSince: Date): number => {
  const monthsSince = (Date.now() - friendSince.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  // 3개월 미만은 신뢰 쌓는 기간 (낮은 점수)
  if (monthsSince < 1)   return 10;
  if (monthsSince < 3)   return 30;
  if (monthsSince < 6)   return 50;
  if (monthsSince < 12)  return 80;  // 1년 되어야 80점
  if (monthsSince < 24)  return 90;  // 2년
  return 100;                         // 2년 이상 (만점)
};

// ─── 6. 대화 지속성 점수 (0-100) - 꾸준함 체크 ────────────
const calculateConsistencyScore = (messages: Message[]): number => {
  if (messages.length < 50) return 20; // 표본 적으면 낮음
  
  // 최근 50개 메시지의 시간 간격 분석
  const recent50 = messages.slice(0, 50); // 최신순 정렬되어 있다고 가정
  const intervals: number[] = [];
  
  for (let i = 0; i < recent50.length - 1; i++) {
    const gap = new Date(recent50[i].created_at).getTime() - 
                new Date(recent50[i + 1].created_at).getTime();
    intervals.push(gap);
  }
  
  if (intervals.length === 0) return 0;
  
  // 평균 응답/대화 간격 (시간 단위)
  const avgIntervalHours = (intervals.reduce((a, b) => a + b, 0) / intervals.length) / (1000 * 60 * 60);
  
  // 평균 12시간 이내 = 100점 (매일 꾸준히)
  // 평균 24시간 = 80점
  // 평균 3일(72시간) = 40점
  if (avgIntervalHours < 12) return 100;
  if (avgIntervalHours < 24) return 80;
  if (avgIntervalHours < 48) return 60;
  if (avgIntervalHours < 72) return 40;
  if (avgIntervalHours < 168) return 20; // 1주
  return 0;
};

// ════════════════════════════════════════════════════════════
// ─── 메인 계산 함수 ──────────────────────────────────────
// ════════════════════════════════════════════════════════════
export const calculateFriendlyScore = async (
  userId: string,
  friendUserId: string,
  friendId: number
): Promise<ScoreBreakdown> => {
  try {
    // 1. 친구 추가 시점 조회
    const { data: friendData } = await supabase
      .from('friends')
      .select('created_at')
      .eq('id', friendId)
      .single();
    
    const friendSince = friendData?.created_at 
      ? new Date(friendData.created_at) 
      : new Date();
    
    // 2. 메시지 데이터 조회 (최근 2000개로 확대)
    const roomId = [userId, friendUserId].sort().join('_');
    const { data: messages } = await supabase
      .from('messages')
      .select('sender_id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(2000);
    
    const msgs = (messages || []) as Message[];
    
    // 3. 각 차원별 점수 계산 (0-100)
    const rawScores = {
      messageCount: calculateMessageCountScore(msgs.length),
      recency: msgs.length > 0 ? calculateRecencyScore(new Date(msgs[0].created_at)) : 0,
      frequency: calculateFrequencyScore(msgs),
      balance: calculateBalanceScore(msgs, userId),
      duration: calculateDurationScore(friendSince),
      consistency: calculateConsistencyScore(msgs),
    };
    
    // 4. 가중 평균 계산
    const total = Math.round(
      rawScores.messageCount * WEIGHTS.MESSAGE_COUNT +
      rawScores.recency * WEIGHTS.RECENCY +
      rawScores.frequency * WEIGHTS.FREQUENCY +
      rawScores.balance * WEIGHTS.BALANCE +
      rawScores.duration * WEIGHTS.DURATION +
      rawScores.consistency * WEIGHTS.CONSISTENCY
    );
    
    // 5. 최종 점수 (0-100)
    const finalScore = Math.min(100, Math.max(0, total));
    
    return {
      total: finalScore,
      messageCount: Math.round(rawScores.messageCount),
      recency: Math.round(rawScores.recency),
      frequency: Math.round(rawScores.frequency),
      balance: Math.round(rawScores.balance),
      duration: Math.round(rawScores.duration),
      consistency: Math.round(rawScores.consistency),
    };
  } catch (error) {
    console.error('Score calculation error:', error);
    // 오류 시 기본값 (아주 낮게 설정)
    return {
      total: 5,
      messageCount: 0,
      recency: 0,
      frequency: 0,
      balance: 0,
      duration: 0,
      consistency: 0,
    };
  }
};

// ─── DB 업데이트 헬퍼 ─────────────────────────────────────
export const updateFriendlyScoreInDB = async (
  friendId: number,
  score: number
): Promise<void> => {
  try {
    await supabase
      .from('friends')
      .update({ friendly_score: score })
      .eq('id', friendId);
  } catch (error) {
    console.error('Score update error:', error);
  }
};

// ─── 점수 설명 텍스트 ─────────────────────────────────────
export const SCORE_EXPLANATION = {
  title: 'AI 친밀도 점수',
  description: '오랜 기간 꾸준히 대화하고 신뢰를 쌓아야 점수가 올라갑니다.',
  components: [
    { label: '누적 대화',   weight: 30, desc: '총 대화량 (2만 건 이상 시 만점)' },
    { label: '대화 빈도',   weight: 20, desc: '얼마나 자주 대화하는지 (2달 기준)' },
    { label: '최근성',     weight: 15, desc: '마지막 대화가 언제인지' },
    { label: '친구 기간',   weight: 15, desc: '함께한 시간 (1년 이상 시 고득점)' },
    { label: '지속성',     weight: 10, desc: '대화가 끊기지 않고 이어지는지' },
    { label: '소통 균형',   weight: 10, desc: '서로 주고받는 비율' },
  ],
  levels: [
    { min: 90, label: '영혼의 단짝', color: '#FF203A', emoji: '❤️' },
    { min: 75, label: '베프',        color: '#ff6b35', emoji: '🧡' },
    { min: 50, label: '친한 친구',    color: '#fbbf24', emoji: '💛' },
    { min: 20, label: '알아가는 중',  color: '#60a5fa', emoji: '💙' },
    { min: 0,  label: '서먹한 사이',  color: '#9ca3af', emoji: '🤍' },
  ],
};