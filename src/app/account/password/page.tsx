import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormNotice } from "@/components/Form";
import { PasswordForm } from "../AccountForms";

export const metadata: Metadata = { title: "パスワードの変更" };

export default function ChangePasswordPage({ searchParams }: PageProps<"/account/password">) {
  return (
    <AuthCard title="パスワードの変更">
      <Suspense fallback={null}>
        <RecoveryNotice searchParams={searchParams} />
      </Suspense>
      <PasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/account" className="text-brand underline">
          マイページへ戻る
        </Link>
      </p>
    </AuthCard>
  );
}

// パスワード再設定メールから来た場合だけ、案内を表示します
async function RecoveryNotice({ searchParams }: Pick<PageProps<"/account/password">, "searchParams">) {
  const { notice } = await searchParams;
  if (notice !== "recovery") return null;
  return (
    <div className="mb-4">
      <FormNotice message="本人確認ができました。新しいパスワードを設定してください。" />
    </div>
  );
}
