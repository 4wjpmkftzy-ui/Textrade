-- アクセス制限(RLS)のテスト。
-- 「他人の情報が見えないか」「不正な書き換えができないか」を、いろいろな立場から試します。
-- 実行方法は supabase/tests/run_local.sh を参照してください。

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------- テスト用の道具 ----------
create schema t;
grant usage on schema t to anon, authenticated;

create function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'NG: %', label; end if;
  raise notice 'OK: %', label;
end $$;

create function t.throws(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'OK: % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'NG: % (エラーにならなかった)', label;
end $$;

create function t.cnt(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) x', sql) into n;
  return n;
end $$;

grant execute on all functions in schema t to anon, authenticated;

-- ---------- 準備(管理者権限で実行) ----------
with u as (insert into public.universities (name) values ('テスト大学') returning id)
insert into public.university_domains (university_id, domain) select id, 'test.ac.jp' from u;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'Alice@ed.ritsumei.ac.jp', now(), '{"nickname":"あり"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@ed.ritsumei.ac.jp',   now(), '{"nickname":"ぼぶ"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.ac.jp',        now(), '{"nickname":"きゃろる"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@ed.ritsumei.ac.jp',  null,  '{"nickname":"でいぶ"}'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@ed.ritsumei.ac.jp', now(), '{"nickname":"かんり"}');
update public.user_private set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000e';
update public.user_private
  set contact_paypay_id = 'alice-paypay', contact_line_id = 'alice-line'
  where user_id = '00000000-0000-0000-0000-00000000000a';

select t.ok((select university_email from public.user_private
             where user_id = '00000000-0000-0000-0000-00000000000a') = 'alice@ed.ritsumei.ac.jp',
            '大学メールは小文字で保存される');
select t.ok((select u.name from public.profiles p join public.universities u on u.id = p.university_id
             where p.id = '00000000-0000-0000-0000-00000000000c') = 'テスト大学',
            'メールのドメインから所属大学が自動判定される');
select t.throws($$insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
                  values ('x@gmail.com', now(), '{"nickname":"x"}')$$,
                '対応していないドメインでは登録できない');
select t.throws($$insert into auth.users (email, raw_user_meta_data)
                  values ('ALICE@ed.ritsumei.ac.jp', '{"nickname":"偽"}')$$,
                '同じ大学メールで2つ目のアカウントは作れない');
select t.throws($$insert into auth.users (email) values ('nonick@ed.ritsumei.ac.jp')$$,
                'ニックネームなしでは登録できない');

-- メール確認で university_verified_at が入る
update auth.users set email_confirmed_at = now() where email = 'dave@ed.ritsumei.ac.jp';
select t.ok((select university_verified_at is not null from public.user_private
             where user_id = '00000000-0000-0000-0000-00000000000d'), 'メール確認後に認証済みになる');
update auth.users set email_confirmed_at = null where email = 'dave@ed.ritsumei.ac.jp';
update public.user_private set university_verified_at = null
  where user_id = '00000000-0000-0000-0000-00000000000d';

-- ---------- 未ログイン(anon) ----------
set role anon;
select t.throws('select * from public.listings', '未ログインでは出品を読めない');
select t.throws('select * from public.profiles', '未ログインではプロフィールを読めない');
select t.ok(public.university_name_for_email('a@ed.ritsumei.ac.jp') = '立命館大学',
            '登録画面で大学名を判定できる');
select t.ok(public.university_name_for_email('a@gmail.com') is null, '未対応ドメインは null');
reset role;

-- ---------- アリス(出品者) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

insert into public.listings (id, seller_id, university_id, title, course_name, instructor_name, price, condition, status)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-00000000000b',          -- 他人になりすまそうとしても…
        (select id from public.universities where name = 'テスト大学'),
        '線形代数入門', '線形代数I', '山田', 1500, 'no_writing', 'removed');
select t.ok((select seller_id = '00000000-0000-0000-0000-00000000000a'
                    and status = 'active'
                    and university_id = (select id from public.universities where name = '立命館大学')
             from public.listings where id = '11111111-1111-1111-1111-111111111111'),
            '出品者・大学・状態は自動で正しく設定される');

select t.throws($$update public.listings set status = 'removed'
                  where id = '11111111-1111-1111-1111-111111111111'$$,
                '出品者は「管理者削除」状態にできない');
select t.throws($$update public.user_private set role = 'admin'$$, '自分を管理者にできない');
select t.throws($$update public.user_private set status = 'active'$$, '利用停止状態を自分で変えられない');
select t.throws($$update public.profiles set university_id = university_id$$, '所属大学を自分で変えられない');
select t.ok(t.cnt($$select 1 from public.university_domains$$) = 0, '一般ユーザーはドメイン一覧を見られない');
select t.throws($$insert into public.university_domains (university_id, domain)
                  select id, 'evil.example.com' from public.universities limit 1$$,
                '一般ユーザーはドメインを追加できない');
select t.throws($$select public.admin_remove_listing('11111111-1111-1111-1111-111111111111', 'x')$$,
                '一般ユーザーは管理者用の操作を実行できない');

-- 写真のアップロード
insert into storage.objects (bucket_id, name)
  values ('listing-images', '11111111-1111-1111-1111-111111111111/a.webp');
select t.ok(true, '自分の出品には写真を追加できる');
reset role;

-- ---------- ボブ(同じ大学の購入希望者) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;

