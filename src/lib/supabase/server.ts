import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

// サーバー側で Supabase を使うための入り口。
// ログイン状態はブラウザの Cookie に保存されているので、それを読み書きできるようにしています。
// 利用者ごとにログイン状態が違うため、毎回新しく作ります(使い回し禁止)。
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // ページの表示中は Cookie を書き込めない決まりがあります。
          // ログイン状態の更新は proxy.ts が担当しているので、ここでは無視して大丈夫です。
        }
      },
    },
  });
}
