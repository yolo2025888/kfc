import { NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

const ALLOWED_PLATFORMS = new Set([
  'douyin',
  'xiaohongshu',
  'shipinhao',
  'kuaishou',
  'weibo',
  'xianyu',
]);

type ValidatedAccount = {
  platform: string;
  account_id: string;
  is_verified: boolean;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function randomChar(chars: string) {
  const maxRandomValue = 256 - (256 % chars.length);

  while (true) {
    const random = new Uint8Array(1);
    crypto.getRandomValues(random);

    if (random[0] >= maxRandomValue) continue;
    return chars.charAt(random[0] % chars.length);
  }
}

function generatePassword() {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const letterPart = randomChar(letters).repeat(3);
  const digitPart = randomChar(digits).repeat(3);

  return randomChar('01') === '0'
    ? `${letterPart}${digitPart}`
    : `${digitPart}${letterPart}`;
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createServerAdminClient();
    const body = await request.json();
    const province = normalizeText(body.province, 64);
    const city = normalizeText(body.city, 64);
    const wechat_id = normalizeText(body.wechat_id, 80);
    const invite_code = normalizeText(body.invite_code, 32);
    const accounts: unknown[] = Array.isArray(body.accounts) ? body.accounts : [];

    // Validate essential inputs
    if (!wechat_id) {
      return NextResponse.json({ error: 'WeChat ID is required' }, { status: 400 });
    }

    if (accounts.length > 20) {
      return NextResponse.json({ error: 'Too many platform accounts' }, { status: 400 });
    }

    const validatedAccounts: Array<ValidatedAccount | null> = accounts.map((acc) => {
      const account = acc as { platform?: unknown; account_id?: unknown; is_verified?: unknown };
      const platform = normalizeText(account.platform, 32);
      const accountId = normalizeText(account.account_id, 128);

      if (!ALLOWED_PLATFORMS.has(platform) || !accountId) {
        return null;
      }

      return {
        platform,
        account_id: accountId,
        is_verified: account.is_verified === true
      };
    });

    if (validatedAccounts.some((account: ValidatedAccount | null) => account === null)) {
      return NextResponse.json({ error: 'Invalid platform account' }, { status: 400 });
    }

    // Resolve Invite Code
    let referrerId: string | null = null;
    if (invite_code) {
      const { data: referrer, error: referrerError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('short_id', invite_code)
        .maybeSingle();
      
      if (referrerError) {
        console.error('Invite lookup error:', referrerError);
        return NextResponse.json({ error: 'Failed to verify invite code' }, { status: 500 });
      }

      if (!referrer) {
        return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
      }

      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // 1. Get Next Short ID via RPC
    const { data: shortId, error: seqError } = await supabaseAdmin.rpc('get_next_short_id');
    
    if (seqError || !shortId) {
      console.error('Sequence Error:', seqError);
      return NextResponse.json({ error: 'Failed to generate ID' }, { status: 500 });
    }

    const email = `${shortId}@gmail.com`;
    const password = generatePassword();

    // 2. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: shortId, // Default display name
      }
    });

    if (authError) {
      console.error('Auth Error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 3. Update Profile
    // The 'handle_new_user' trigger likely created the row already. We update it.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: shortId, // Set nickname to the short ID (e.g., a10001)
        short_id: shortId,
        province,
        city,
        wechat_id,
        invited_by: referrerId
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile Error:', profileError);
      // Optional: Cleanup auth user if profile update fails
      // await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to initialize profile' }, { status: 500 });
    }

    // 4. Insert Platform Accounts
    if (accounts.length > 0) {
      const accountsToInsert = validatedAccounts.map((account: ValidatedAccount | null) => ({
        ...account!,
        user_id: userId,
      }));

      const { error: accError } = await supabaseAdmin
        .from('user_platform_accounts')
        .insert(accountsToInsert);

      if (accError) {
        console.error('Accounts Insert Error:', accError);
        // Non-critical: User is created, but accounts failed. 
        // We log it but still return success for the account creation.
      }
    }

    // 5. Success
    return NextResponse.json({
      success: true,
      data: {
        username: shortId,
        password: password,
        email: email
      }
    });

  } catch (e) {
    console.error('Server Error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
