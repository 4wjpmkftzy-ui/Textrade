// Supabase に接続するための「住所」と「公開用の鍵」を環境変数から読み込みます。
// 公開用の鍵(publishable key)はブラウザに渡っても問題ない鍵です。
// アクセス制限はデータベース側(RLS)で行っているため、この鍵だけでは他人の情報は読めません。
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を設定してください(.env.local)",
    );
  }
  return { url, key };
}
