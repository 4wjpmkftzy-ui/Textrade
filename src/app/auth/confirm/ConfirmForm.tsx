"use client";

import { useActionState } from "react";
import { FormNotice, SubmitButton } from "@/components/Form";
import { confirmEmail, type FormState } from "@/lib/auth-actions";

export function ConfirmForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(confirmEmail, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormNotice error={state.error} />
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <SubmitButton pending={pending}>確認を完了する</SubmitButton>
    </form>
  );
}
