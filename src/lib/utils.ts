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
