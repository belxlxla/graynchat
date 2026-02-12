import { supabase } from '../../../shared/lib/supabaseClient';

// ─── 점수 구성 요소별 가중치 ──────────────────────────────
const WEIGHTS = {
  MESSAGE_COUNT:   0.25,  // 메시지 수 (25%)
  RECENCY:         0.20,  // 최근 대화 (20%)
  FREQUENCY:       0.20,  // 대화 빈도 (20%)
  BALANCE:         0.15,  // 양방향 소통 (15%)
  DURATION:        0.10,  // 친구 기간 (10%)
  CONSISTENCY:     0.10,  // 지속성 (10%)
};

// ─── 점수별 색상 매핑 ─────────────────────────────────────
export const getScoreColor = (score: number): string => {
  if (score >= 85) return '#FF203A';  // 핫핑크 (베프)
  if (score >= 70) return '#ff6b35';  // 주황 (가까운 친구)
  if (score >= 50) return '#fbbf24';  // 노랑 (친구)
  if (score >= 30) return '#60a5fa';  // 파랑 (알아가는 중)
  return '#9ca3af';                   // 회색 (낯선 사이)
};

export const getScoreLabel = (score: number): string => {
  if (score >= 85) return '베프';
  if (score >= 70) return '가까운 친구';
  if (score >= 50) return '친구';
  if (score >= 30) return '알아가는 중';
  return '낯선 사이';
};

// ─── 메시지 데이터 타입 ───────────────────────────────────
interface Message {
  sender_id: string;
  created_at: string;
}

interface ScoreBreakdown {
  total: number;
  messageCount: number;
  recency: number;
  frequency: number;
  balance: number;
  duration: number;
  consistency: number;
}

// ─── 로그 스케일 점수 계산 (부드러운 증가) ──────────────
const logScale = (value: number, max: number, ceiling: number): number => {
  if (value === 0) return 0;
  // 로그 스케일: log(value + 1) / log(max + 1) * ceiling
  return Math.min(ceiling, (Math.log(value + 1) / Math.log(max + 1)) * ceiling);
};

// ─── 1. 메시지 수 점수 (0-100) ──────────────────────────
const calculateMessageCountScore = (count: number): number => {
  // 10개 = 10점, 100개 = 50점, 1000개 = 85점, 5000개 = 100점
  return logScale(count, 5000, 100);
};

// ─── 2. 최근성 점수 (0-100) ─────────────────────────────
const calculateRecencyScore = (lastMessageDate: Date): number => {
  const hoursSince = (Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursSince < 1)   return 100;  // 1시간 이내
  if (hoursSince < 6)   return 90;   // 6시간 이내
  if (hoursSince < 24)  return 75;   // 하루 이내
  if (hoursSince < 72)  return 55;   // 3일 이내
  if (hoursSince < 168) return 35;   // 1주 이내
  if (hoursSince < 720) return 15;   // 1달 이내
  return 5;                           // 1달 이상
};

// ─── 3. 대화 빈도 점수 (0-100) ──────────────────────────
const calculateFrequencyScore = (messages: Message[]): number => {
  if (messages.length < 2) return 0;
  
  // 최근 30일 동안의 대화 날짜 추출
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentMessages = messages.filter(m => 
    new Date(m.created_at).getTime() > thirtyDaysAgo
  );
  
  if (recentMessages.length === 0) return 0;
  
  // 대화한 날짜들 추출 (날짜별로 그룹핑)
  const uniqueDays = new Set(
    recentMessages.map(m => new Date(m.created_at).toDateString())
  );
  
  const activeDays = uniqueDays.size;
  
  // 30일 중 대화한 날 비율
  // 매일 대화 = 100점, 일주일에 3-4번 = 60점, 일주일에 1번 = 30점
  return Math.min(100, (activeDays / 30) * 100 * 3.3);
};

