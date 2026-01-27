import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; // ✨ AnimatePresence 제거됨
import { ChevronLeft, Plus, Trash2, AlertTriangle, Check, ChevronDown } from 'lucide-react'; // ✨ Upload, X 제거됨
import toast from 'react-hot-toast';

// === Types ===
interface ReportItem {
  id: number;
  url: string;
  reason: string;
}

interface FileItem {
  id: number;
  file: File | null;
}

// === Constants ===
const MAX_URLS = 20;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTS = ['jpg', 'jpeg', 'gif', 'psd', 'tif', 'tiff', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'pdf'];

const EMAIL_DOMAINS = ['naver.com', 'gmail.com', 'daum.net', 'nate.com', '직접입력'];

export default function IllegalContentReportPage() {
  const navigate = useNavigate();

  // === Form States ===
  const [reportList, setReportList] = useState<ReportItem[]>([{ id: Date.now(), url: '', reason: '불법촬영물' }]);
  const [files, setFiles] = useState<FileItem[]>([{ id: Date.now(), file: null }]);
  
  // Reporter Info
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [emailId, setEmailId] = useState('');
  const [emailDomain, setEmailDomain] = useState('naver.com');
  const [customDomain, setCustomDomain] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [orgNum, setOrgNum] = useState('');
  const [detail, setDetail] = useState('');
  
  // Verification
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [isAuthSent, setIsAuthSent] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [timer, setTimer] = useState(300); // 5 minutes
  const [isVerified, setIsVerified] = useState(false);

  // Consent
  const [isAgreed, setIsAgreed] = useState(false);

  // Modal State
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; msg: string }>({ isOpen: false, msg: '' });

  // Refs
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // === Timer Effect ===
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAuthSent && timer > 0 && !isVerified) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isAuthSent, timer, isVerified]);

  // === Handlers ===

  // 1. Report List Handler
  const addReportRow = () => {
    if (reportList.length >= MAX_URLS) return toast.error(`최대 ${MAX_URLS}건까지 등록 가능합니다.`);
    setReportList([...reportList, { id: Date.now(), url: '', reason: '불법촬영물' }]);
  };

  const removeReportRow = (id: number) => {
    if (reportList.length === 1) return;
    setReportList(reportList.filter(item => item.id !== id));
  };

  const updateReportItem = (id: number, field: keyof ReportItem, value: string) => {
    setReportList(reportList.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // 2. File Handler
  const addFileRow = () => {
    if (files.length >= MAX_FILES) return toast.error(`최대 ${MAX_FILES}개까지 첨부 가능합니다.`);
    setFiles([...files, { id: Date.now(), file: null }]);
  };

  const removeFileRow = (id: number) => {
    if (files.length === 1) {
      setFiles([{ id: Date.now(), file: null }]); // Reset if last one
    } else {
      setFiles(files.filter(item => item.id !== id));
    }
  };

  const handleFileChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      setErrorModal({ isOpen: true, msg: '지원하지 않는 파일 형식입니다.\n(JPG, GIF, PSD, TIF, Office, HWP, PDF 가능)' });
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorModal({ isOpen: true, msg: '파일 용량이 10MB를 초과했습니다.' });
      e.target.value = '';
      return;
    }

    setFiles(files.map(item => item.id === id ? { ...item, file } : item));
  };

  // 3. Auth Handler
  const sendAuthCode = () => {
    if (!contact) return toast.error('연락처를 입력해주세요.');
    setIsAuthSent(true);
    setTimer(300);
    toast.success('인증번호가 발송되었습니다.');
  };

  const verifyCode = () => {
    if (authCode.length < 4) return toast.error('인증번호를 입력해주세요.');
    setIsVerified(true);
    setIsAuthSent(false);
    toast.success('인증이 완료되었습니다.');
  };

  // 4. Submit (Mailto)
  const handleSubmit = () => {
    if (!name || !contact || !emailId || !birthdate || !detail) return toast.error('필수 항목을 모두 입력해주세요.');
    if (!isVerified) return toast.error('본인 인증을 완료해주세요.');
    if (!isAgreed) return toast.error('개인정보 수집 및 이용에 동의해야 합니다.');

    const finalEmail = `${emailId}@${emailDomain === '직접입력' ? customDomain : emailDomain}`;
    const today = new Date().toLocaleDateString('ko-KR');

    // === 신고 서류 서식 생성 ===
    const subject = `[불법촬영물 등 유통 신고] ${name} - ${today}`;
    
    const body = `
[ 불법촬영물 등 유통 신고 및 삭제요청서 ]

1. 신고 대상 (총 ${reportList.length}건)
==================================================
${reportList.map((item, index) => `
[${index + 1}]
- 유형: ${item.reason}
- URL: ${item.url || '(URL 미입력)'}
`).join('')}
==================================================

2. 신고인 정보
==================================================
- 성명(기관/단체명): ${name}
- 연락처: ${contact}
- 이메일: ${finalEmail}
- 생년월일: ${birthdate}
- 기관/법인번호: ${orgNum || '(없음)'}
==================================================

3. 유통 현황 상세
==================================================
${detail}
==================================================

4. 첨부파일 목록 및 확인
==================================================
※ 주의: 보안상의 이유로 브라우저에서 메일 앱으로 파일이 자동 첨부되지 않습니다.
※ 아래 나열된 파일을 이 메일에 [직접 첨부]하여 발송해 주시기 바랍니다.

[첨부해야 할 파일 목록]
${files.map((f, i) => f.file ? `${i + 1}. ${f.file.name}` : `${i + 1}. (파일 없음)`).join('\n')}
==================================================

5. 개인정보 수집 및 이용 동의
==================================================
- 동의 여부: 동의함 (O)
==================================================

전기통신사업법 제 22조의5 제1항에 따라 위와 같이 신고, 삭제 요청을 합니다.
신고일자: ${today}
신고인: ${name}
`.trim();

    // 메일 앱 호출
    window.location.href = `mailto:bella@vanishst.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Timer Formatting
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">불법촬영물 등 유통 신고</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* Intro */}
        <div className="p-5 bg-[#252527] border-b border-[#3A3A3C]">
          <ul className="text-[12px] text-[#8E8E93] space-y-2 list-disc pl-4 leading-relaxed">
            <li>전기통신사업법 제 22조의5(부가통신사업자의 불법촬영물등 유통방지)에 따라, 유통방지 조치를 취하고 있습니다.</li>
            <li>불법촬영물등이 유통되는 것을 발견하신 경우, 전기통신사업법 시행령에 따라 유통방지에 필요한 조치를 요청하실 수 있습니다.</li>
            <li>신고요청 사유가 불명확할 경우 <span className="text-[#E5E5EA] underline">방송통신심의위원회</span>에 심의를 요청하실 수 있습니다.</li>
          </ul>
        </div>

        <div className="p-5 space-y-8">
          
          <div>
            <h2 className="text-lg font-bold text-white mb-1">불법촬영물 등 유통 신고 및 삭제요청서</h2>
            <p className="text-[12px] text-[#FF453A]">* 표시 항목은 필수사항입니다.</p>
          </div>

          {/* 1. 신고 대상 */}
          <Section title="불법촬영물 등 신고대상">
            {reportList.map((item, index) => (
              <div key={item.id} className="mb-4 p-4 bg-[#2C2C2E] rounded-xl border border-[#3A3A3C] relative">
                {index > 0 && (
                  <button onClick={() => removeReportRow(item.id)} className="absolute top-2 right-2 p-1 text-[#FF453A]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                <Label required>신고 게시물 주소</Label>
                <input 
                  className="w-full h-10 bg-[#1C1C1E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white mb-3 focus:border-brand-DEFAULT outline-none"
                  placeholder="URL을 입력해주세요 (https://...)"
                  value={item.url}
                  onChange={(e) => updateReportItem(item.id, 'url', e.target.value)}
                />

                <Label required>신고 사유</Label>
                <div className="relative">
                  <select 
                    className="w-full h-10 bg-[#1C1C1E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white appearance-none focus:border-brand-DEFAULT outline-none"
                    value={item.reason}
                    onChange={(e) => updateReportItem(item.id, 'reason', e.target.value)}
                  >
                    <option>불법촬영물</option>
                    <option>허위영상물 (딥페이크 등)</option>
                    <option>아동 및 청소년 성착취물</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[#8E8E93] pointer-events-none" />
                </div>
              </div>
            ))}
            
            <button 
              onClick={addReportRow}
              className="w-full py-3 border border-[#3A3A3C] rounded-xl text-sm text-[#8E8E93] hover:bg-[#2C2C2E] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> 신고게시물 추가하기
            </button>
            <p className="text-[11px] text-[#636366] mt-2 pl-1">
              - 신고 게시글은 1회 20건 까지 등록할 수 있습니다.<br/>
              - 단축된 URL로 신고된 경우, 처리가 지연될 수 있습니다.
            </p>
          </Section>

          {/* 2. 신고인 정보 */}
          <Section title="신고인">
            <div className="space-y-4">
              <div>
                <Label required>성명 (기관, 단체명)</Label>
                <input 
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                />
              </div>

              <div>
                <Label required>연락처</Label>
                <input 
                  value={contact} onChange={e => setContact(e.target.value)}
                  type="tel"
                  placeholder="- 없이 숫자만 입력"
                  className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                />
              </div>

              <div>
                <Label required>이메일 주소</Label>
                <div className="flex gap-2 mb-2">
                  <input 
                    value={emailId} onChange={e => setEmailId(e.target.value)}
                    className="flex-1 h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                  />
                  <span className="self-center text-[#8E8E93]">@</span>
                  <div className="flex-1 relative">
                    <select 
                      value={emailDomain} onChange={e => setEmailDomain(e.target.value)}
                      className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white appearance-none focus:border-brand-DEFAULT outline-none"
                    >
                      {EMAIL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[#8E8E93] pointer-events-none" />
                  </div>
                </div>
                {emailDomain === '직접입력' && (
                  <input 
                    value={customDomain} onChange={e => setCustomDomain(e.target.value)}
                    placeholder="도메인 입력 (예: domain.com)"
                    className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                  />
                )}
              </div>

              <div>
                <Label required>인증하기</Label>
                <div className="flex gap-2 mb-2">
                  <button 
                    onClick={() => setAuthMethod('phone')}
                    className={`flex-1 py-2 rounded-lg text-sm border ${authMethod === 'phone' ? 'border-brand-DEFAULT text-brand-DEFAULT bg-brand-DEFAULT/10' : 'border-[#3A3A3C] text-[#8E8E93]'}`}
                  >휴대폰 인증</button>
                  <button 
                    onClick={() => setAuthMethod('email')}
                    className={`flex-1 py-2 rounded-lg text-sm border ${authMethod === 'email' ? 'border-brand-DEFAULT text-brand-DEFAULT bg-brand-DEFAULT/10' : 'border-[#3A3A3C] text-[#8E8E93]'}`}
                  >이메일 인증</button>
                </div>
                {!isAuthSent && !isVerified && (
                  <button onClick={sendAuthCode} className="w-full h-10 bg-[#3A3A3C] text-white rounded-lg text-sm font-medium hover:bg-[#48484A]">인증번호 발송</button>
                )}
                {isAuthSent && !isVerified && (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input 
                        value={authCode} onChange={e => setAuthCode(e.target.value)}
                        placeholder="인증번호 입력"
                        className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                      />
                      <span className="absolute right-3 top-3 text-xs text-[#FF453A] font-mono">{formatTime(timer)}</span>
                    </div>
                    <button onClick={verifyCode} className="w-20 h-10 bg-brand-DEFAULT text-white rounded-lg text-sm font-bold">확인</button>
                  </div>
                )}
                {isVerified && (
                  <div className="w-full h-10 bg-[#1C1C1E] border border-green-500/50 rounded-lg flex items-center justify-center text-green-500 text-sm gap-2">
                    <Check className="w-4 h-4" /> 인증 완료
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>생년월일</Label>
                  <input 
                    value={birthdate} onChange={e => setBirthdate(e.target.value)}
                    type="date"
                    className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                  />
                </div>
                <div className="flex-1">
                  <Label>기관/법인번호</Label>
                  <input 
                    value={orgNum} onChange={e => setOrgNum(e.target.value)}
                    placeholder="선택 사항"
                    className="w-full h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 text-sm text-white focus:border-brand-DEFAULT outline-none" 
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* 3. 유통 현황 상세 */}
          <Section title="불법촬영물 등의 유통 현황">
            <Label required>유통 현황 상세</Label>
            <textarea 
              value={detail} onChange={e => setDetail(e.target.value)}
              className="w-full h-32 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl p-3 text-sm text-white focus:border-brand-DEFAULT outline-none resize-none"
              placeholder="불법촬영물 등의 유통 현황에 대한 상세 설명을 기재해 주시기 바랍니다."
            />
            <p className="text-[11px] text-[#636366] mt-2">
              기재할 공간이 부족하면 첨부서류로 따로 보내주시면 담당자가 검토하고 있습니다.
            </p>
          </Section>

          {/* 4. 개인정보 동의 */}
          <Section title="개인정보의 수집 및 이용동의서">
            <div className="border border-[#3A3A3C] rounded-xl overflow-hidden mb-4 text-[12px] text-[#D1D1D6]">
              <div className="grid grid-cols-3 border-b border-[#3A3A3C] bg-[#252527]">
                <div className="p-3 font-bold border-r border-[#3A3A3C] col-span-1">항목</div>
                <div className="p-3 col-span-2">성명, 전화번호, 이메일, 생년월일</div>
              </div>
              <div className="grid grid-cols-3 border-b border-[#3A3A3C]">
                <div className="p-3 font-bold border-r border-[#3A3A3C] col-span-1 bg-[#252527]">수집 및 이용목적</div>
                <div className="p-3 col-span-2">신고인 확인, 불법촬영물 등 유통신고 접수 및 처리, 방송통신심의위원회 심의 요청</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="p-3 font-bold border-r border-[#3A3A3C] col-span-1 bg-[#252527]">보유기간</div>
                <div className="p-3 col-span-2">5년</div>
              </div>
            </div>
            <p className="text-[11px] text-[#636366] mb-4">
              - 위의 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있으며, 거부 시 요청 처리에 제한이 있을 수 있습니다.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`w-5 h-5 rounded border flex items-center justify-center ${isAgreed ? 'bg-brand-DEFAULT border-brand-DEFAULT' : 'border-[#636366]'}`}>
                {isAgreed && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={isAgreed} onChange={() => setIsAgreed(!isAgreed)} />
              <span className="text-sm text-white">위와 같이 개인정보를 수집 및 이용하는데 동의합니다.</span>
            </label>
          </Section>

          {/* 5. 첨부서류 */}
          <Section title="첨부서류">
            <div className="space-y-3">
              {files.map((item, index) => (
                <div key={item.id} className="flex gap-2">
                  <div className="flex-1 h-10 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 flex items-center justify-between text-sm text-[#8E8E93]">
                    <span className="truncate">{item.file ? item.file.name : '파일을 선택해주세요'}</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      // ✨ 수정됨: 암시적 리턴 방지를 위해 중괄호 사용
                      ref={(el) => { fileInputRefs.current[item.id] = el; }}
                      onChange={(e) => handleFileChange(item.id, e)}
                    />
                    <button onClick={() => fileInputRefs.current[item.id]?.click()} className="text-white bg-[#3A3A3C] px-2 py-1 rounded text-xs ml-2 hover:bg-[#48484A]">파일 선택</button>
                  </div>
                  {index > 0 && (
                    <button onClick={() => removeFileRow(item.id)} className="w-10 h-10 flex items-center justify-center bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg text-[#FF453A]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              
              <button 
                onClick={addFileRow}
                className="w-full py-3 border border-[#3A3A3C] rounded-xl text-sm text-[#8E8E93] hover:bg-[#2C2C2E] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> 첨부파일 추가
              </button>
              
              <div className="text-[11px] text-[#636366] mt-2 space-y-1">
                <p>- 불법촬영물등의 위치(URL 등)를 특정하고 내용을 확인할 수 있는 추가 자료를 첨부해 주시기 바랍니다.</p>
                <p>- 파일첨부는 5개 이내, 최대 10MB 미만, JPG, GIF, PSD, TIF, MS Office 파일, 아래아한글, PDF 만 가능합니다.</p>
              </div>
            </div>
          </Section>

          {/* Footer Warning & Buttons */}
          <div className="pt-4 pb-8">
            <p className="text-[13px] text-white font-medium mb-2">
              전기통신사업법 제 22조의5 제1항에 따라 위와같이 신고, 삭제 요청을 합니다.
            </p>
            <p className="text-[12px] text-[#FF453A] mb-8 flex gap-1 items-start">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              허위신고일 경우, 신고자의 서비스 활동이 영구적으로 제한될 수 있으니 유의하여 신중하게 신고해 주시기 바랍니다.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="flex-1 h-12 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl text-white font-bold hover:bg-[#3A3A3C] transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-1 h-12 bg-[#B91C1C] rounded-xl text-white font-bold hover:bg-[#991B1B] transition-colors shadow-lg shadow-red-900/20"
              >
                신고접수
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Custom Error Modal */}
      <AlertModal 
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        msg={errorModal.msg}
      />

    </div>
  );
}

// === Sub Components ===

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#2C2C2E] pt-6">
      <h3 className="text-[15px] font-bold text-white mb-4 flex items-center gap-2">
        <div className="w-1 h-4 bg-[#B91C1C]" /> 
        {title}
      </h3>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-[13px] text-[#D1D1D6] mb-2 font-medium">
      {children}
      {required && <span className="text-[#FF453A] ml-1">*</span>}
    </label>
  );
}

function AlertModal({ isOpen, onClose, msg }: { isOpen: boolean; onClose: () => void; msg: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6">
          <div className="w-10 h-10 bg-[#FF453A]/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-[#FF453A]" />
          </div>
          <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{msg}</p>
        </div>
        <div className="border-t border-[#3A3A3C] h-12">
          <button onClick={onClose} className="w-full h-full text-brand-DEFAULT font-bold text-[15px] hover:bg-[#2C2C2E]">확인</button>
        </div>
      </motion.div>
    </div>
  );
}