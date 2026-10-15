import { SITE_NAME } from "@/lib/site";

const steps = [
  {
    title: "大学メールで登録",
    body: "大学のメールアドレスで本人確認をします。卒業後は個人のメールアドレスでもログインできます。",
  },
  {
    title: "教科書を探す・出品する",
    body: "書名・授業名・教員名で検索できます。表示されるのは同じ大学の出品です。",
  },
  {
    title: "メッセージで相談",
    body: "サイト内のメッセージでやり取りします。連絡先は、あなたが許可するまで相手に表示されません。",
  },
];

// トップページ。機能ができたら、新着の出品などをここに表示します。
export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <section className="py-10">
        <h1 className="text-3xl font-bold leading-tight">
          使い終わった教科書を、
          <br />
          次の学生へ。
        </h1>
        <p className="mt-4 leading-relaxed text-muted">
          {SITE_NAME}
          は、同じ大学の学生同士で中古の教科書を売り買いできるマッチングサイトです。
        </p>
      </section>

      <section className="pb-10">
        <h2 className="text-lg font-semibold">使い方</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pb-12">
        <div className="rounded-lg bg-subtle p-4 text-sm leading-relaxed">
          <h2 className="font-semibold">ご利用にあたって</h2>
          <p className="mt-2 text-muted">
            {SITE_NAME}
            は出会いの場を提供するだけのサービスです。代金の支払いや受け渡しの方法・場所は、当事者同士で話し合って決めてください。
          </p>
        </div>
      </section>
    </div>
  );
}
