-- =====================================================================
-- Textrade 初期データベース設計
--
-- 【この ファイルの役割】
--  データベースに「どんな表(テーブル)を作るか」と
--  「誰がどのデータを見たり書き換えたりできるか(アクセス制限)」を定義します。
--
-- 【セキュリティの基本方針】
--  ・全テーブルで行単位のアクセス制限(RLS)を有効にし、許可したものだけ通す
--  ・メールアドレスや連絡先は user_private に分けて保存し、本人以外は直接読めない
--  ・連絡先は「本人が開示を許可した取引相手」にだけ、専用の関数経由で渡す
--  ・管理者権限や利用停止の状態は、本人が書き換えられない
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 大学と、大学ごとのメールドメイン
-- ---------------------------------------------------------------------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

-- 1つの大学が複数のドメインを持てるように別の表にしています
create table public.university_domains (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete restrict,
  -- 例: ed.ritsumei.ac.jp(@ は付けない・小文字)
  domain text not null unique
    check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  -- false にすると新規登録を受け付けなくなる(登録済みユーザーには影響しない)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. ユーザー
--   profiles     … 他の利用者にも見える情報(ニックネームと所属大学のみ)
--   user_private … 本人と管理者しか見られない情報(メール・連絡先・権限など)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  university_id uuid not null references public.universities (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 本人確認に使った大学メール。同じ大学メールで複数アカウントは作れない
  university_email text not null unique check (university_email = lower(university_email)),
  university_verified_at timestamptz,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason text,
  -- 取引相手に開示できる連絡先(すべて任意)
  contact_paypay_id text check (char_length(contact_paypay_id) <= 50),
  contact_line_id text check (char_length(contact_line_id) <= 50),
  contact_email text check (char_length(contact_email) <= 254),
  contact_note text check (char_length(contact_note) <= 200),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. 権限チェック用の関数
--   security definer = アクセス制限を一時的に越えて判定だけ行う関数。
--   search_path を空にして、なりすまし用の関数を差し込まれないようにしています。
-- ---------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_private
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- 利用停止されておらず、大学メールの確認が済んでいるユーザーか
create function public.is_active_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_private
    where user_id = auth.uid() and status = 'active' and university_verified_at is not null
  );
$$;

-- ログイン中のユーザーの所属大学(利用停止中は null)
create function public.my_university_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.university_id
  from public.profiles p
  join public.user_private up on up.user_id = p.id
  where p.id = auth.uid() and up.status = 'active' and up.university_verified_at is not null;
$$;

-- 写真の保存パス「{出品ID}/ファイル名」から出品IDを取り出す(形式が違えば null)
create function public.listing_id_from_path(p_path text) returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when split_part(p_path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_path, '/', 1)::uuid
  end;
$$;

-- 登録画面用:メールアドレスが対応大学のものなら大学名を返す(未対応なら null)
create function public.university_name_for_email(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  select u.name
  from public.university_domains d
  join public.universities u on u.id = d.university_id
  where d.domain = lower(split_part(p_email, '@', 2)) and d.is_active;
$$;

-- updated_at を自動更新する共通の仕組み
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger user_private_touch before update on public.user_private
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. 会員登録時の処理
--   ・メールのドメインが対応大学に登録されていなければ登録を拒否
--   ・ドメインから所属大学を自動判定して profiles / user_private を作成
--   ・メール確認が完了したら university_verified_at を記録
-- ---------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_domain text;
  v_university_id uuid;
  v_nickname text;
begin
  v_domain := lower(split_part(new.email, '@', 2));

  select d.university_id into v_university_id
  from public.university_domains d
  where d.domain = v_domain and d.is_active;

  if v_university_id is null then
    raise exception 'UNSUPPORTED_EMAIL_DOMAIN' using errcode = 'P0001';
  end if;

  v_nickname := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
  if char_length(v_nickname) not between 1 and 20 then
    raise exception 'INVALID_NICKNAME' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, nickname, university_id)
  values (new.id, v_nickname, v_university_id);

  insert into public.user_private (user_id, university_email, university_verified_at)
  values (new.id, lower(new.email), new.email_confirmed_at);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_confirmed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- 最初の確認(=大学メールの確認)のときだけ記録する。
  -- 後で個人メールに切り替えても、所属大学の情報は変わらない。
  update public.user_private
  set university_verified_at = new.email_confirmed_at
  where user_id = new.id and university_verified_at is null;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_email_confirmed();

-- ---------------------------------------------------------------------
-- 5. 出品
-- ---------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- 出品者の所属大学が自動で入る(本人が書き換えることはできない)
  university_id uuid not null references public.universities (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  course_name text check (char_length(course_name) <= 100),
  instructor_name text check (char_length(instructor_name) <= 100),
  -- 価格は円単位の整数(小数の計算誤差を避けるため)
  price integer not null check (price between 0 and 100000),
  condition text not null
    check (condition in ('like_new', 'no_writing', 'some_writing', 'heavy_writing')),
  has_highlighting boolean not null default false,
  payment_methods text[] not null default '{paypay}'
    check (cardinality(payment_methods) >= 1
           and payment_methods <@ array['paypay', 'cash', 'negotiable']),
  description text check (char_length(description) <= 2000),
  -- active=出品中 / reserved=取引中 / sold=売却済み / withdrawn=本人が取り下げ / removed=管理者が削除
  status text not null default 'active'
    check (status in ('active', 'reserved', 'sold', 'withdrawn', 'removed')),
  removed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_university_status_idx on public.listings (university_id, status, created_at desc);
create index listings_seller_idx on public.listings (seller_id);

create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

-- 出品者・所属大学・削除状態を、本人が不正に書き換えられないようにする
create function public.guard_listing_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.seller_id := auth.uid();
    new.university_id := public.my_university_id();
    if new.university_id is null then
      raise exception 'NOT_ALLOWED' using errcode = '42501';
    end if;
    new.status := 'active';
    new.removed_reason := null;
    return new;
  end if;

  -- UPDATE
  new.seller_id := old.seller_id;
  new.university_id := old.university_id;
  new.created_at := old.created_at;
  if not public.is_admin() then
    if old.status = 'removed' or new.status = 'removed' then
      raise exception 'NOT_ALLOWED' using errcode = '42501';
    end if;
    new.removed_reason := old.removed_reason;
  end if;
  return new;
end;
$$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function public.guard_listing_write();

-- 出品写真(画像ファイル本体は Storage に、ここには保存場所だけ記録)
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Storage 上のパス。形式: {listing_id}/{ファイル名}
  storage_path text not null unique,
  position smallint not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = listing_id::text)
);

