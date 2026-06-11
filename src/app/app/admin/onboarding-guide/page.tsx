'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ExternalLink, ImageIcon, Loader2, MessageSquareText, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_ONBOARDING_SECTIONS,
  mergeOnboardingSections,
  type OnboardingGuideSection,
  type OnboardingSectionKey,
} from '@/lib/onboarding-guide';
import { getErrorMessage } from '@/lib/utils';

type GuideResponse = {
  data?: OnboardingGuideSection[];
  error?: string;
};

const sectionMeta: Record<OnboardingSectionKey, { label: string; helper: string }> = {
  experience: {
    label: '经验问题',
    helper: '第一屏只问一个轻问题，选项建议保持 2 个以内。',
  },
  location: {
    label: '城市问题',
    helper: '说明为什么要填城市，避免用户紧张。',
  },
  platforms: {
    label: '平台选择',
    helper: '提示“能做哪个选哪个”，不要让用户觉得是考试。',
  },
  accounts: {
    label: '账号 ID',
    helper: '重点提醒 ID 与昵称不同，减少后续人工核对成本。',
  },
  wechat: {
    label: '微信结算',
    helper: '说明微信只用于联系和结算，降低填写阻力。',
  },
  success: {
    label: '成功页',
    helper: '管理客服二维码、保存提示和进入系统按钮。',
  },
};

function optionsToText(options: string[]) {
  return options.join('\n');
}

function linesToOptions(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminOnboardingGuidePage() {
  const [sections, setSections] = useState<OnboardingGuideSection[]>(DEFAULT_ONBOARDING_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadGuide = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/onboarding-guide', { cache: 'no-store' });
        const payload = (await res.json()) as GuideResponse;
        if (!res.ok) throw new Error(payload.error || '加载注册引导配置失败');

        setSections(mergeOnboardingSections(payload.data ?? DEFAULT_ONBOARDING_SECTIONS));
      } catch (error) {
        toast({
          title: '加载失败',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, [toast]);

  const updateSection = <K extends keyof OnboardingGuideSection>(
    sectionKey: OnboardingSectionKey,
    field: K,
    value: OnboardingGuideSection[K]
  ) => {
    setSections((prev) =>
      prev.map((section) =>
        section.section_key === sectionKey ? { ...section, [field]: value } : section
      )
    );
  };

  const saveGuide = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/onboarding-guide', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });
      const payload = (await res.json()) as GuideResponse;
      if (!res.ok) throw new Error(payload.error || '保存注册引导配置失败');

      setSections(mergeOnboardingSections(payload.data ?? sections));
      toast({ title: '保存成功', description: '注册引导文案已更新，前台刷新后生效。' });
    } catch (error) {
      toast({
        title: '保存失败',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在加载注册引导配置...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-4">
      <div className="flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-950">注册引导管理</h1>
              <p className="mt-1 text-sm text-gray-500">
                管理每一步的问题、文字、图片、按钮和 SOP 话术，前台仍保持轻量五步。
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/onboarding" target="_blank">
              预览前台 <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          <Button onClick={saveGuide} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存全部
          </Button>
        </div>
      </div>

      <div className="grid gap-5">
        {sections.map((section) => {
          const meta = sectionMeta[section.section_key];

          return (
            <Card key={section.section_key} className="overflow-hidden border-gray-200 shadow-sm">
              <CardHeader className="border-b bg-gray-50/70">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquareText className="h-5 w-5 text-rose-500" />
                    {meta.label}
                    <Badge variant="outline">排序 {section.sort_order}</Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-500">{meta.helper}</p>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 pt-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>问题标题</Label>
                      <Input
                        value={section.title}
                        onChange={(event) =>
                          updateSection(section.section_key, 'title', event.target.value)
                        }
                        placeholder="例如：第一步：你有做过代发吗？"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>辅助说明</Label>
                      <Input
                        value={section.subtitle}
                        onChange={(event) =>
                          updateSection(section.section_key, 'subtitle', event.target.value)
                        }
                        placeholder="一句话降低填写阻力"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>正文说明</Label>
                    <Textarea
                      value={section.body}
                      onChange={(event) =>
                        updateSection(section.section_key, 'body', event.target.value)
                      }
                      placeholder="可填写多行。第一步会按行展示收益说明。"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>选项 / 按钮文案</Label>
                    <Textarea
                      value={optionsToText(section.options)}
                      onChange={(event) =>
                        updateSection(
                          section.section_key,
                          'options',
                          linesToOptions(event.target.value)
                        )
                      }
                      placeholder="一行一个。第一步是选项，其它步骤第一行作为按钮文案。"
                      rows={section.section_key === 'experience' ? 3 : 2}
                    />
                    <p className="text-xs text-gray-500">
                      微信步骤第二行可作为“提交中”文案，成功页第一行作为进入系统按钮文案。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>SOP 话术 / 页面提示</Label>
                    <Textarea
                      value={section.sop_text}
                      onChange={(event) =>
                        updateSection(section.section_key, 'sop_text', event.target.value)
                      }
                      placeholder="给用户看的简短提示，也可作为客服统一话术。"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <ImageIcon className="h-4 w-4" />
                    图片管理
                  </div>
                  <Input
                    value={section.image_url}
                    onChange={(event) =>
                      updateSection(section.section_key, 'image_url', event.target.value)
                    }
                    placeholder="图片 URL，成功页可放客服二维码"
                  />
                  {section.image_url ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-white">
                      <Image
                        src={section.image_url}
                        alt={`${meta.label} 图片预览`}
                        fill
                        unoptimized
                        className="object-contain p-3"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed bg-white text-sm text-gray-400">
                      暂无图片
                    </div>
                  )}
                  <p className="text-xs leading-5 text-gray-500">
                    不填图片时前台不会占位置。注册页建议少图，只在必要说明或成功页二维码使用。
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
