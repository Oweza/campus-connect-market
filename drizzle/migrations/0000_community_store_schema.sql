
create type public.app_role as enum ('admin','vendor','student','faculty','resident');
create type public.user_type as enum ('student','faculty','vendor','resident');
create type public.vendor_status as enum ('none','pending','approved','rejected');
create type public.order_status as enum ('pending','paid','processing','ready','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  user_type public.user_type not null default 'student',
  avatar_url text,
  bio text,
  phone text,
  business_name text,
  vendor_status public.vendor_status not null default 'none',
  verified boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_suspended(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = _user_id), false)
$$;

create policy "profiles public read" on public.profiles for select to anon, authenticated using (true);
create policy "profiles own update" on public.profiles for update to authenticated using (auth.uid() = id or public.has_role(auth.uid(),'admin'));
create policy "roles own read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then return new; end if;
  new.verified := old.verified;
  new.suspended := old.suspended;
  if new.vendor_status <> old.vendor_status and not (new.vendor_status = 'pending' and old.vendor_status in ('none','rejected')) then
    new.vendor_status := old.vendor_status;
  end if;
  return new;
end $$;
create trigger trg_protect_profile before update on public.profiles for each row execute function public.protect_profile_fields();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  link text,
  kind text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif own read" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notif own update" on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "notif own delete" on public.notifications for delete to authenticated using (auth.uid() = user_id);

