import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth/admin';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import {
  DEFAULT_ONBOARDING_SECTIONS,
  isOnboardingSectionKey,
  type OnboardingSectionKey,
  mergeOnboardingSections,
  normalizeOnboardingOptions,
  type OnboardingGuideSection,
} from '@/lib/onboarding-guide';
import { getErrorMessage } from '@/lib/utils';

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
type OnboardingGuideUpsert = {
  section_key: OnboardingSectionKey;
  sort_order: number;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  sop_text: string | null;
  options: string[];
};
type OnboardingGuideQuery = {
  select(columns: string): {
    order(
      column: string,
      options: { ascending: boolean }
    ): Promise<{ data: OnboardingGuideRow[] | null; error: SupabaseLikeError | null }>;
  };
  upsert(records: OnboardingGuideUpsert[], options: { onConflict: string }): {
    select(columns: string): {
      order(
        column: string,
        options: { ascending: boolean }
      ): Promise<{ data: OnboardingGuideRow[] | null; error: SupabaseLikeError | null }>;
    };
  };
};
type OnboardingGuideClient = {
  from(table: 'onboarding_guide_sections'): OnboardingGuideQuery;
};
type OnboardingGuidePayload = {
  sections?: Array<Partial<OnboardingGuideSection>>;
};

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized: Only administrators can perform this action.' },
    { status: 403 }
  );
}

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
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const supabase = createServerAdminClient() as unknown as OnboardingGuideClient;
    const { data, error } = await supabase
      .from('onboarding_guide_sections')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      data: mergeOnboardingSections((data ?? []).map(toGuideSection).filter(isGuideSection)),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await isCurrentUserAdmin())) return unauthorized();

    const payload = (await req.json()) as OnboardingGuidePayload;
    const sections = payload.sections ?? [];

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'No onboarding sections provided' }, { status: 400 });
    }

    const records: OnboardingGuideUpsert[] = sections.map((section, index) => {
      const sectionKey = section.section_key;
      if (!sectionKey || !isOnboardingSectionKey(sectionKey)) {
        throw new Error(`Invalid onboarding section key: ${sectionKey ?? 'empty'}`);
      }

      const fallback = DEFAULT_ONBOARDING_SECTIONS.find((item) => item.section_key === sectionKey);
      const title = (section.title ?? fallback?.title ?? '').trim();
      if (!title) throw new Error(`Title is required for section: ${sectionKey}`);

      return {
        section_key: sectionKey,
        sort_order: section.sort_order ?? fallback?.sort_order ?? (index + 1) * 10,
        title,
        subtitle: section.subtitle?.trim() || null,
        body: section.body?.trim() || null,
        image_url: section.image_url?.trim() || null,
        sop_text: section.sop_text?.trim() || null,
        options: normalizeOnboardingOptions(section.options),
      };
    });

    const supabase = createServerAdminClient() as unknown as OnboardingGuideClient;
    const { data, error } = await supabase
      .from('onboarding_guide_sections')
      .upsert(records, { onConflict: 'section_key' })
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      data: mergeOnboardingSections((data ?? []).map(toGuideSection).filter(isGuideSection)),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
