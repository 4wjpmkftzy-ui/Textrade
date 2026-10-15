// フォームで共通して使う部品(入力欄・送信ボタン・お知らせ表示)。
// 見た目をそろえるため、各画面のフォームはこの部品を組み合わせて作ります。
import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: ReactNode;
};

export function Field({ label, name, hint, ...inputProps }: FieldProps) {
  const id = `field-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        // スマホで文字が小さすぎると画面が勝手に拡大されるため、16px(text-base)にしています
        className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        {...inputProps}
      />
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "処理中…" : children}
    </button>
  );
}

export function FormNotice({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-900">
        {message}
      </p>
    );
  }
  return null;
}

// ログイン画面などで使う、中央寄せのカード型の枠
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 rounded-xl border border-line bg-surface p-5">{children}</div>
    </div>
  );
}