create or replace function public.notify(_user uuid, _title text, _body text, _link text, _kind text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id,title,body,link,kind) values (_user,_title,_body,_link,_kind);
$$;
revoke execute on function public.notify(uuid,text,text,text,text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _type public.user_type;
begin
  begin
    _type := coalesce(nullif(new.raw_user_meta_data->>'user_type','')::public.user_type, 'student');
  exception when others then _type := 'student';
  end;
  insert into public.profiles(id, full_name, user_type, business_name, vendor_status, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    _type,
    new.raw_user_meta_data->>'business_name',
    case when _type = 'vendor' then 'pending'::public.vendor_status else 'none'::public.vendor_status end,
    new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles(user_id, role) values (new.id, (case when _type='vendor' then 'resident' else _type::text end)::public.app_role) on conflict do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  perform public.notify(new.id, 'Welcome to Community Store!', 'Start browsing listings from your District 6 neighbours.', '/marketplace', 'info');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default 'Package',
  sort int not null default 0
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories read" on public.categories for select to anon, authenticated using (true);
insert into public.categories(name,slug,icon,sort) values
 ('Textbooks & Notes','textbooks','BookOpen',1),
 ('Electronics','electronics','Laptop',2),
 ('Fashion','fashion','Shirt',3),
 ('Food & Snacks','food','UtensilsCrossed',4),
 ('Furniture & Home','home','Sofa',5),
 ('Services & Tutoring','services','GraduationCap',6),
 ('Arts & Crafts','arts','Palette',7),
 ('Other','other','Package',8);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 1 check (stock >= 0),
  condition text not null default 'new',
  image_url text,
  location text not null default 'District 6',
  status text not null default 'active' check (status in ('active','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select to anon, authenticated
  using (status = 'active' or seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "products own insert" on public.products for insert to authenticated
  with check (seller_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy "products own update" on public.products for update to authenticated
  using (seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "products own delete" on public.products for delete to authenticated
  using (seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.protect_product_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then
    if old.status = 'removed' then new.status := 'removed'; end if;
    if new.status = 'removed' and old.status <> 'removed' then new.status := old.status; end if;
  end if;
  return new;
end $$;
create trigger trg_product_status before update on public.products for each row execute function public.protect_product_status();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;
alter table public.cart_items enable row level security;
create policy "cart own" on public.cart_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  total numeric(10,2) not null,
  status public.order_status not null default 'pending',
  payment_method text not null,
  payment_ref text,
  payment_status text not null default 'unpaid',
  delivery_method text not null default 'collection',
  delivery_address text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  image_url text,
  price numeric(10,2) not null,
  quantity int not null
);
grant select on public.orders, public.order_items to authenticated;
grant all on public.orders, public.order_items to service_role;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create or replace function public.is_order_seller(_order uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.order_items where order_id = _order and seller_id = _user)
$$;
create or replace function public.is_order_buyer(_order uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = _order and buyer_id = _user)
$$;
create policy "orders read" on public.orders for select to authenticated
  using (buyer_id = auth.uid() or public.is_order_seller(id, auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "order items read" on public.order_items for select to authenticated
  using (seller_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_order_buyer(order_id, auth.uid()));

create or replace function public.place_order(_payment_method text, _card_last4 text, _delivery_method text, _address text, _phone text, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _order uuid; _total numeric := 0; r record; _ref text; _seller uuid;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if public.is_suspended(_uid) then raise exception 'Your account is suspended'; end if;
  if _payment_method not in ('card','instant_eft','cash_on_collection') then raise exception 'Invalid payment method'; end if;
  if not exists (select 1 from public.cart_items where user_id = _uid) then raise exception 'Your cart is empty'; end if;
  for r in select c.quantity as qty, p.title, p.status, p.stock, p.seller_id, p.price from public.cart_items c join public.products p on p.id = c.product_id where c.user_id = _uid for update of p loop
    if r.status <> 'active' then raise exception '"%" is no longer available', r.title; end if;
    if r.stock < r.qty then raise exception 'Only % of "%" left in stock', r.stock, r.title; end if;
    if r.seller_id = _uid then raise exception 'You cannot buy your own listing "%"', r.title; end if;
    _total := _total + r.price * r.qty;
  end loop;
  if _payment_method = 'card' and (_card_last4 is null or _card_last4 = '0000') then
    raise exception 'Payment declined by bank (simulated). Try a different card.';
  end if;
  _ref := 'CS-' || upper(substr(md5(random()::text),1,10));
  insert into public.orders(buyer_id,total,status,payment_method,payment_ref,payment_status,delivery_method,delivery_address,phone,notes)
  values (_uid,_total,
    case when _payment_method='cash_on_collection' then 'pending'::public.order_status else 'paid'::public.order_status end,
    _payment_method,_ref,
    case when _payment_method='cash_on_collection' then 'unpaid' else 'paid' end,
    coalesce(_delivery_method,'collection'),_address,_phone,_notes)
  returning id into _order;
  insert into public.order_items(order_id,product_id,seller_id,title,image_url,price,quantity)
    select _order,p.id,p.seller_id,p.title,p.image_url,p.price,c.quantity
    from public.cart_items c join public.products p on p.id=c.product_id where c.user_id=_uid;
  update public.products p set stock = p.stock - c.quantity from public.cart_items c where c.product_id=p.id and c.user_id=_uid;
  delete from public.cart_items where user_id=_uid;
  if _payment_method = 'cash_on_collection' then
    perform public.notify(_uid,'Order placed','Order '||_ref||' — pay R'||_total||' on collection.','/orders','order');
  else
    perform public.notify(_uid,'Payment successful','R'||_total||' paid for order '||_ref||'.','/orders','payment');
  end if;
  for _seller in select distinct seller_id from public.order_items where order_id=_order loop
    perform public.notify(_seller,'New order received','You have a new order ('||_ref||'). Check your sales.','/sell','order');
  end loop;
  return _order;
end $$;
grant execute on function public.place_order(text,text,text,text,text,text) to authenticated;

create or replace function public.update_order_status(_order uuid, _status public.order_status)
returns void language plpgsql security definer set search_path = public as $$
declare o record; s uuid;
begin
  select * into o from public.orders where id=_order;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('cancelled','completed') then raise exception 'Order is already %', o.status; end if;
  if _status = 'cancelled' and o.buyer_id = auth.uid() and o.status in ('pending','paid') then
    null;
  elsif not (public.is_order_seller(_order, auth.uid()) or public.has_role(auth.uid(),'admin')) then
    raise exception 'Not allowed';
  end if;
  update public.orders set status=_status,
    payment_status = case when _status='completed' then 'paid' when _status='cancelled' and payment_status='paid' then 'refunded' else payment_status end
    where id=_order;
  if _status='cancelled' then
    update public.products p set stock = p.stock + oi.quantity from public.order_items oi where oi.order_id=_order and oi.product_id=p.id;
  end if;
  perform public.notify(o.buyer_id,'Order update','Order '||o.payment_ref||' is now '||_status||case when _status='cancelled' and o.payment_status='paid' then ' — refund issued.' else '.' end,'/orders','order');
  if o.buyer_id = auth.uid() then
    for s in select distinct seller_id from public.order_items where order_id=_order loop
      perform public.notify(s,'Order cancelled','Order '||o.payment_ref||' was cancelled by the buyer.','/sell','order');
    end loop;
  end if;
end $$;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (seller_id, reviewer_id)
);
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create or replace function public.has_bought_from(_seller uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.seller_id=_seller and o.buyer_id=_user and o.status <> 'cancelled')
$$;
create policy "reviews read" on public.reviews for select to anon, authenticated using (true);
create policy "reviews insert buyers" on public.reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and seller_id <> auth.uid() and public.has_bought_from(seller_id, auth.uid()));
create policy "reviews own update" on public.reviews for update to authenticated using (reviewer_id = auth.uid());
create policy "reviews delete" on public.reviews for delete to authenticated using (reviewer_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'announcement' check (kind in ('announcement','event')),
  title text not null,
  body text not null,
  event_date timestamptz,
  location text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts read" on public.posts for select to anon, authenticated using (true);
create policy "posts insert" on public.posts for insert to authenticated with check (author_id = auth.uid() and not public.is_suspended(auth.uid()) and (pinned = false or public.has_role(auth.uid(),'admin')));
create policy "posts update" on public.posts for update to authenticated using (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "posts delete" on public.posts for delete to authenticated using (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  admin_note text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports read" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "reports admin update" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.review_vendor(_user uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  update public.profiles set vendor_status = case when _approve then 'approved'::public.vendor_status else 'rejected'::public.vendor_status end,
    verified = _approve where id=_user;
  if _approve then
    insert into public.user_roles(user_id,role) values (_user,'vendor') on conflict do nothing;
    perform public.notify(_user,'Vendor approved','Congratulations! Your vendor account is now verified.','/sell','vendor');
  else
    delete from public.user_roles where user_id=_user and role='vendor';
    perform public.notify(_user,'Vendor application declined','Your vendor application was not approved. Update your profile and re-apply.','/profile','vendor');
  end if;
end $$;
grant execute on function public.review_vendor(uuid,boolean) to authenticated;

create or replace function public.set_admin(_user uuid, _make boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if _make then insert into public.user_roles(user_id,role) values (_user,'admin') on conflict do nothing;
  else
    if _user = auth.uid() then raise exception 'You cannot remove your own admin role'; end if;
    delete from public.user_roles where user_id=_user and role='admin';
  end if;
end $$;
grant execute on function public.set_admin(uuid,boolean) to authenticated;

create or replace function public.notify_on_vendor_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  if new.vendor_status = 'pending' and (tg_op='INSERT' or old.vendor_status <> 'pending') then
    for a in select user_id from public.user_roles where role='admin' and user_id <> new.id loop
      perform public.notify(a,'New vendor application', coalesce(nullif(new.business_name,''),new.full_name)||' applied to become a verified vendor.','/admin','vendor');
    end loop;
  end if;
  return new;
end $$;
create trigger trg_vendor_request after insert or update on public.profiles for each row execute function public.notify_on_vendor_request();

create or replace function public.notify_on_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  for a in select user_id from public.user_roles where role='admin' loop
    perform public.notify(a,'New listing report','A listing was reported: '||new.reason,'/admin','report');
  end loop;
  return new;
end $$;
create trigger trg_report after insert on public.reports for each row execute function public.notify_on_report();

create policy "product images owner read" on storage.objects for select to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "product images upload" on storage.objects for insert to authenticated with check (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "product images delete" on storage.objects for delete to authenticated using (bucket_id='product-images' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.notifications;
