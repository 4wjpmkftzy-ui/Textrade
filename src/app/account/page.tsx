import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { FormNotice } from "@/components/Form";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { LoginEmailForm, NicknameForm } from "./AccountForms";

export const metadata: Metadata = { title: "マイページ" };

const NOTICES: Record<string, string> = {
  welcome: "メールアドレスの確認が完了しました。Textrade へようこそ!",
  email_change:
    "確認を受け付けました。今のメールアドレスにも確認メールが届いている場合は、そちらのリンクも開くと変更が完了します。",
};

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold">マイページ</h1>
      {/* ログイン中の利用者の情報は表示のたびに読み込むため、Suspense で囲みます */}
      <Suspense fallback={<p className="mt-6 text-sm text-muted">読み込み中…</p>}>
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AccountContent({ searchParams }: Pick<PageProps<"/account">, "searchParams">) {
  const user = await getCurrentUser();
  // proxy.ts でも確認していますが、念のためここでも確認します
  if (!user) redirect("/login?next=/account");

  const { notice } = await searchParams;
  const noticeText = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <div className="mt-6 space-y-6">
      <FormNotice message={noticeText} />
      {user.suspended && (
        <FormNotice error="このアカウントは利用停止中です。心当たりがない場合は運営までお問い合わせください。" />
      )}

      <Section title="登録情報">
        <dl className="space-y-3 text-sm">
          <Item label="ニックネーム" value={user.nickname} />
          <Item label="所属大学" value={user.universityName ?? "—"} />
          <Item label="ログイン用メールアドレス" value={user.loginEmail} />
          {user.pendingEmail && (
            <Item label="変更手続き中のメールアドレス" value={`${user.pendingEmail}(確認待ち)`} />
          )}
          <Item label="本人確認に使った大学メール" value={user.universityEmail ?? "—"} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          他の利用者に表示されるのは、ニックネームと大学名だけです。
        </p>
      </Section>

      <Section title="ニックネームの変更">
        <NicknameForm current={user.nickname} />
      </Section>

      <Section title="ログイン用メールアドレスの変更">
        <LoginEmailForm />
      </Section>

      <Section title="パスワード">
        <Link href="/account/password" className="text-sm text-brand underline">
          パスワードを変更する
        </Link>
      </Section>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 font-semibold text-muted hover:bg-subtle"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-all">{value}</dd>
    </div>
  );
}
