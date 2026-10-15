import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/Form";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "新規登録" };

export default function SignupPage() {
  return (
    <AuthCard title="新規登録">
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">
        すでに登録済みの方は{" "}
        <Link href="/login" className="text-brand underline">
          ログイン
        </Link>
      </p>
    </AuthCard>
  );
}
