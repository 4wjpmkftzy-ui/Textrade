import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/Form";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "ログイン" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard title="ログイン">
      {/* URLの「?next=...」を読む部分は、表示のたびに変わるので Suspense で囲みます */}
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        はじめての方は{" "}
        <Link href="/signup" className="text-brand underline">
          新規登録
        </Link>
      </p>
    </AuthCard>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
