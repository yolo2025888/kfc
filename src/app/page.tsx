'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useGlobal } from "@/lib/context/GlobalContext";

type RevenueItem = {
  id: string;
  action: string;
  val: string;
};

// Color constants matching the original design
const COLORS = {
  bgCandy: '#F8F9FD',
  kfcRed: '#E4002B',
  dopaminePink: '#FF007A',
  dopamineBlue: '#00E5FF',
  kfcOrange: '#FF8C00',
  textDark: '#1A1A1A',
  glass: 'rgba(255, 255, 255, 0.45)',
};

export default function LandingPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useGlobal();
  const [revenueData, setRevenueData] = useState<RevenueItem[]>([]);

  // Revenue scroll animation
  useEffect(() => {
    document.title = "肯德基素人分发";
    
    // Generate fake data ONLY on client side to prevent hydration mismatch
    const actions = ['作品分佣', '私域转化', '客资奖励'];
    const items = [];
    for (let i = 0; i < 40; i++) {
      items.push({
        id: 'A' + (Math.floor(Math.random() * 5501) + 10000),
        action: actions[Math.floor(Math.random() * actions.length)],
        val: (Math.random() * 200 + 10).toFixed(2)
      });
    }
    setRevenueData(items);

    const scrollBox = scrollRef.current;
    if (!scrollBox) return;

    let posY = 0;
    let animationId: number;

    const animate = () => {
      posY += 0.8;
      // Reset when half of the duplicated content is scrolled
      if (posY >= scrollBox.offsetHeight / 2) posY = 0;
      scrollBox.style.transform = `translateY(-${posY}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, []);

  // 1. Force Body Background & Cleanup
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.setProperty('background-color', COLORS.bgCandy, 'important');
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        @font-face {
          font-family: 'DouyuChase';
          src: url('/my/DouYuZhuiGuangTi/DouYuZhuiGuangTi/douyuFont-2.otf') format('opentype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }
        :root, html, body {
          background-color: ${COLORS.bgCandy} !important;
          font-family: -apple-system, "PingFang SC", sans-serif;
          overflow-x: hidden;
        }
        .douyu-font {
          font-family: 'DouyuChase', sans-serif !important;
        }
        .logo-font {
          font-family: 'DouyuChase', serif !important;
        }
        @keyframes floatPhysics {
          0%, 100% { transform: translateY(0) rotateX(8deg) rotateY(-5deg); }
          50% { transform: translateY(-10px) rotateX(4deg) rotateY(3deg); }
        }
        .animate-floatPhysics {
          animation: floatPhysics 6s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen relative overflow-x-hidden text-[#1A1A1A]">
        {/* Dynamic Background Layer */}
        <div className="fixed inset-0 pointer-events-none z-0" 
             style={{
               backgroundImage: `
                 radial-gradient(circle at 10% 10%, rgba(255, 0, 122, 0.08) 0%, transparent 35%),
                 radial-gradient(circle at 90% 90%, rgba(0, 229, 255, 0.08) 0%, transparent 35%)
               `,
               backgroundAttachment: 'fixed' 
             }} 
        />

        {/* Header */}
        <header className="fixed top-[12px] left-[5%] w-[90%] h-[72px] z-50 flex justify-between items-center">
          <div className="w-full h-full backdrop-blur-[25px] rounded-[50px] border-[2px] border-white flex justify-between items-center px-[25px]"
               style={{ 
                 background: COLORS.glass,
                 boxShadow: '0 15px 35px rgba(255, 0, 122, 0.08)'
               }}>
            <div className="text-[24px] font-[900] italic logo-font" style={{ color: COLORS.kfcRed }}>
              KFCv.com
            </div>
            <div className="flex gap-[10px]">
              {!authLoading && !user && (
                <Link 
                  href="/onboarding" 
                  className="px-[20px] py-[9px] rounded-[12px] text-[13px] font-[800] text-[#1A1A1A] transition-all duration-300 active:scale-95 border-[2px] border-[#1A1A1A] flex items-center"
                >
                  立即注册
                </Link>
              )}
              <Link 
                href={user ? "/app" : "/auth/login"} 
                className="px-[20px] py-[9px] rounded-[12px] text-[13px] font-[800] text-white transition-all duration-300 active:scale-95 flex items-center gap-2"
                style={{ background: COLORS.kfcRed, boxShadow: '0 4px 12px rgba(228, 0, 43, 0.25)' }}
              >
                {authLoading ? '...' : (user ? '进入后台' : '登录系统')}
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="pt-[120px] pb-[40px] px-[5%] flex flex-col lg:flex-row lg:justify-center items-center text-center lg:text-left gap-[60px] relative z-10">
          <div className="flex-none lg:w-[600px]">
            <h1 className="text-[34px] lg:text-[56px] font-black italic leading-[1.1] douyu-font" style={{ color: COLORS.kfcRed }}>
              简单发作品
              <span className="block text-[#1A1A1A] text-[40px] lg:text-[64px] mt-[10px]">每天肯德基自由</span>
            </h1>
            <p className="text-[#888] text-[16px] mt-[15px] font-semibold tracking-[2px]">
              流量精准变现 · 系统收益追踪 · 终身关系绑定
            </p>
          </div>

          {/* 3D Revenue Card */}
          <div 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`relative w-[95%] max-w-[520px] cursor-pointer transition-all duration-700 ${ 
              isFullscreen 
                ? 'fixed top-0 left-0 w-screen h-screen max-w-none z-[9999] m-0 cursor-zoom-out bg-[#F8F9FD]' 
                : 'mt-[40px] lg:mt-0 lg:w-[550px] perspective-2000'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              ...(!isFullscreen ? { perspective: '2000px' } : {})
            }}
          >
            <div 
              className={`transition-all duration-700 ${!isFullscreen ? 'animate-floatPhysics' : ''}`}
              style={!isFullscreen ? {
                transformStyle: 'preserve-3d',
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(20px)',
                border: '2px solid #FFFFFF',
                borderRadius: '32px',
                padding: '25px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.05)',
                transform: 'rotateX(8deg) rotateY(-5deg)'
              } : {
                width: '100%',
                height: '100%',
                padding: '80px 10%',
                border: 'none',
                borderRadius: '0',
                transform: 'rotateX(0deg) rotateY(0deg)'
              }}
            >
              <div className="flex items-center gap-2 mb-[15px] text-[14px] font-black" style={{ color: COLORS.dopaminePink }}>
                <div className="w-[10px] h-[10px] bg-[#00FF00] rounded-full shadow-[0_0_12px_#00FF00] animate-pulse"></div>
                LIVE 实时合作伙伴收益看板
              </div>
              
              <div className="relative overflow-hidden" style={{ height: isFullscreen ? '75vh' : '160px' }}>
                <div ref={scrollRef} className="absolute w-full">
                  {[...revenueData, ...revenueData].map((item, idx) => (
                    <div key={idx} className="flex justify-between py-[12px] border-b border-black/5 text-[14px] font-bold">
                      <span>{item.id}</span>
                      <span>{item.action}</span>
                      <span className="font-black" style={{ color: COLORS.kfcRed }}>¥{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] px-[5%] py-[30px] max-w-[1200px] mx-auto relative z-10">
          {[ 
            { color: COLORS.dopaminePink, title: '领取即发', desc: '专业团队提供素材\n无需思考，直接发布' },
            { color: COLORS.dopamineBlue, title: '多重收益', desc: '现金奖励+高额提成' },
            { color: COLORS.kfcOrange, title: '系统追踪', desc: '客户永久绑定系统' },
            { color: COLORS.kfcRed, title: '门槛极低', desc: '轻松达成长期收益' },
          ].map((f, i) => (
            <div key={i} className="bg-white p-[25px_12px] rounded-[26px] text-center shadow-[0_10px_25px_rgba(0,0,0,0.02)] border-b-[5px] transition-transform hover:-translate-y-[5px]"
                 style={{ borderBottomColor: f.color }}>
              <h3 className="text-[18px] font-black mb-[10px]" style={{ color: COLORS.kfcRed }}>{f.title}</h3>
              <p className="text-[12px] text-[#666] leading-[1.6] whitespace-pre-wrap">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Coop Section */}
        <section className="py-[40px] px-[5%] pb-[50px] text-center relative z-10">
          <h2 className="text-[30px] font-black italic mb-[25px] douyu-font" style={{ color: COLORS.kfcRed }}>合作模式</h2>
          <div className="flex flex-col lg:flex-row lg:justify-center gap-[15px]">
            {[ 
              { title: '发帖奖励', text: '简单发布作品，每条作品立得', tag: '现金', suffix: '基础奖励' },
              { title: '客资收益', text: '获取一个有效客资，立得', tag: '现金', suffix: '' },
              { title: '高额提成', text: '后端转化成功，获得', tag: '100-5000现金', suffix: '佣金回报' },
            ].map((c, i) => (
              <div key={i} className="bg-white p-[22px] rounded-[26px] text-left shadow-[0_15px_30px_rgba(0,0,0,0.03)] border-l-[5px] lg:w-[340px]"
                   style={{ borderLeftColor: COLORS.kfcRed }}>
                <h4 className="font-bold mb-2">{c.title}</h4>
                <p className="text-sm">
                  {c.text} <span className="font-black text-[17px]" style={{ color: COLORS.kfcRed }}>{c.tag}</span> {c.suffix}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Platforms Section */}
        <section className="bg-white pt-[60px] pb-[180px] px-[5%] rounded-t-[50px] text-center relative z-10">
          <div className="text-[26px] lg:text-[42px] font-black italic mb-[45px] leading-[1.3] bg-clip-text text-transparent bg-gradient-to-r from-[#FF007A] to-[#E4002B] douyu-font">
            30w+ 合作伙伴/KOC资源<br/>全域覆盖20+平台！
          </div>
          
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-[20px] lg:gap-[30px] max-w-[1200px] mx-auto">
            {[ 
              { img: 'icon-notice.c2240c49.png', name: '官方公告', border: true },
              { img: 'icon-xiaohongshu.4d3736b1.png', name: '小红书' },
              { img: 'icon-douyin.c5a2bac1.png', name: '抖音' },
              { img: 'icon-shipinhao.3f313201.png', name: '视频号' },
              { img: 'icon-gongzhonghao.38029da6.png', name: '公众号' },
              { img: 'icon-dazhongdianping.933a34ab.png', name: '大众点评' },
              { img: 'icon-weibo.ef5457a6.png', name: '微博' },
              { img: 'icon-bilibili.dcd70662.png', name: 'B站' },
              { img: 'icon-kuaishou.153d8444.png', name: '快手' },
              { img: 'icon-zhihu.c8078b2b.png', name: '知乎' },
              { img: 'icon-toutiao.0f0f8ec5.png', name: '今日头条' },
            ].map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-[10px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`/my/${p.img}`} 
                  alt={p.name}
                  className="w-[54px] h-[54px] lg:w-[72px] lg:h-[72px] rounded-[16px] object-cover shadow-[0_10px_20px_rgba(0,0,0,0.06)]"
                  style={p.border ? { border: `2px solid ${COLORS.kfcRed}`, padding: '3px' } : {}}
                />
                <span className="text-[12px] font-extrabold text-[#444]">{p.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Floating CTA Container */}
        <div className="fixed bottom-[25px] left-0 w-full flex flex-col items-center gap-3 z-[6000] pointer-events-none px-[5%]">
          {!user && !authLoading && (
            <Link href="/onboarding"
                  className="w-full lg:w-[400px] bg-white text-[#1A1A1A] py-[15px] rounded-full text-center text-[18px] font-black italic shadow-lg pointer-events-auto douyu-font border-2 border-[#1A1A1A]"
            >
              新手注册领现金
            </Link>
          )}
          <Link href={user ? "/app" : "/auth/login"}
                className="w-full lg:w-[400px] bg-[#FF8C00] text-white py-[22px] rounded-full text-center text-[24px] font-black italic shadow-lg animate-bounce pointer-events-auto douyu-font"
                style={{ 
                  boxShadow: '0 15px 45px rgba(255, 140, 0, 0.5)' 
                }}>
            {authLoading ? '...' : (user ? '进入后台' : '立即登录 肯德基自由')}
          </Link>
        </div>
      </div>
    </>
  );
}
