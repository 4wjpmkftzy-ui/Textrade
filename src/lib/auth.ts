import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 画面に表示してよい、ログイン中の利用者の情報
export type CurrentUser = {
  id: string;
  nickname: string;
  universityName: string | null;
  // 現在ログインに使っているメールアドレス(本人にだけ表示)
  loginEmail: string;
  // 本人確認に使った大学メール(本人にだけ表示)
  universityEmail: string | null;
  // ログイン用メールの変更を申し込み中で、まだ確認が済んでいない新しいアドレス
  pendingEmail: string | null;
  suspended: boolean;
};

// ログイン中の利用者を取得します(ログインしていなければ null)。
// cache() で囲むと、1回の表示の中で何度呼んでも問い合わせは1回で済みます。
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  // getUser() は Supabase のサーバーに問い合わせて、ログイン状態が本物かを確かめます
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: privateInfo }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, universities(name)")
      .eq("id", user.id)
      .maybeSingle<{ nickname: string; universities: { name: string } | null }>(),
    supabase
      .from("user_private")
      .select("university_email, status")
      .eq("user_id", user.id)
      .maybeSingle<{ university_email: string; status: string }>(),
  ]);

  return {
    id: user.id,
    nickname: profile?.nickname ?? "(未設定)",
    universityName: profile?.universities?.name ?? null,
    loginEmail: user.email ?? "",
    universityEmail: privateInfo?.university_email ?? null,
    pendingEmail: user.new_email ?? null,
    suspended: privateInfo?.status === "suspended",
  };
});
