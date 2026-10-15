"use server";

// 会員登録・ログインなど、フォームの送信を受け取ってサーバー側で処理する関数をまとめたファイルです。
// "use server" と書くと、ブラウザからは中身が見えず、サーバー上でだけ実行されます。

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// フォームに返す結果。error はエラー文、message は成功時の案内文です。
// values は入力内容を残すためのもの(パスワードは入れない)。
export type FormState = {
  error?: string;
  message?: string;
  values?: Record<string, string>;
};

const PASSWORD_MIN = 8;
// パスワードの保存方式の都合で、73文字以上は区別されないため上限を設けています
const PASSWORD_MAX = 72;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string): string | null {
  const email = value.toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function checkPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `パスワードは${PASSWORD_MIN}文字以上にしてください`;
  if (password.length > PASSWORD_MAX) return `パスワードは${PASSWORD_MAX}文字以内にしてください`;
  return null;
}

function checkNickname(nickname: string): string | null {
  if (nickname.length < 1 || nickname.length > 20) return "ニックネームは1〜20文字で入力してください";
  return null;
}

// Supabase から返ってくるエラーを、わかりやすい日本語に置き換えます
function friendlyAuthError(code: string | undefined): string {
  switch (code) {
    case "weak_password":
      return "パスワードが簡単すぎます。英字と数字を混ぜるなど、推測されにくいものにしてください";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "短時間に何度も操作されたため、一時的に受け付けを止めています。しばらく待ってからお試しください";
    case "same_password":
      return "今と同じパスワードは設定できません";
    case "email_exists":
      return "このメールアドレスはすでに使われています";
    default:
      return "処理に失敗しました。時間をおいてもう一度お試しください";
  }
}

// ---------------------------------------------------------------------
// 会員登録
// ---------------------------------------------------------------------
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = text(formData, "email");
  const nickname = text(formData, "nickname");
  // パスワードは前後の空白も含めて本人が入力したとおりに扱う
  const password = String(formData.get("password") ?? "");
  const values = { email: rawEmail, nickname };

  if (formData.get("agree") !== "on") {
    return { error: "利用規約とプライバシーポリシーへの同意が必要です", values };
  }
  const email = normalizeEmail(rawEmail);
  if (!email) return { error: "メールアドレスの形式が正しくありません", values };
  const problem = checkNickname(nickname) ?? checkPassword(password);
  if (problem) return { error: problem, values };

  const supabase = await createClient();

  // 対応している大学のメールかどうかを先に確認(最終的なチェックはデータベース側でも行います)
  const { data: universityName, error: lookupError } = await supabase.rpc(
    "university_name_for_email",
    { p_email: email },
  );
  if (lookupError) return { error: friendlyAuthError(undefined), values };
  if (!universityName) {
    return {
      error:
        "このメールアドレスの大学にはまだ対応していません。大学から発行されたメールアドレスを入力してください",
      values,
    };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) {
    if (error.code === "unexpected_failure") {
      // データベース側で登録を拒否した場合(すでに登録済みの大学メールなど)
      return {
        error:
          "このメールアドレスでは登録できませんでした。すでに登録済みの場合は、ログインまたはパスワードの再設定をお試しください",
        values,
      };
    }
    return { error: friendlyAuthError(error.code), values };
  }

  redirect("/signup/sent");
}

// ---------------------------------------------------------------------
// 確認メールのリンクを開いたあと、「確認する」ボタンで実行される処理
//   リンクを開いただけで確認が完了しないようにしているのは、
//   大学のメールシステムがリンクを自動で開いて安全確認をすることがあり、
//   そのときに1回限りの確認コードが使われてしまうのを防ぐためです。
// ---------------------------------------------------------------------
const CONFIRM_DESTINATIONS: Partial<Record<EmailOtpType, string>> = {
  signup: "/account?notice=welcome",
  email: "/account?notice=welcome",
  email_change: "/account?notice=email_change",
  recovery: "/account/password?notice=recovery",
};

export async function confirmEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const tokenHash = text(formData, "token_hash");
  const type = text(formData, "type") as EmailOtpType;
  const destination = CONFIRM_DESTINATIONS[type];
  if (!tokenHash || !destination) {
    return { error: "リンクが正しくありません。メールのリンクをもう一度開いてください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return {
      error:
        "リンクの有効期限が切れているか、すでに使用されています。お手数ですが、もう一度最初からお試しください",
    };
  }

  redirect(destination);
}

// ---------------------------------------------------------------------
// ログイン・ログアウト
// ---------------------------------------------------------------------
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(text(formData, "email"));
  const password = String(formData.get("password") ?? "");
  const values = { email: text(formData, "email") };
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "メールアドレスの確認が済んでいません。届いた確認メールのリンクを開いてください",
        values,
      };
    }
    if (error.code === "invalid_credentials") {
      // どちらが違うかは教えない(他人のアカウントの有無を調べられないようにするため)
      return { error: "メールアドレスまたはパスワードが違います", values };
    }
    return { error: friendlyAuthError(error.code), values };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------
// パスワードを忘れたとき(再設定用のメールを送る)
// ---------------------------------------------------------------------
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = normalizeEmail(text(formData, "email"));
  if (!email) return { error: "メールアドレスの形式が正しくありません", values: { email: text(formData, "email") } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: friendlyAuthError(error.code) };
  }

  // 登録の有無にかかわらず同じ案内を出す(他人のアカウントの有無を調べられないようにするため)
  return {
    message:
      "入力されたメールアドレスが登録されている場合、パスワード再設定用のメールを送りました。メールのリンクから新しいパスワードを設定してください",
  };
}

// ---------------------------------------------------------------------
// マイページでの変更(すべてログイン中の本人だけが実行できる)
// ---------------------------------------------------------------------
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");
  const problem = checkPassword(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "確認用のパスワードが一致しません" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "reauthentication_needed") {
      return { error: "安全のため、一度ログインし直してから変更してください" };
    }
    return { error: friendlyAuthError(error.code) };
  }
  return { message: "パスワードを変更しました" };
}

export async function updateNickname(_prev: FormState, formData: FormData): Promise<FormState> {
  const nickname = text(formData, "nickname");
  const problem = checkNickname(nickname);
  if (problem) return { error: problem, values: { nickname } };

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // データベース側のアクセス制限により、本人の行のニックネームしか変更できません
  const { error } = await supabase.from("profiles").update({ nickname }).eq("id", user.id);
  if (error) return { error: "ニックネームを変更できませんでした", values: { nickname } };
  return { message: "ニックネームを変更しました", values: { nickname } };
}

export async function changeLoginEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(text(formData, "email"));
  const values = { email: text(formData, "email") };
  if (!email) return { error: "メールアドレスの形式が正しくありません", values };

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (email === user.loginEmail) return { error: "現在のログイン用メールと同じです", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: friendlyAuthError(error.code), values };

  return {
    message:
      "確認メールを送りました。メールのリンクを開くと変更が完了します(今のメールアドレスにも確認メールが届いた場合は、両方のリンクを開いてください)",
  };
}
