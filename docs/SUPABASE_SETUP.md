# Supabase の設定手順

Supabase の管理画面(https://supabase.com/dashboard)で行う作業をまとめています。
上から順番に進めてください。

## 1. データベースの設計図を適用する

`supabase/migrations/` にあるファイルを、**ファイル名の古い順に**実行します。

1. 管理画面の左メニューから **SQL Editor** を開く
2. 「New query」で空のエディタを開く
3. `20261015000000_initial_schema.sql` の中身をすべて貼り付けて **Run**
4. もう一度「New query」を開き、`20261015010000_delete_unverified_users.sql` を貼り付けて **Run**

> 同じファイルを2回実行するとエラーになります(「すでに存在します」という意味なので、データは壊れません)。

### 定期実行(pg_cron)の確認
2つ目のファイルは、未確認アカウントを1時間ごとに削除する予約をします。
pg_cron(定期実行の仕組み)もこのファイルが自動で有効にするので、事前の操作は不要です。
実行後、SQL Editor で次を実行して確認します。

```sql
select jobname, schedule from cron.job;
```

`delete-unverified-users` と `23 * * * *` が表示されれば成功です。

## 2. 会員登録・ログインの設定(Authentication)

### Sign In / Providers → Email
- **Confirm email**:オン(大学メールの確認に必須)
- **Secure email change**:オン(メール変更時に新旧両方で確認)
- **Minimum password length**:8
- **Email OTP Expiration**:3600(確認リンクの有効期限=1時間。Supabase の推奨どおり1時間以内にする)

### URL Configuration
- **Site URL**:サイトのURL(例:`https://textrade.vercel.app`。手元で試すときは `http://localhost:3000`)
- **Redirect URLs**:上と同じURLを追加

### Emails → SMTP Settings(先に設定する)
Supabase 標準のメール送信は、チームのメンバー宛てにしか届かず、文面も編集できません。
そのため、先に Resend をメール送信に使う設定をします。

1. Resend で API キーを作る(API Keys → Create API Key、Permission: Sending access、Domain: `textrade.app`)
2. Supabase の Authentication → Emails → SMTP Settings に入力する

| 欄 | 値 |
|---|---|
| Sender email | `no-reply@textrade.app` |
| Sender name | `Textrade` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend の API キー(`re_...`。チャットや画像に出さない) |

### Emails → Templates
確認メールのリンク先を、このサイトの確認ページ(`/auth/confirm`)に変更します。
本文は **Source** に切り替えてから貼り付けます(ブラウザの自動翻訳はオフにする)。

**Confirm sign up**(件名:`【Textrade】メールアドレスの確認`)
```html
<p>Textrade へのご登録ありがとうございます。</p>
<p>下のリンクを開き、表示された画面で「確認を完了する」を押してください。リンクの有効期限は1時間です。</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">メールアドレスを確認する</a></p>
<p>心当たりがない場合は、このメールを破棄してください。</p>
```

**Change email address**(件名:`【Textrade】メールアドレス変更の確認`)
```html
<p>Textrade のログイン用メールアドレスの変更を受け付けました。</p>
<p>下のリンクを開き、表示された画面で「確認を完了する」を押してください。リンクの有効期限は1時間です。</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">変更を確認する</a></p>
<p>心当たりがない場合は、このメールを破棄してください。</p>
```

**Reset password**(件名:`【Textrade】パスワードの再設定`)
```html
<p>Textrade のパスワード再設定のご依頼を受け付けました。</p>
<p>下のリンクを開き、表示された画面で「確認を完了する」を押すと、新しいパスワードを設定できます。リンクの有効期限は1時間です。</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">パスワードを再設定する</a></p>
<p>心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。</p>
```

> **なぜリンクを開いただけで確認しないの?**
> 大学のメールシステムには、届いたリンクを自動で開いて安全確認するものがあります。
> そのときに1回限りの確認コードが使われてしまうと、本人がリンクを開いても失敗します。
> そこで、確認ページでボタンを押したときに確認する仕組みにしています。

## 3. サイト側に接続情報を設定する

**Project Settings → API Keys** と **Data API** から値を確認し、設定します。

| 名前 | 中身 | 公開してよいか |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL(`https://xxxx.supabase.co`) | はい |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key(`sb_publishable_...`) | はい |
| `SUPABASE_SECRET_KEY` | Secret key(`sb_secret_...`) | **いいえ。絶対に公開しない** |

- 手元のパソコン:プロジェクトのフォルダに `.env.local` を作って `名前=値` の形で書く(Git には保存されません)
- Vercel:Project Settings → Environment Variables に同じ名前で登録
- 段階3の時点では Secret key は使っていません(管理画面などで必要になったら使います)
