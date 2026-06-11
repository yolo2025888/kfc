export type OnboardingSectionKey =
  | 'experience'
  | 'location'
  | 'platforms'
  | 'accounts'
  | 'wechat'
  | 'success';

export type OnboardingGuideSection = {
  id?: string;
  section_key: OnboardingSectionKey;
  sort_order: number;
  title: string;
  subtitle: string;
  body: string;
  image_url: string;
  sop_text: string;
  options: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

const CUSTOMER_QR_URL = 'https://pub-4dddd8b2f3784069b2572fc969de004f.r2.dev/qr_code.jpg';

export const DEFAULT_ONBOARDING_SECTIONS: OnboardingGuideSection[] = [
  {
    section_key: 'experience',
    sort_order: 10,
    title: '🤔 第一步：你有做过代发吗？',
    subtitle: '如实选择就行，不影响注册',
    body: '发帖奖励：每条作品立得5元基础奖励\n客资收益：有效客资立得2元基础奖励\n高额提成：后端成功获佣100-5000元回报',
    image_url: '',
    sop_text: '不用纠结有没有经验，按真实情况选择即可。',
    options: ['我有做过', '我没做过'],
  },
  {
    section_key: 'location',
    sort_order: 20,
    title: '📍 第二步：确定您的城市 🗺️',
    subtitle: '方便给你发对应的任务',
    body: '',
    image_url: '',
    sop_text: '城市用于匹配区域任务，不会影响注册通过。',
    options: ['确认位置'],
  },
  {
    section_key: 'platforms',
    sort_order: 30,
    title: '📱 第三步：选择可代发的平台',
    subtitle: '',
    body: '💰 多一个平台，多一份收入 💰',
    image_url: '',
    sop_text: '能做哪个选哪个，后面也可以再补充。',
    options: ['选好了，下一步'],
  },
  {
    section_key: 'accounts',
    sort_order: 40,
    title: '📝 第四步：填写对应账号 ID',
    subtitle: '🚨 是账号ID，不是账号昵称！必须准确！',
    body: '',
    image_url: '',
    sop_text: '如果有多个账号，可以点 + 添加。',
    options: ['提交信息'],
  },
  {
    section_key: 'wechat',
    sort_order: 50,
    title: '💬 第五步：填写您的微信号',
    subtitle: '',
    body: '用于结算现金奖励和后续任务对接',
    image_url: '',
    sop_text: '请填写常用微信，方便客服联系和结算。',
    options: ['提交并获取账号', '正在提交...'],
  },
  {
    section_key: 'success',
    sort_order: 60,
    title: '🎉 账号分配成功 🎊',
    subtitle: '👇 添加您的专属客服，方便结算 👇',
    body: '🚀 收益之旅',
    image_url: CUSTOMER_QR_URL,
    sop_text: '⚠️ 务必截图保存，防止丢失 ⚠️',
    options: ['截图保存并进入系统'],
  },
];

const DEFAULT_SECTION_MAP = new Map(
  DEFAULT_ONBOARDING_SECTIONS.map((section) => [section.section_key, section])
);

export function isOnboardingSectionKey(value: string): value is OnboardingSectionKey {
  return DEFAULT_SECTION_MAP.has(value as OnboardingSectionKey);
}

export function normalizeOnboardingOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function mergeOnboardingSections(
  sections: OnboardingGuideSection[]
): OnboardingGuideSection[] {
  const incoming = new Map(sections.map((section) => [section.section_key, section]));

  return DEFAULT_ONBOARDING_SECTIONS.map((fallback) => {
    const section = incoming.get(fallback.section_key);
    if (!section) return fallback;

    return {
      ...fallback,
      ...section,
      title: section.title || fallback.title,
      sort_order: section.sort_order || fallback.sort_order,
      options: section.options.length > 0 ? section.options : fallback.options,
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

export function getOnboardingSection(
  sections: OnboardingGuideSection[],
  key: OnboardingSectionKey
): OnboardingGuideSection {
  return sections.find((section) => section.section_key === key) ?? DEFAULT_SECTION_MAP.get(key)!;
}

export function getOnboardingAction(
  section: OnboardingGuideSection,
  fallback: string,
  index = 0
): string {
  return section.options[index] || fallback;
}