create index listing_images_listing_idx on public.listing_images (listing_id, position);

-- その出品を見てよいか(写真やメッセージの権限判定にも使う)
create function public.can_view_listing(p_listing_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (
        l.seller_id = auth.uid()
        or public.is_admin()
        or (l.status in ('active', 'reserved', 'sold')
            and l.university_id = public.my_university_id())
      )
  );
$$;

create function public.owns_listing(p_listing_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing_id and l.seller_id = auth.uid() and l.status <> 'removed'
  ) and public.is_active_member();
$$;

-- ---------------------------------------------------------------------
-- 6. メッセージ(購入希望者 ⇔ 出品者)
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id);
create index conversations_seller_idx on public.conversations (seller_id);

-- 新しいやり取りを始めるときのチェック
create function public.guard_conversation_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_listing public.listings;
begin
  select * into v_listing from public.listings where id = new.listing_id;
  if v_listing.id is null
     or v_listing.status <> 'active'
     or v_listing.university_id is distinct from public.my_university_id()
     or v_listing.seller_id = auth.uid() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  new.buyer_id := auth.uid();
  new.seller_id := v_listing.seller_id;
  return new;
end;
$$;

create trigger conversations_guard before insert on public.conversations
  for each row execute function public.guard_conversation_insert();

create function public.is_conversation_member(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- 連絡先の開示許可(このやり取りの相手に、自分の連絡先を見せてよいか)
create table public.contact_disclosures (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- 相手が開示を許可している場合だけ、相手の連絡先を返す
create function public.get_partner_contact(p_conversation_id uuid)
returns table (paypay_id text, line_id text, email text, note text)
language sql stable security definer set search_path = ''
as $$
  select up.contact_paypay_id, up.contact_line_id, up.contact_email, up.contact_note
  from public.conversations c
  join public.contact_disclosures d
    on d.conversation_id = c.id
   and d.user_id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  join public.user_private up on up.user_id = d.user_id
  where c.id = p_conversation_id
    and auth.uid() in (c.buyer_id, c.seller_id)
    and public.is_active_member();
$$;

-- ---------------------------------------------------------------------
-- 7. 取引記録(将来のオンライン決済・手数料に備えた表)
--   今は「誰と取引が成立したか」の記録に使い、決済関連の列は将来使います。
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete restrict,
  conversation_id uuid references public.conversations (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  seller_id uuid not null references public.profiles (id) on delete restrict,
  amount integer not null check (amount >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  -- offline = 当事者同士で支払い(PayPay送金・現金など)。将来 'online' を追加
  payment_channel text not null default 'offline' check (payment_channel in ('offline')),
  payment_status text not null default 'not_applicable'
    check (payment_status in ('not_applicable')),
  external_payment_id text,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index transactions_buyer_idx on public.transactions (buyer_id);
create index transactions_seller_idx on public.transactions (seller_id);

-- ---------------------------------------------------------------------
-- 8. 通報と、管理者の操作記録
-- ---------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (reporter_id, listing_id)
);

create table public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

-- 管理者専用の操作(実行のたびに記録を残す)
create function public.admin_remove_listing(p_listing_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  update public.listings set status = 'removed', removed_reason = p_reason where id = p_listing_id;
  update public.reports set status = 'resolved' where listing_id = p_listing_id;
  insert into public.admin_actions (admin_id, action, target_id, detail)
  values (auth.uid(), 'remove_listing', p_listing_id, p_reason);
end;
$$;

create function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() or p_user_id = auth.uid() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  update public.user_private
  set status = p_status,
      suspended_reason = case when p_status = 'suspended' then p_reason end
  where user_id = p_user_id;
  insert into public.admin_actions (admin_id, action, target_id, detail)
  values (auth.uid(), 'set_user_status:' || p_status, p_user_id, p_reason);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. アクセス制限(RLS)
--   まず全員の権限を取り消し、必要なものだけ許可します。
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.universities enable row level security;
alter table public.university_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.user_private enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.contact_disclosures enable row level security;
alter table public.transactions enable row level security;
alter table public.reports enable row level security;
alter table public.admin_actions enable row level security;

-- 画面側から呼び出してよい関数
grant execute on function public.university_name_for_email(text) to anon, authenticated;
grant execute on function
  public.listing_id_from_path(text),
  public.is_admin(), public.is_active_member(), public.my_university_id(),
  public.can_view_listing(uuid), public.owns_listing(uuid),
  public.is_conversation_member(uuid), public.get_partner_contact(uuid),
  public.admin_remove_listing(uuid, text), public.admin_set_user_status(uuid, text, text)
to authenticated;

-- 大学:ログインした人は大学名を読める。管理者だけが追加・変更
grant select on public.universities to authenticated;
grant insert, update, delete on public.universities to authenticated;
create policy universities_select on public.universities for select to authenticated using (true);
create policy universities_admin_write on public.universities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 大学ドメイン:管理者のみ。登録画面での判定はサーバー側で行う
grant select, insert, update, delete on public.university_domains to authenticated;
create policy domains_admin on public.university_domains for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- プロフィール:ログインした利用者は読める(ニックネームと大学のみ)。本人はニックネームだけ変更可
grant select on public.profiles to authenticated;
grant update (nickname) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_active_member());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_member())
  with check (id = auth.uid());

-- 非公開情報:本人と管理者だけが読める。本人は連絡先だけ変更可
grant select on public.user_private to authenticated;
grant update (contact_paypay_id, contact_line_id, contact_email, contact_note)
  on public.user_private to authenticated;
create policy user_private_select on public.user_private for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy user_private_update_own on public.user_private for update to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (user_id = auth.uid());

-- 出品:同じ大学の出品と自分の出品が見える。追加・編集は本人のみ
grant select, insert on public.listings to authenticated;
grant update (title, course_name, instructor_name, price, condition, has_highlighting,
              payment_methods, description, status)
  on public.listings to authenticated;
create policy listings_select on public.listings for select to authenticated
  using (public.can_view_listing(id));
create policy listings_insert on public.listings for insert to authenticated
  with check (public.is_active_member());
create policy listings_update_own on public.listings for update to authenticated
  using (public.owns_listing(id))
  with check (seller_id = auth.uid());

-- 出品写真
grant select, insert, delete on public.listing_images to authenticated;
create policy listing_images_select on public.listing_images for select to authenticated
  using (public.can_view_listing(listing_id));
create policy listing_images_insert on public.listing_images for insert to authenticated
  with check (public.owns_listing(listing_id));
create policy listing_images_delete on public.listing_images for delete to authenticated
  using (public.owns_listing(listing_id) or public.is_admin());

-- やり取り:当事者だけが見られる
grant select, insert on public.conversations to authenticated;
create policy conversations_select on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
create policy conversations_insert on public.conversations for insert to authenticated
  with check (public.is_active_member());

-- メッセージ:当事者だけが読み書きできる(送信後の編集・削除は不可)
grant select, insert (conversation_id, body) on public.messages to authenticated;
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid()
              and public.is_conversation_member(conversation_id)
              and public.is_active_member());

-- 連絡先の開示許可:当事者が自分の分だけ追加・取り消しできる
grant select, insert (conversation_id), delete on public.contact_disclosures to authenticated;
create policy disclosures_select on public.contact_disclosures for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy disclosures_insert on public.contact_disclosures for insert to authenticated
  with check (user_id = auth.uid()
              and public.is_conversation_member(conversation_id)
              and public.is_active_member());
create policy disclosures_delete on public.contact_disclosures for delete to authenticated
  using (user_id = auth.uid());

-- 取引記録:当事者と管理者が読める(作成はサーバー側の処理で行う)
grant select on public.transactions to authenticated;
create policy transactions_select on public.transactions for select to authenticated
  using (auth.uid() in (buyer_id, seller_id) or public.is_admin());

-- 通報:利用者は送信のみ。内容は管理者だけが見られる
grant select, insert (listing_id, reason), update (status) on public.reports to authenticated;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid()
              and public.is_active_member()
              and public.can_view_listing(listing_id));
create policy reports_admin_select on public.reports for select to authenticated
  using (public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 管理者の操作記録:管理者だけが読める
grant select on public.admin_actions to authenticated;
create policy admin_actions_select on public.admin_actions for select to authenticated
  using (public.is_admin());

-- 今後作るテーブル・関数にも、自動で権限が付かないようにする
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. 写真の保存場所(Storage)
--   非公開の保管場所にし、出品を見る権限がある人だけが写真を取得できる
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', false, 2097152, array['image/webp', 'image/jpeg']);

create policy listing_images_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'listing-images'
         and public.can_view_listing(public.listing_id_from_path(name)));
create policy listing_images_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images'
              and public.owns_listing(public.listing_id_from_path(name)));
create policy listing_images_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images'
         and (public.owns_listing(public.listing_id_from_path(name)) or public.is_admin()));

-- ---------------------------------------------------------------------
-- 11. 最初のデータ:立命館大学(@ed.ritsumei.ac.jp)
-- ---------------------------------------------------------------------
with u as (
  insert into public.universities (name) values ('立命館大学') returning id
)
insert into public.university_domains (university_id, domain)
select id, 'ed.ritsumei.ac.jp' from u;
