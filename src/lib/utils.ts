import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRandomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  const charsetLength = charset.length;

  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charsetLength));
  }

  return result;
}

export function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

const INTERNAL_ACCOUNT_DOMAIN = 'gmail.com';
const INTERNAL_ACCOUNT_SUFFIX = `@${INTERNAL_ACCOUNT_DOMAIN}`;

export function toInternalLoginEmail(account: string) {
  const value = account.trim();
  if (!value) return value;
  return value.includes('@') ? value : `${value}${INTERNAL_ACCOUNT_SUFFIX}`;
}

export function displayUserAccount(account?: string | null) {
  const value = account?.trim() || '';
  if (value.toLowerCase().endsWith(INTERNAL_ACCOUNT_SUFFIX)) {
    return value.slice(0, -INTERNAL_ACCOUNT_SUFFIX.length);
  }
  return value;
}

export function getUserInitials(account?: string | null, name?: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const displayAccount = displayUserAccount(account);
  const localAccount = displayAccount.split('@')[0];
  const parts = localAccount.split(/[._-]/).filter(Boolean);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (parts[0] || 'U').slice(0, 2).toUpperCase();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback:', err);
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error("Copy failed:", fallbackErr);
      return false;
    }
  }
}
