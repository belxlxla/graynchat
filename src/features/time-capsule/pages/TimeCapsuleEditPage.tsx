import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

export default function TimeCapsuleEditPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();

  const [message, setMessage] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [unlockTime, setUnlockTime] = useState('12:00');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const fetchCapsule = async () => {
      if (!user?.id || !id) return;

      try {
        const { data, error } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('id', id)
          .eq('sender_id', user.id)
          .single();

        if (error) throw error;

        if (data.is_edited) {
          toast.error('이미 수정한 타임캡슐입니다.');
          navigate(-1);
          return;
        }

        if (new Date(data.unlock_at) <= new Date()) {
          toast.error('잠금 해제된 타임캡슐은 수정할 수 없습니다.');
          navigate(-1);
          return;
        }

        setCanEdit(true);
        setMessage(data.message);

        const unlockDateTime = new Date(data.unlock_at);
        setUnlockDate(unlockDateTime.toISOString().split('T')[0]);
        setUnlockTime(unlockDateTime.toTimeString().substring(0, 5));
      } catch (error) {
        console.error('캡슐 로드 실패:', error);
        toast.error('타임캡슐을 불러올 수 없습니다.');
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCapsule();
  }, [user, id, navigate]);

  const minDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, []);

  const handleSave = async () => {
    if (!user?.id || !id || !message.trim() || !unlockDate || !unlockTime) {
      toast.error('모든 항목을 입력해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      const unlockDateTime = new Date(`${unlockDate}T${unlockTime}:00`);

      if (unlockDateTime <= new Date()) {
        toast.error('잠금 해제 시간은 현재보다 미래여야 합니다.');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('time_capsules')
        .update({
          message: message.trim(),
          unlock_at: unlockDateTime.toISOString(),
          is_edited: true
        })
        .eq('id', id)
        .eq('sender_id', user.id);

      if (error) throw error;

      toast.success('타임캡슐이 수정되었습니다. 이제 더 이상 수정할 수 없습니다.', {
        duration: 4000
      });

      navigate('/time-capsule/sent');
    } catch (error: any) {
      console.error('타임캡슐 수정 실패:', error);
      toast.error('수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[100dvh] bg-[#1C1C1E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="h-[100dvh] bg-[#1C1C1E] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold">타임캡슐 수정</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-orange-400 font-medium mb-1">1회 수정 기회</p>
            <p className="text-xs text-orange-300/80">
              저장하면 더 이상 수정할 수 없습니다.<br/>
              신중하게 확인해주세요.
            </p>
          </div>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-[#8E8E93] mb-2">메시지</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="w-full h-40 bg-[#2C2C2E] rounded-2xl p-4 text-white placeholder-[#636366] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              maxLength={1000}
            />
            <div className="mt-2 text-xs text-[#8E8E93] text-right">
              {message.length} / 1000
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8E8E93] mb-2">날짜 선택</label>
            <input
              type="date"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              min={minDate}
              className="w-full bg-[#2C2C2E] text-white p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8E8E93] mb-2">시간 선택</label>
            <input
              type="time"
              value={unlockTime}
              onChange={(e) => setUnlockTime(e.target.value)}
              className="w-full bg-[#2C2C2E] text-white p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {unlockDate && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
              <p className="text-sm text-orange-400 text-center">
                <strong>{new Date(`${unlockDate}T${unlockTime}`).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</strong>에 열립니다
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !message.trim() || !unlockDate}
          className="mt-6 w-full py-4 bg-orange-500 text-white font-bold rounded-2xl disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              수정 완료 (더 이상 수정 불가)
            </>
          )}
        </button>
      </div>
    </div>
  );
}