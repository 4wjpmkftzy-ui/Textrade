"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormNotice, SubmitButton } from "@/components/Form";
import { signIn, type FormState } from "@/lib/auth-actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormNotice error={state.error} />
      {/* ログイン後に戻るページ(サーバー側で、このサイト内のページかどうかを確認します) */}
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <Field label="パスワード" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton pending={pending}>ログイン</SubmitButton>
      <p className="text-right text-sm">
        <Link href="/password/forgot" className="text-brand underline">
          パスワードを忘れた方
        </Link>
      </p>
    </form>
  );
}