// ─── 4. 양방향 균형 점수 (0-100) ────────────────────────
const calculateBalanceScore = (messages: Message[], userId: string): number => {
  if (messages.length < 2) return 0;
  
  const myMessages = messages.filter(m => m.sender_id === userId).length;
  const theirMessages = messages.length - myMessages;
  
  if (myMessages === 0 || theirMessages === 0) return 0;
  
  // 비율 계산 (0.5가 완벽한 균형)
  const ratio = Math.min(myMessages, theirMessages) / Math.max(myMessages, theirMessages);
  
  // ratio: 1.0 (완벽) = 100점, 0.8 = 80점, 0.5 = 50점, 0.2 = 20점
  return ratio * 100;
};

// ─── 5. 친구 기간 점수 (0-100) ──────────────────────────
const calculateDurationScore = (friendSince: Date): number => {
  const monthsSince = (Date.now() - friendSince.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsSince < 0.1) return 5;   // 신규 친구
  if (monthsSince < 1)   return 20;  // 1달 미만
  if (monthsSince < 3)   return 40;  // 3달 미만
  if (monthsSince < 6)   return 60;  // 6달 미만
  if (monthsSince < 12)  return 80;  // 1년 미만
  return 100;                         // 1년 이상
};

// ─── 6. 대화 지속성 점수 (0-100) ────────────────────────
const calculateConsistencyScore = (messages: Message[]): number => {
  if (messages.length < 10) return messages.length * 5; // 초기엔 메시지 수에 비례
  
  // 최근 100개 메시지의 시간 간격 분석
  const recent100 = messages.slice(-100);
  const intervals: number[] = [];
  
  for (let i = 1; i < recent100.length; i++) {
    const gap = new Date(recent100[i].created_at).getTime() - 
                new Date(recent100[i - 1].created_at).getTime();
    intervals.push(gap);
  }
  
  if (intervals.length === 0) return 50;
  
  // 평균 간격
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const avgDays = avgInterval / (1000 * 60 * 60 * 24);
  
  // 간격이 짧고 일정할수록 높은 점수
  // 평균 1일 간격 = 100점, 3일 = 70점, 7일 = 40점, 14일 = 20점
  if (avgDays < 1)  return 100;
  if (avgDays < 3)  return 80;
  if (avgDays < 7)  return 50;
  if (avgDays < 14) return 25;
  return 10;
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
    
    // 2. 메시지 데이터 조회 (최근 1000개)
    const roomId = [userId, friendUserId].sort().join('_');
    const { data: messages } = await supabase
      .from('messages')
      .select('sender_id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1000);
    
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
    // 오류 시 기본값 반환
    return {
      total: 30,
      messageCount: 0,
      recency: 0,
      frequency: 0,
      balance: 0,
      duration: 30,
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
  title: 'AI 친밀도 점수란?',
  description: 'AI가 대화 패턴을 분석하여 친구와의 친밀도를 0-100점으로 계산합니다.',
  components: [
    { label: '메시지 수',   weight: 25, desc: '주고받은 메시지 양' },
    { label: '최근성',     weight: 20, desc: '마지막 대화 시점' },
    { label: '대화 빈도',   weight: 20, desc: '얼마나 자주 대화하는지' },
    { label: '양방향 소통', weight: 15, desc: '서로 균형있게 대화하는지' },
    { label: '친구 기간',   weight: 10, desc: '친구를 맺은 지 얼마나 됐는지' },
    { label: '지속성',     weight: 10, desc: '꾸준히 대화하는지' },
  ],
  levels: [
    { min: 85, label: '베프',        color: '#FF203A', emoji: '❤️' },
    { min: 70, label: '가까운 친구',  color: '#ff6b35', emoji: '🧡' },
    { min: 50, label: '친구',        color: '#fbbf24', emoji: '💛' },
    { min: 30, label: '알아가는 중',  color: '#60a5fa', emoji: '💙' },
    { min: 0,  label: '낯선 사이',    color: '#9ca3af', emoji: '🤍' },
  ],
};