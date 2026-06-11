'use client';

import { useState, useEffect, Suspense } from 'react';
import styles from './onboarding.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  DEFAULT_ONBOARDING_SECTIONS,
  getOnboardingAction,
  getOnboardingSection,
  mergeOnboardingSections,
  type OnboardingGuideSection,
} from '@/lib/onboarding-guide';

type PlatformKey = 'douyin' | 'xiaohongshu' | 'shipinhao' | 'kuaishou' | 'weibo' | 'xianyu';

const PLATFORMS: { key: PlatformKey; label: string }[] = [
  { key: 'douyin', label: '抖音' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'shipinhao', label: '视频号' },
  { key: 'kuaishou', label: '快手' },
  { key: 'weibo', label: '微博' },
  { key: 'xianyu', label: '闲鱼' },
];

type AccountInput = {
  id: string; // uuid for key
  value: string;
  isVerified: boolean | null; // null means not selected
};

type AccountPayload = {
  platform: PlatformKey;
  account_id: string;
  is_verified: boolean;
};

type OnboardingGuideResponse = {
  data?: OnboardingGuideSection[];
};

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');

  const [step, setStep] = useState(1);
  
  // Data States
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [locStatus, setLocStatus] = useState('正在识别位置...');
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const [platformAccounts, setPlatformAccounts] = useState<Record<string, AccountInput[]>>({});
  
  const [wechatId, setWechatId] = useState('');
  
  // Result State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{username: string; password: string} | null>(null);
  const [guideSections, setGuideSections] = useState<OnboardingGuideSection[]>(DEFAULT_ONBOARDING_SECTIONS);

  useEffect(() => {
    let isMounted = true;

    fetch('/api/onboarding-guide')
      .then((res) => res.json())
      .then((payload: OnboardingGuideResponse) => {
        if (!isMounted || !payload.data) return;
        setGuideSections(mergeOnboardingSections(payload.data));
      })
      .catch(() => {
        // Keep the baked-in copy if the backend config is unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto Detect Location on Step 2
  useEffect(() => {
    if (step === 2) {
      detectLocation();
    }
  }, [step]);

  // Init Accounts when platforms change
  useEffect(() => {
    setPlatformAccounts(prev => {
      const newAccounts = { ...prev };
      selectedPlatforms.forEach(p => {
        if (!newAccounts[p]) {
          newAccounts[p] = [{ id: crypto.randomUUID(), value: '', isVerified: null }];
        }
      });
      // Don't remove keys for deselected platforms to preserve data if user re-selects.
      return newAccounts;
    });
  }, [selectedPlatforms]);

  const detectLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      setProvince(data.region || '');
      setCity(data.city || '');
      setLocStatus('识别成功！如不准确请手动修改');
    } catch {
      setLocStatus('识别位置失败，请手动填写');
    }
  };

  const togglePlatform = (p: PlatformKey) => {
    if (selectedPlatforms.includes(p)) {
      setSelectedPlatforms(prev => prev.filter(x => x !== p));
    } else {
      setSelectedPlatforms(prev => [...prev, p]);
    }
  };

  const addAccountRow = (p: string) => {
    setPlatformAccounts(prev => ({
      ...prev,
      [p]: [...(prev[p] || []), { id: crypto.randomUUID(), value: '', isVerified: null }]
    }));
  };

  const updateAccount = <K extends 'value' | 'isVerified'>(
    p: string,
    id: string,
    field: K,
    val: AccountInput[K]
  ) => {
    setPlatformAccounts(prev => ({
      ...prev,
      [p]: prev[p].map(acc => acc.id === id ? { ...acc, [field]: val } : acc)
    }));
  };

  const experienceGuide = getOnboardingSection(guideSections, 'experience');
  const locationGuide = getOnboardingSection(guideSections, 'location');
  const platformsGuide = getOnboardingSection(guideSections, 'platforms');
  const accountsGuide = getOnboardingSection(guideSections, 'accounts');
  const wechatGuide = getOnboardingSection(guideSections, 'wechat');
  const successGuide = getOnboardingSection(guideSections, 'success');

  const renderGuideSupport = (section: OnboardingGuideSection) => (
    <>
      {section.image_url && (
        <div className={styles.guideImageWrap}>
          <Image
            src={section.image_url}
            alt={section.title}
            width={360}
            height={220}
            unoptimized
            className={styles.guideImage}
          />
        </div>
      )}
      {section.body && section.section_key !== 'experience' && section.section_key !== 'platforms' && (
        <div className={styles.guideBody}>{section.body}</div>
      )}
      {section.sop_text && <div className={styles.sopTip}>{section.sop_text}</div>}
    </>
  );

  const renderSectionHeader = (
    section: OnboardingGuideSection,
    titleClassName = styles.sectionTitle,
    subtitleClassName = styles.guideSubtitle
  ) => (
    <>
      <h2 className={titleClassName}>{section.title}</h2>
      {section.subtitle && <div className={subtitleClassName}>{section.subtitle}</div>}
      {renderGuideSupport(section)}
    </>
  );

  const handleNext = () => {
    if (step === 2 && !city.trim()) return alert('请填写城市');
    if (step === 3 && selectedPlatforms.length === 0) return alert('请至少选择一个平台');
    if (step === 4) {
      // Validate accounts
      let valid = true;
      selectedPlatforms.forEach(p => {
        const accs = platformAccounts[p];
        accs?.forEach(a => {
          if (!a.value.trim() || a.isVerified === null) valid = false;
        });
      });
      if (!valid) return alert('请完善所有账号ID和实名状态');
    }
    setStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!wechatId.trim()) return alert('请填写微信号');
    
    setIsSubmitting(true);
    
    // Construct Payload
    const accountsPayload: AccountPayload[] = [];
    selectedPlatforms.forEach(p => {
      const accs = platformAccounts[p];
      accs?.forEach(a => {
        if (a.value.trim()) {
          accountsPayload.push({
            platform: p,
            account_id: a.value.trim(),
            is_verified: a.isVerified === true
          });
        }
      });
    });

    try {
      const res = await fetch('/api/auth/quick-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          province,
          city,
          wechat_id: wechatId,
          accounts: accountsPayload,
          invite_code: inviteCode
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      
      setResult(data.data); // data.data contains username, password
    } catch (e) {
      alert(e instanceof Error ? e.message : '提交失败');
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制: ' + text);
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('已复制');
    });
  };

  // Render Result Page
  if (result) {
    return (
      <div className={styles.clayBg} style={{ justifyContent: 'center' }}>
         <div className={styles.container} style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '15px' }}>{successGuide.title}</h2>
            
            <div className={styles.accCard}>
               <div className={styles.accRow} onClick={() => copyToClipboard(result.username)}>
                  <span className={styles.accLabel}>账号：</span>
                  <div className={styles.accNumber}>{result.username}</div>
               </div>
               <div className={styles.pwdRow} onClick={() => copyToClipboard(result.password)}>
                  密码：<span>{result.password}</span>
               </div>
               <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>( 点击即可直接复制 )</div>
            </div>

            <div style={{ margin: '15px 0' }}>
               <span style={{ color: '#3498db', fontWeight: 900, fontSize: '1.3rem', display: 'block', marginBottom: '10px' }}>
                 {successGuide.subtitle}
               </span>
               <div style={{ width: '220px', height: '220px', background: 'white', border: '8px solid #f1f5f9', borderRadius: '24px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                 <Image 
                  src={successGuide.image_url || "https://pub-4dddd8b2f3784069b2572fc969de004f.r2.dev/qr_code.jpg"} 
                  alt="客服二维码" 
                  width={220}
                  height={220}
                   unoptimized
                   style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
               </div>
            </div>

            <div className={styles.journeyHeader}>{successGuide.body || '🚀 收益之旅'}</div>
            
            <button className={styles.primaryBtn} style={{ background: '#2ecc71', marginTop: '20px' }} onClick={() => router.push('/auth/login')}>
               {getOnboardingAction(successGuide, '截图保存并进入系统')}
            </button>
            {successGuide.sop_text && (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '15px 0 30px', fontWeight: 'bold' }}>{successGuide.sop_text}</p>
            )}
         </div>
      </div>
    );
  }

  return (
    <div className={styles.clayBg}>
      <div className={styles.container}>
        
        {/* Step 1 */}
        {step === 1 && (
          <div className={`${styles.stepEnter}`}>
            {renderSectionHeader(experienceGuide)}
            {experienceGuide.options.map((option) => (
              <div key={option} className={`${styles.clayCard} ${styles.clayBtn}`} onClick={() => setStep(2)}>{option}</div>
            ))}
            
            <div style={{ marginTop: '10px' }}>
                {experienceGuide.body.split('\n').filter(Boolean).map((line, index) => (
                  <div key={line} className={styles.rewardItem} style={{ background: ['#fff0f3', '#f0f7ff', '#fffdf0'][index % 3] }}>
                    <span style={{ fontSize: '1.5rem' }}>{['🎁', '💎', '🔥'][index % 3]}</span>
                    <div><p>{line}</p></div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className={styles.stepEnter}>
            {renderSectionHeader(locationGuide)}
            <div style={{ fontSize: '0.8rem', color: locStatus.includes('成功') ? '#2ecc71' : locStatus.includes('失败') ? '#ef4444' : '#94a3b8', textAlign: 'center', marginBottom: '10px' }}>{locStatus}</div>
            
            <div className={styles.clayCard}>
               <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '5px' }}>省份</label>
               <input type="text" className={styles.clayInput} value={province} onChange={e => setProvince(e.target.value)} placeholder="加载中..." />
               <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', margin: '10px 0 5px' }}>城市</label>
               <input type="text" className={styles.clayInput} value={city} onChange={e => setCity(e.target.value)} placeholder="加载中..." />
            </div>
            <button className={styles.primaryBtn} onClick={handleNext}>{getOnboardingAction(locationGuide, '确认位置')}</button>
          </div>
        )}

        {/* Step 3: Platforms */}
        {step === 3 && (
           <div className={styles.stepEnter}>
             {renderSectionHeader(platformsGuide)}
             <div className={styles.gridLayout}>
                {PLATFORMS.map(p => (
                   <div 
                     key={p.key} 
                     className={`${styles.clayCard} ${styles.platformCard} ${selectedPlatforms.includes(p.key) ? styles.platformSelected : ''}`}
                     onClick={() => togglePlatform(p.key)}
                   >
                     <span>{p.label}</span>
                     <span className={styles.checkUi}>✅</span>
                   </div>
                ))}
             </div>
             {platformsGuide.body && <div className={styles.platformRemind}>{platformsGuide.body}</div>}
             <button className={styles.primaryBtn} onClick={handleNext}>{getOnboardingAction(platformsGuide, '选好了，下一步')}</button>
           </div>
        )}

        {/* Step 4: Accounts Details */}
        {step === 4 && (
           <div className={styles.stepEnter}>
              {renderSectionHeader(accountsGuide, styles.titleXl, styles.tipWarn)}
              
              {selectedPlatforms.map(pKey => {
                 const pLabel = PLATFORMS.find(x => x.key === pKey)?.label;
                 return (
                    <div key={pKey} className={styles.clayCard}>
                       <div className={styles.platformHeader}>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>{pLabel} 账号信息</span>
                          <button className={styles.addBtn} onClick={() => addAccountRow(pKey)}>+</button>
                       </div>
                       
                       {platformAccounts[pKey]?.map((acc, idx) => (
                          <div key={acc.id} style={{ marginTop: idx > 0 ? '15px' : '0' }}>
                             <input 
                               type="text" 
                               className={styles.clayInput} 
                               placeholder="填写正确账号ID"
                               value={acc.value}
                               onChange={(e) => updateAccount(pKey, acc.id, 'value', e.target.value)}
                             />
                             <div className={styles.statusRow}>
                                <button 
                                  className={`${styles.statusBtn} ${acc.isVerified === true ? styles.statusBtnSelected : ''}`}
                                  onClick={() => updateAccount(pKey, acc.id, 'isVerified', true)}
                                >
                                  已实名<span className={styles.statusCheck}>✅</span>
                                </button>
                                <button 
                                  className={`${styles.statusBtn} ${acc.isVerified === false ? styles.statusBtnSelected : ''}`}
                                  onClick={() => updateAccount(pKey, acc.id, 'isVerified', false)}
                                >
                                  未实名<span className={styles.statusCheck}>✅</span>
                                </button>
                             </div>
                             {(!acc.value || acc.isVerified === null) && (
                               <div className={styles.errorHint} style={{ display: 'block' }}>必填项</div>
                             )}
                          </div>
                       ))}
                    </div>
                 );
              })}

              <button className={styles.primaryBtn} onClick={handleNext}>{getOnboardingAction(accountsGuide, '提交信息')}</button>
           </div>
        )}

        {/* Step 5: WeChat */}
        {step === 5 && (
           <div className={styles.stepEnter}>
              {renderSectionHeader(wechatGuide)}
              <div className={styles.clayCard}>
                 <label style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'block', marginBottom: '10px' }}>微信号 (必填)</label>
                 <input 
                    type="text" 
                    className={styles.clayInput} 
                    value={wechatId}
                    onChange={e => setWechatId(e.target.value)}
                    placeholder="方便结算您的现金奖励"
                 />
              </div>
              <button 
                className={styles.primaryBtn} 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                style={{ opacity: isSubmitting ? 0.7 : 1 }}
              >
                 {isSubmitting ? getOnboardingAction(wechatGuide, '正在提交...', 1) : getOnboardingAction(wechatGuide, '提交并获取账号')}
              </button>
           </div>
        )}

      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className={styles.clayBg}><div className={styles.container} style={{textAlign:'center', paddingTop: '50px'}}>加载中...</div></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
