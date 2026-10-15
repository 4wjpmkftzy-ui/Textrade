import type { Metadata } from "next";
import { AuthCard } from "@/components/Form";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "パスワードの再設定" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="パスワードの再設定">
      <p className="mb-4 text-sm leading-relaxed text-muted">
        登録しているメールアドレスを入力してください。パスワードを再設定するためのリンクをお送りします。
      </p>
      <ForgotForm />
    </AuthCard>
  );
}
