import { NextResponse } from 'next/server';
import {
  DEFAULT_ONBOARDING_SECTIONS,
  isOnboardingSectionKey,
  mergeOnboardingSections,
  normalizeOnboardingOptions,
  type OnboardingGuideSection,
} from '@/lib/onboarding-guide';
import { createSSRClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type SupabaseLikeError = { message: string };
type OnboardingGuideRow = {
  id: string;
  section_key: string;
  sort_order: number;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  sop_text: string | null;
  options: unknown;
  created_at: string | null;
  updated_at: string | null;
};
type OnboardingGuideQuery = {
  select(columns: string): {
    order(
      column: string,
      options: { ascending: boolean }
    ): Promise<{ data: OnboardingGuideRow[] | null; error: SupabaseLikeError | null }>;
  };
};
type OnboardingGuideClient = {
  from(table: 'onboarding_guide_sections'): OnboardingGuideQuery;
};

function isGuideSection(
  section: OnboardingGuideSection | null
): section is OnboardingGuideSection {
  return section !== null;
}

function toGuideSection(row: OnboardingGuideRow): OnboardingGuideSection | null {
  if (!isOnboardingSectionKey(row.section_key)) return null;

  return {
    id: row.id,
    section_key: row.section_key,
    sort_order: row.sort_order,
    title: row.title,
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    image_url: row.image_url ?? '',
    sop_text: row.sop_text ?? '',
    options: normalizeOnboardingOptions(row.options),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET() {
  try {
    const supabase = (await createSSRClient()) as unknown as OnboardingGuideClient;
    const { data, error } = await supabase
      .from('onboarding_guide_sections')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('Failed to load onboarding guide, using defaults:', error.message);
      return NextResponse.json({ data: DEFAULT_ONBOARDING_SECTIONS });
    }

    return NextResponse.json({
      data: mergeOnboardingSections((data ?? []).map(toGuideSection).filter(isGuideSection)),
    });
  } catch (error) {
    console.warn('Failed to initialize onboarding guide, using defaults:', error);
    return NextResponse.json({ data: DEFAULT_ONBOARDING_SECTIONS });
  }
}
