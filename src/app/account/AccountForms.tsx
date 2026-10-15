"use client";

import { useActionState } from "react";
import { Field, FormNotice, SubmitButton } from "@/components/Form";
import {
  changeLoginEmail,
  updateNickname,
  updatePassword,
  type FormState,
} from "@/lib/auth-actions";

export function NicknameForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateNickname, {});
  return (
    <form action={formAction} className="space-y-3">
      <FormNotice error={state.error} message={state.message} />
      <Field
        label="ニックネーム"
        name="nickname"
        required
        maxLength={20}
        defaultValue={state.values?.nickname ?? current}
      />
      <SubmitButton pending={pending}>ニックネームを変更</SubmitButton>
    </form>
  );
}

export function LoginEmailForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changeLoginEmail, {});
  return (
    <form action={formAction} className="space-y-3">
      <FormNotice error={state.error} message={state.message} />
      <Field
        label="新しいログイン用メールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        hint="卒業すると大学のメールが使えなくなるため、個人のメールアドレスに切り替えておくと安心です。所属大学の表示は変わりません。このアドレスが他の利用者に表示されることはありません。"
      />
      <SubmitButton pending={pending}>確認メールを送る</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={formAction} className="space-y-3">
      <FormNotice error={state.error} message={state.message} />
      <Field
        label="新しいパスワード"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="8文字以上"
      />
      <Field
        label="新しいパスワード(確認のためもう一度)"
        name="password_confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton pending={pending}>パスワードを変更</SubmitButton>
    </form>
  );
}
