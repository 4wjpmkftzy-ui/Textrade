"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormNotice, SubmitButton } from "@/components/Form";
import { signUp, type FormState } from "@/lib/auth-actions";

export function SignupForm() {
  // useActionState:フォームを送信し、サーバーからの結果(エラーなど)を受け取る仕組み
  const [state, formAction, pending] = useActionState<FormState, FormData>(signUp, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormNotice error={state.error} />
      <Field
        label="大学のメールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        placeholder="例)xx0000xx@ed.ritsumei.ac.jp"
        hint="本人確認のため、大学から発行されたメールアドレスで登録します。卒業後に備えて、登録後に個人のメールアドレスへ切り替えることもできます。"
      />
      <Field
        label="パスワード"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="8文字以上。大学のメールのパスワードとは別のものにしてください。"
      />
      <Field
        label="ニックネーム"
        name="nickname"
        required
        maxLength={20}
        defaultValue={state.values?.nickname}
        hint="他の利用者に表示されるのは、ニックネームと大学名だけです。本名は入れないことをおすすめします。"
      />
      <label className="flex items-start gap-2 text-sm leading-relaxed">
        <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 accent-brand" />
        <span>
          <Link href="/terms" className="text-brand underline" target="_blank">
            利用規約
          </Link>
          と
          <Link href="/privacy" className="text-brand underline" target="_blank">
            プライバシーポリシー
          </Link>
          に同意します
        </span>
      </label>
      <SubmitButton pending={pending}>登録する</SubmitButton>
    </form>
  );
}
