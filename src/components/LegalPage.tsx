// 利用規約・プライバシーポリシーで共通して使う「枠」。
// sections の見出しごとに本文を書き込めるようになっています。

type Section = {
  heading: string;
  // 本文が未記入(空)の場合は「ここに本文を記入してください」と表示します
  body?: string;
};

type Props = {
  title: string;
  lastUpdated: string;
  intro?: string;
  sections: Section[];
};

export function LegalPage({ title, lastUpdated, intro, sections }: Props) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">最終更新日:{lastUpdated}</p>
      {intro && <p className="mt-6 leading-relaxed">{intro}</p>}

      <ol className="mt-8 space-y-8">
        {sections.map((section, i) => (
          <li key={section.heading}>
            <h2 className="text-lg font-semibold">
              第{i + 1}条 {section.heading}
            </h2>
            {section.body ? (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{section.body}</p>
            ) : (
              <p className="mt-2 rounded-md border border-dashed border-line bg-subtle p-3 text-sm text-muted">
                (ここに本文を記入してください)
              </p>
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}
