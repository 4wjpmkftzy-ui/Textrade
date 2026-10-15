"use client";

import { useActionState } from "react";
import { Field, FormNotice, SubmitButton } from "@/components/Form";
import { requestPasswordReset, type FormState } from "@/lib/auth-actions";

export function ForgotForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormNotice error={state.error} message={state.message} />
      <Field
        label="ログイン用のメールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <SubmitButton pending={pending}>再設定用のメールを送る</SubmitButton>
    </form>
  );
}