select t.ok(t.cnt('select 1 from public.listings') = 1, '同じ大学の出品は見える');
select t.ok(t.cnt($$select 1 from storage.objects where bucket_id = 'listing-images'$$) = 1,
            '同じ大学の出品の写真は見える');
select t.ok(t.cnt('select 1 from public.user_private') = 1, '非公開情報は自分の分しか見えない');
select t.throws($$select university_email from public.profiles$$, 'プロフィールからメールは取れない');
update public.listings set price = 1 where id = '11111111-1111-1111-1111-111111111111';
select t.ok((select price from public.listings where id = '11111111-1111-1111-1111-111111111111') = 1500,
            '他人の出品は書き換えられない');
select t.throws($$insert into storage.objects (bucket_id, name)
                  values ('listing-images', '11111111-1111-1111-1111-111111111111/evil.webp')$$,
                '他人の出品に写真を追加できない');
select t.throws($$insert into storage.objects (bucket_id, name) values ('listing-images', 'bad-path.webp')$$,
                '形式の違うパスには保存できない');

insert into public.conversations (id, listing_id)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
insert into public.messages (conversation_id, body)
  values ('22222222-2222-2222-2222-222222222222', 'まだ購入できますか?');
select t.ok(t.cnt($$select 1 from public.get_partner_contact('22222222-2222-2222-2222-222222222222')$$) = 0,
            '相手が許可するまで連絡先は見えない');
select t.throws($$insert into public.contact_disclosures (conversation_id, user_id)
                  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000a')$$,
                '相手の代わりに開示許可を出せない');
select t.throws($$insert into public.messages (conversation_id, sender_id, body)
                  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000a', '偽')$$,
                '相手になりすましてメッセージを送れない');
select t.throws($$update public.messages set body = '改ざん'$$, '送信済みメッセージは書き換えられない');
reset role;

-- ---------- キャロル(別の大学) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select t.ok(t.cnt('select 1 from public.listings') = 0, '別の大学の出品は見えない');
select t.ok(t.cnt($$select 1 from storage.objects$$) = 0, '別の大学の出品の写真は見えない');
select t.ok(t.cnt('select 1 from public.conversations') = 0, '他人のやり取りは見えない');
select t.ok(t.cnt('select 1 from public.messages') = 0, '他人のメッセージは見えない');
select t.throws($$insert into public.conversations (listing_id) values ('11111111-1111-1111-1111-111111111111')$$,
                '別の大学の出品には連絡できない');
select t.throws($$insert into public.messages (conversation_id, body)
                  values ('22222222-2222-2222-2222-222222222222', '割り込み')$$,
                '他人のやり取りにメッセージを送れない');
select t.ok(t.cnt($$select 1 from public.get_partner_contact('22222222-2222-2222-2222-222222222222')$$) = 0,
            '他人のやり取りの連絡先は取れない');
reset role;

-- ---------- デイブ(メール未確認) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
select t.ok(t.cnt('select 1 from public.listings') = 0, 'メール未確認では出品が見えない');
select t.throws($$insert into public.listings (title, price, condition) values ('x', 100, 'like_new')$$,
                'メール未確認では出品できない');
reset role;

-- ---------- アリスが連絡先を開示 ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select t.ok(t.cnt('select 1 from public.messages') = 1, '出品者は届いたメッセージを読める');
insert into public.contact_disclosures (conversation_id) values ('22222222-2222-2222-2222-222222222222');
select t.ok(t.cnt($$select 1 from public.get_partner_contact('22222222-2222-2222-2222-222222222222')$$) = 0,
            'ボブが許可していないので、アリスにはボブの連絡先は見えない');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select t.ok((select paypay_id from public.get_partner_contact('22222222-2222-2222-2222-222222222222')) = 'alice-paypay',
            '許可された相手には連絡先(PayPay ID)が見える');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
delete from public.contact_disclosures where conversation_id = '22222222-2222-2222-2222-222222222222';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select t.ok(t.cnt($$select 1 from public.get_partner_contact('22222222-2222-2222-2222-222222222222')$$) = 0,
            '開示を取り消すと再び見えなくなる');
reset role;

-- ---------- 管理者 ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select t.ok(t.cnt('select 1 from public.university_domains') = 2, '管理者はドメイン一覧を見られる');
insert into public.university_domains (university_id, domain)
  select id, 'st.ritsumei.ac.jp' from public.universities where name = '立命館大学';
select t.ok(true, '管理者はドメインを追加できる');
select t.throws($$insert into public.university_domains (university_id, domain)
                  select id, '@Bad Domain' from public.universities limit 1$$,
                '不正な形式のドメインは登録できない');
select public.admin_remove_listing('11111111-1111-1111-1111-111111111111', 'テスト削除');
select public.admin_set_user_status('00000000-0000-0000-0000-00000000000b', 'suspended', 'テスト停止');
select t.ok(t.cnt('select 1 from public.admin_actions') = 2, '管理者の操作は記録される');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.listings set status = 'active' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select t.ok((select status from public.listings where id = '11111111-1111-1111-1111-111111111111') = 'removed',
            '管理者に削除された出品は元に戻せない');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select t.ok(t.cnt('select 1 from public.listings') = 0, '利用停止中は出品が見えない');
select t.throws($$insert into public.messages (conversation_id, body)
                  values ('22222222-2222-2222-2222-222222222222', '停止中')$$,
                '利用停止中はメッセージを送れない');
reset role;

\echo '===== すべてのテストに合格しました ====='
