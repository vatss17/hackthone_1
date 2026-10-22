-- =============================================================================
-- Manufacturing capabilities and products (M1.4B)
--
-- STATUS: DRAFT. Not applied to any database. Review first; apply to the hosted
-- development project only after explicit approval.
--
-- Adds exactly 10 tables. The six foundation tables are unchanged EXCEPT one policy
-- correction on public.factories (see "Foundation correction" below):
--   reference (global, read-only for users): ref_processes, ref_materials
--   tenant (one company each):               factory_processes, machines,
--                                            factory_materials, products,
--                                            product_specifications,
--                                            product_materials, factory_products,
--                                            certifications
--
-- Security model (same as the foundation, extended where the new relationships need it):
--   * Every tenant table carries organization_id. Every relationship to a factory or a
--     product uses a COMPOSITE foreign key (organization_id, factory_id|product_id), so
--     a row can only ever point at a parent in its own company.
--   * Members and platform admins read; company owners write. anon has no access.
--   * Client-writable columns are listed explicitly in column-level GRANTs. Parent ids
--     and organization_id are insert-only; created_by, source, archived_at (where not
--     listed), hs_code_status and verification_* are never client-writable.
--   * Independent business records (products, machines, certifications) are soft
--     deleted with archived_at and cannot be edited or restored through the API once
--     archived. Pure link rows may be hard-deleted by owners. Every change, including a
--     link removal, is written to audit_log by the existing audit trigger.
--   * Archived parents freeze their dependents (see private.enforce_active_parents).
--   * The two new trigger functions are SECURITY DEFINER with search_path = '', have
--     no EXECUTE grants, and live in schema private (not exposed by the Data API).
--
-- Reuses: private.is_org_member, private.is_org_owner, private.is_platform_admin,
--         private.set_updated_at, private.audit_row_change (all from the foundation).
-- No service-role use is introduced. Docs: docs/m1.4b-schema-design.md.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Reference data (global). Users can read it and never change it.
-- -----------------------------------------------------------------------------

create table public.ref_processes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_]+$'),
  name        text not null check (name = btrim(name) and char_length(name) between 2 and 100),
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.ref_materials (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Za-z0-9_]+$'),
  name        text not null check (name = btrim(name) and char_length(name) between 2 and 100),
  family      text check (family is null or (family = btrim(family) and char_length(family) between 2 and 60)),
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.ref_processes (code, name, sort_order) values
  ('injection_moulding',     'Injection moulding',     10),
  ('blow_moulding',          'Blow moulding',          20),
  ('extrusion',              'Extrusion',              30),
  ('thermoforming',          'Thermoforming',          40),
  ('rotational_moulding',    'Rotational moulding',    50),
  ('compression_moulding',   'Compression moulding',   60),
  ('additive_manufacturing', 'Additive manufacturing', 70),
  ('printing',               'Printing',               80),
  ('finishing',              'Finishing',              90)
on conflict (code) do nothing;

insert into public.ref_materials (code, name, family, sort_order) values
  ('PP',    'Polypropylene',                'polyolefin',              10),
  ('HDPE',  'High-density polyethylene',    'polyolefin',              20),
  ('LDPE',  'Low-density polyethylene',     'polyolefin',              30),
  ('LLDPE', 'Linear low-density polyethylene', 'polyolefin',           40),
  ('PET',   'Polyethylene terephthalate',   'polyester',               50),
  ('PVC',   'Polyvinyl chloride',           'vinyl',                   60),
  ('PS',    'Polystyrene',                  'styrenic',                70),
  ('HIPS',  'High-impact polystyrene',      'styrenic',                80),
  ('ABS',   'Acrylonitrile butadiene styrene', 'styrenic',             90),
  ('PC',    'Polycarbonate',                'engineering',            100),
  ('PA',    'Polyamide (nylon)',            'engineering',            110),
  ('PMMA',  'Poly(methyl methacrylate)',    'acrylic',                120),
  ('TPE',   'Thermoplastic elastomer',      'thermoplastic elastomer',130),
  ('TPU',   'Thermoplastic polyurethane',   'thermoplastic elastomer',140)
on conflict (code) do nothing;


-- -----------------------------------------------------------------------------
-- Tenant tables
-- Conventions: id uuid; organization_id not null; composite FKs to parents;
-- created_by defaults from the session (not client-writable); timestamps.
-- -----------------------------------------------------------------------------

-- Parent key needed for composite foreign keys from tables that reference products.
-- (public.factories already has factories_org_id_key from the foundation.)
-- Created below with the products table.

-- Factory capabilities. One row per process a factory performs (a reference process or
-- a custom one), with optional declared capacity; OR one factory-wide capacity row that
-- is not tied to any process (scope = 'factory_wide').
create table public.factory_processes (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  factory_id         uuid not null,
  scope              text not null default 'process' check (scope in ('process', 'factory_wide')),
  process_id         uuid references public.ref_processes (id) on delete restrict,
  custom_name        text check (custom_name is null
                                 or (custom_name = btrim(custom_name) and char_length(custom_name) between 2 and 100)),
  capacity_quantity  numeric(14, 3) check (capacity_quantity > 0),
  capacity_unit      text check (capacity_unit in ('kg', 'tonnes', 'pieces', 'metres', 'm2')),
  capacity_period    text check (capacity_period in ('day', 'month', 'year')),
  as_of              date,
  notes              text check (notes is null or char_length(notes) <= 1000),
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint factory_processes_factory_fkey
    foreign key (organization_id, factory_id) references public.factories (organization_id, id) on delete restrict,
  -- A process row names exactly one process (reference or custom). A factory-wide row names none
  -- and must state a capacity (otherwise it would say nothing).
  constraint factory_processes_shape_check check (
    (scope = 'process' and num_nonnulls(process_id, custom_name) = 1)
    or (scope = 'factory_wide' and process_id is null and custom_name is null and capacity_quantity is not null)
  ),
  -- Capacity is quantity + unit + period, all present or all absent.
  constraint factory_processes_capacity_check check (
    (capacity_quantity is null) = (capacity_unit is null)
    and (capacity_unit is null) = (capacity_period is null)
  )
);

create unique index factory_processes_process_key
  on public.factory_processes (factory_id, process_id) where process_id is not null;
create unique index factory_processes_custom_key
  on public.factory_processes (factory_id, lower(custom_name)) where custom_name is not null;
create unique index factory_processes_wide_key
  on public.factory_processes (factory_id) where scope = 'factory_wide';
create index factory_processes_org_factory_idx on public.factory_processes (organization_id, factory_id);

-- Machinery (soft delete).
create table public.machines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  factory_id       uuid not null,
  process_id       uuid references public.ref_processes (id) on delete restrict,
  name             text not null check (name = btrim(name) and char_length(name) between 2 and 200),
  make             text check (make is null or (make = btrim(make) and char_length(make) between 1 and 100)),
  model            text check (model is null or (model = btrim(model) and char_length(model) between 1 and 100)),
  quantity         integer not null default 1 check (quantity between 1 and 10000),
  rating_value     numeric(12, 3) check (rating_value > 0),
  rating_unit      text check (rating_unit in
                     ('tonnes_clamp_force', 'g_shot_weight', 'kg_per_hour', 'pieces_per_hour', 'mm_screw_diameter')),
  year_installed   smallint check (year_installed between 1900 and 2100),
  notes            text check (notes is null or char_length(notes) <= 1000),
  archived_at      timestamptz,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint machines_factory_fkey
    foreign key (organization_id, factory_id) references public.factories (organization_id, id) on delete restrict,
  constraint machines_rating_check check ((rating_value is null) = (rating_unit is null))
);

create index machines_org_factory_idx on public.machines (organization_id, factory_id);

-- Materials a factory can process (a reference material or a custom one).
create table public.factory_materials (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  factory_id       uuid not null,
  material_id      uuid references public.ref_materials (id) on delete restrict,
  custom_name      text check (custom_name is null
                               or (custom_name = btrim(custom_name) and char_length(custom_name) between 2 and 100)),
  notes            text check (notes is null or char_length(notes) <= 1000),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint factory_materials_factory_fkey
    foreign key (organization_id, factory_id) references public.factories (organization_id, id) on delete restrict,
  constraint factory_materials_name_check check (num_nonnulls(material_id, custom_name) = 1)
);

create unique index factory_materials_material_key
  on public.factory_materials (factory_id, material_id) where material_id is not null;
create unique index factory_materials_custom_key
  on public.factory_materials (factory_id, lower(custom_name)) where custom_name is not null;
create index factory_materials_org_factory_idx on public.factory_materials (organization_id, factory_id);

-- Finished products (the catalogue). Soft delete.
--
-- Measurements are stored in ONE canonical unit per quantity, named in the column:
--   unit_weight_g (grams), carton_gross_weight_kg (kilograms), carton_*_mm (millimetres).
-- The application converts at the edge. Capacity and machine ratings differ by process
-- (pieces vs kg vs ...), so those carry an explicit unit column instead.
create table public.products (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete restrict,
  name                     text not null check (name = btrim(name) and char_length(name) between 2 and 200),
  internal_code            text check (internal_code is null
                                       or (internal_code = btrim(internal_code) and char_length(internal_code) between 1 and 60)),
  description              text check (description is null or char_length(description) <= 2000),
  category                 text check (category is null
                                       or (category = btrim(category) and char_length(category) between 1 and 100)),
  intended_use             text check (intended_use is null or char_length(intended_use) <= 500),
  -- Provided by the manufacturer. NEVER verified or inferred by the platform.
  hs_code_claimed          text check (hs_code_claimed is null or hs_code_claimed ~ '^[0-9]{4}([.]?[0-9]{2}){0,3}$'),
  -- The only allowed value for now; relaxed by a future migration when a classification
  -- review workflow exists. Not client-writable.
  hs_code_status           text not null default 'unverified' check (hs_code_status = 'unverified'),
  unit_weight_g            numeric(12, 3) check (unit_weight_g > 0),
  units_per_carton         integer check (units_per_carton between 1 and 1000000),
  carton_gross_weight_kg   numeric(10, 3) check (carton_gross_weight_kg > 0),
  carton_length_mm         numeric(8, 1) check (carton_length_mm > 0),
  carton_width_mm          numeric(8, 1) check (carton_width_mm > 0),
  carton_height_mm         numeric(8, 1) check (carton_height_mm > 0),
  source                   text not null default 'user_provided' check (source in ('user_provided', 'ai_assisted')),
  archived_at              timestamptz,
  created_by               uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Target of composite foreign keys from tables that reference products.
  constraint products_org_id_key unique (organization_id, id),
  -- The three carton dimensions are given together or not at all.
  constraint products_carton_dims_check
    check (num_nonnulls(carton_length_mm, carton_width_mm, carton_height_mm) in (0, 3))
);

create unique index products_org_name_active_idx
  on public.products (organization_id, lower(name)) where archived_at is null;
create unique index products_org_code_active_idx
  on public.products (organization_id, lower(internal_code)) where internal_code is not null and archived_at is null;

comment on column public.products.hs_code_claimed is
  'HS code as stated by the manufacturer. Unverified: the platform does not classify products or infer eligibility from it.';
comment on column public.products.hs_code_status is
  'Always unverified in this version. Not client-writable.';

-- Free-form specifications of a product (name plus a text OR numeric value).
create table public.product_specifications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  product_id       uuid not null,
  name             text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  value_text       text check (value_text is null or char_length(value_text) between 1 and 500),
  value_number     numeric(18, 6),
  unit             text check (unit is null or (unit = btrim(unit) and char_length(unit) between 1 and 30)),
  source           text not null default 'user_provided' check (source in ('user_provided', 'ai_assisted')),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint product_specifications_product_fkey
    foreign key (organization_id, product_id) references public.products (organization_id, id) on delete restrict,
  constraint product_specifications_value_check check (num_nonnulls(value_text, value_number) = 1),
  constraint product_specifications_unit_needs_number_check check (unit is null or value_number is not null)
);

create unique index product_specifications_name_key
  on public.product_specifications (product_id, lower(name));
create index product_specifications_org_product_idx on public.product_specifications (organization_id, product_id);

-- Material composition of a product.
create table public.product_materials (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  product_id       uuid not null,
  material_id      uuid references public.ref_materials (id) on delete restrict,
  custom_name      text check (custom_name is null
                               or (custom_name = btrim(custom_name) and char_length(custom_name) between 2 and 100)),
  share_percent    numeric(5, 2) check (share_percent > 0 and share_percent <= 100),
  role             text not null default 'primary' check (role in ('primary', 'additive', 'colourant', 'filler', 'other')),
  origin_country   char(2) check (origin_country ~ '^[A-Z]{2}$'),
  source           text not null default 'user_provided' check (source in ('user_provided', 'ai_assisted')),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint product_materials_product_fkey
    foreign key (organization_id, product_id) references public.products (organization_id, id) on delete restrict,
  constraint product_materials_name_check check (num_nonnulls(material_id, custom_name) = 1)
);

create unique index product_materials_material_key
  on public.product_materials (product_id, material_id) where material_id is not null;
create unique index product_materials_custom_key
  on public.product_materials (product_id, lower(custom_name)) where custom_name is not null;
create index product_materials_org_product_idx on public.product_materials (organization_id, product_id);

-- Which factory makes which product.
create table public.factory_products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  factory_id       uuid not null,
  product_id       uuid not null,
  notes            text check (notes is null or char_length(notes) <= 1000),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint factory_products_factory_fkey
    foreign key (organization_id, factory_id) references public.factories (organization_id, id) on delete restrict,
  constraint factory_products_product_fkey
    foreign key (organization_id, product_id) references public.products (organization_id, id) on delete restrict,
  constraint factory_products_pair_key unique (factory_id, product_id)
);

create index factory_products_org_product_idx on public.factory_products (organization_id, product_id);

-- Certificate records (soft delete). A certificate may belong to the company (both links
-- empty), to a factory, to a product, or to a product at a factory.
--
-- Three separate ideas, kept apart on purpose:
--   * expires_on            the expiry date REPORTED by the manufacturer from the certificate.
--                           Informational: reaching it changes nothing in the data.
--   * verification_status   whether a platform reviewer has checked authenticity. Always
--                           'unverified' until a reviewer workflow exists; not client-writable.
--   * regulatory acceptance is NOT modelled here at all. A certificate is a record, never a
--                           finding that anything is accepted or compliant.
create table public.certifications (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete restrict,
  factory_id            uuid,
  product_id            uuid,
  name                  text not null check (name = btrim(name) and char_length(name) between 2 and 200),
  kind                  text not null check (kind in ('management_system', 'product_test', 'conformity', 'licence', 'other')),
  issuer                text not null check (issuer = btrim(issuer) and char_length(issuer) between 2 and 200),
  certificate_number    text check (certificate_number is null
                                    or (certificate_number = btrim(certificate_number) and char_length(certificate_number) between 1 and 100)),
  issued_on             date,
  expires_on            date,
  notes                 text check (notes is null or char_length(notes) <= 1000),
  verification_status   text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_by           uuid,   -- no foreign key: must survive account deletion, like audit_log
  verified_at           timestamptz,
  source                text not null default 'user_provided' check (source in ('user_provided', 'ai_assisted')),
  archived_at           timestamptz,
  created_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- NULL behaviour: with the default MATCH SIMPLE, a NULL factory_id (or product_id) switches the
  -- check off, which is exactly "this certificate is not linked to a factory (or product)".
  -- When the id is present, the pair (organization_id, id) must exist, so cross-company links fail.
  constraint certifications_factory_fkey
    foreign key (organization_id, factory_id) references public.factories (organization_id, id) on delete restrict,
  constraint certifications_product_fkey
    foreign key (organization_id, product_id) references public.products (organization_id, id) on delete restrict,
  constraint certifications_dates_check
    check (expires_on is null or issued_on is null or expires_on >= issued_on),
  constraint certifications_verified_check
    check (verification_status = 'unverified' or verified_at is not null)
);

create unique index certifications_issuer_number_active_idx
  on public.certifications (organization_id, lower(issuer), lower(certificate_number))
  where certificate_number is not null and archived_at is null;
create index certifications_org_expiry_idx on public.certifications (organization_id, expires_on);
create index certifications_factory_idx on public.certifications (organization_id, factory_id) where factory_id is not null;
create index certifications_product_idx on public.certifications (organization_id, product_id) where product_id is not null;


-- -----------------------------------------------------------------------------
-- Trigger functions (schema private, SECURITY DEFINER, no EXECUTE grants)
-- -----------------------------------------------------------------------------

-- Archived parents freeze their dependents.
--
-- Runs BEFORE INSERT, UPDATE and DELETE on every table that points at a factory or a
-- product. If the referenced factory or product is archived the change is refused:
--   * no new machine, capability, link, specification, composition row or certificate can be
--     attached to an archived factory or product;
--   * existing dependents of an archived parent can no longer be edited or removed through
--     the API, so the historical record stays as it was when the parent was archived.
-- It does NOT cascade: archiving a factory leaves its dependents (and any active product
-- linked to it) in place. Restoring a record is an administrator action, not an API one.
--
-- The parent row is locked FOR SHARE so that a concurrent archive of the parent and an
-- insert under it cannot interleave. An archive of the parent (UPDATE ... archived_at) waits
-- for in-flight inserts and later inserts see the archived state.
-- A parent that does not exist in the row's own company is ignored here: the composite
-- foreign key rejects it. The function reads only archived_at of the row addressed by the
-- caller's own (organization_id, id) pair, so it discloses nothing about other companies.
create function private.enforce_active_parents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       jsonb;
  v_org       uuid;
  v_factory   uuid;
  v_product   uuid;
  v_archived  timestamptz;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_org     := (v_row ->> 'organization_id')::uuid;
  v_factory := (v_row ->> 'factory_id')::uuid;
  v_product := (v_row ->> 'product_id')::uuid;

  if v_factory is not null then
    select f.archived_at into v_archived
    from public.factories f
    where f.id = v_factory and f.organization_id = v_org
    for share;
    if found and v_archived is not null then
      raise exception 'the factory is archived; its records cannot be changed' using errcode = '55000';
    end if;
  end if;

  if v_product is not null then
    select p.archived_at into v_archived
    from public.products p
    where p.id = v_product and p.organization_id = v_org
    for share;
    if found and v_archived is not null then
      raise exception 'the product is archived; its records cannot be changed' using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- A product's material shares cannot add up to more than 100 percent.
--
-- CONCURRENCY ANALYSIS (READ COMMITTED, the default for PostgREST/Supabase):
--  * The parent product row is locked FOR NO KEY UPDATE before the total is read. That lock
--    mode conflicts with itself, so concurrent composition inserts/updates for ONE product run
--    one after another. It deliberately does NOT conflict with FOR KEY SHARE, so unrelated
--    inserts that merely reference the product (specifications, links, certificates) are not
--    blocked by it.
--  * After the lock is granted, the SUM below is a new statement and takes a new snapshot, so
--    it sees everything the previous holder committed. Two sessions each adding 60 percent:
--    the second waits, then sees 60 and is refused. Two sessions raising different rows
--    (40 -> 60 each): the second waits, then sees the other's committed 60 and is refused.
--  * Under REPEATABLE READ the snapshot is fixed at the first statement, so the SUM could be
--    stale even after waiting. That isolation level is refused outright (below). Under
--    SERIALIZABLE, PostgreSQL's own conflict detection plus this lock keeps the check correct.
--  * Deadlocks: every code path touching a product's composition takes locks in the same
--    order, strongest first (this trigger, named a_..., fires before b_active_parents, which
--    takes FOR SHARE on the same row: already held, so no lock upgrade). A cycle needs two
--    sessions locking different rows in opposite order inside one transaction; the API runs
--    one statement per transaction. PostgreSQL would detect and abort such a cycle (40P01),
--    never leave inconsistent data.
--  * Limits: a multi-row UPDATE is checked row by row in row order, so a set of changes that
--    is valid only as a whole (for example swapping two shares) can be refused if an
--    intermediate state exceeds 100. The application edits one row per request.
--  * It fires on INSERT and on UPDATE of share_percent OR product_id (a row moved between
--    products is checked against its new product).
create function private.enforce_composition_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total  numeric;
begin
  if current_setting('transaction_isolation') = 'repeatable read' then
    raise exception 'material shares must be changed under READ COMMITTED or SERIALIZABLE isolation'
      using errcode = '25000';
  end if;

  if new.share_percent is null then
    return new;
  end if;

  perform 1
  from public.products p
  where p.id = new.product_id and p.organization_id = new.organization_id
  for no key update;

  select coalesce(sum(m.share_percent), 0) into v_total
  from public.product_materials m
  where m.product_id = new.product_id
    and m.id <> new.id
    and m.share_percent is not null;

  if v_total + new.share_percent > 100 then
    raise exception 'material shares of a product cannot add up to more than 100 percent'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_active_parents()    from public, anon, authenticated;
revoke all on function private.enforce_composition_total() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger set_updated_at before update on public.factory_processes     for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.machines              for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.factory_materials     for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.products              for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.product_specifications for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.product_materials     for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.factory_products      for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.certifications        for each row execute function private.set_updated_at();

create trigger a_composition_total
  before insert or update of share_percent, product_id on public.product_materials
  for each row execute function private.enforce_composition_total();

create trigger b_active_parents before insert or update or delete on public.factory_processes
  for each row execute function private.enforce_active_parents();
create trigger b_active_parents before insert or update or delete on public.machines
  for each row execute function private.enforce_active_parents();
create trigger b_active_parents before insert or update or delete on public.factory_materials
  for each row execute function private.enforce_active_parents();
create trigger b_active_parents before insert or update or delete on public.product_specifications
  for each row execute function private.enforce_active_parents();
create trigger b_active_parents before insert or update or delete on public.product_materials
  for each row execute function private.enforce_active_parents();
create trigger b_active_parents before insert or update or delete on public.factory_products
  for each row execute function private.enforce_active_parents();
create trigger b_active_parents before insert or update or delete on public.certifications
  for each row execute function private.enforce_active_parents();

-- Audit every change to tenant data, including removal of link rows (existing function).
create trigger audit_factory_processes      after insert or update or delete on public.factory_processes      for each row execute function private.audit_row_change();
create trigger audit_machines               after insert or update or delete on public.machines               for each row execute function private.audit_row_change();
create trigger audit_factory_materials      after insert or update or delete on public.factory_materials      for each row execute function private.audit_row_change();
create trigger audit_products               after insert or update or delete on public.products               for each row execute function private.audit_row_change();
create trigger audit_product_specifications after insert or update or delete on public.product_specifications for each row execute function private.audit_row_change();
create trigger audit_product_materials      after insert or update or delete on public.product_materials      for each row execute function private.audit_row_change();
create trigger audit_factory_products       after insert or update or delete on public.factory_products       for each row execute function private.audit_row_change();
create trigger audit_certifications         after insert or update or delete on public.certifications         for each row execute function private.audit_row_change();


-- -----------------------------------------------------------------------------
-- Privileges and Row Level Security
-- -----------------------------------------------------------------------------

revoke all on table
  public.ref_processes, public.ref_materials,
  public.factory_processes, public.machines, public.factory_materials, public.products,
  public.product_specifications, public.product_materials, public.factory_products, public.certifications
from anon, authenticated;

alter table public.ref_processes          enable row level security;
alter table public.ref_materials          enable row level security;
alter table public.factory_processes      enable row level security;
alter table public.machines               enable row level security;
alter table public.factory_materials      enable row level security;
alter table public.products               enable row level security;
alter table public.product_specifications enable row level security;
alter table public.product_materials      enable row level security;
alter table public.factory_products       enable row level security;
alter table public.certifications         enable row level security;

-- Reference data: read-only for signed-in users. No INSERT/UPDATE/DELETE privilege exists,
-- so manufacturers cannot alter it; platform staff maintain it with SQL.
grant select on public.ref_processes, public.ref_materials to authenticated;
create policy ref_processes_select on public.ref_processes for select to authenticated using (true);
create policy ref_materials_select on public.ref_materials for select to authenticated using (true);

-- factory_processes: link-style rows (owners may delete).
grant select, delete on public.factory_processes to authenticated;
grant insert (organization_id, factory_id, scope, process_id, custom_name, capacity_quantity, capacity_unit, capacity_period, as_of, notes)
  on public.factory_processes to authenticated;
grant update (process_id, custom_name, capacity_quantity, capacity_unit, capacity_period, as_of, notes)
  on public.factory_processes to authenticated;
create policy factory_processes_select on public.factory_processes for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy factory_processes_insert_owner on public.factory_processes for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy factory_processes_update_owner on public.factory_processes for update to authenticated
  using ((select private.is_org_owner(organization_id))) with check ((select private.is_org_owner(organization_id)));
create policy factory_processes_delete_owner on public.factory_processes for delete to authenticated
  using ((select private.is_org_owner(organization_id)));

-- machines: independent record (soft delete). Archived rows cannot be edited or restored.
grant select on public.machines to authenticated;
grant insert (organization_id, factory_id, process_id, name, make, model, quantity, rating_value, rating_unit, year_installed, notes)
  on public.machines to authenticated;
grant update (process_id, name, make, model, quantity, rating_value, rating_unit, year_installed, notes, archived_at)
  on public.machines to authenticated;
create policy machines_select on public.machines for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy machines_insert_owner on public.machines for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy machines_update_owner on public.machines for update to authenticated
  using ((select private.is_org_owner(organization_id)) and archived_at is null)
  with check ((select private.is_org_owner(organization_id)));

-- factory_materials: link-style rows.
grant select, delete on public.factory_materials to authenticated;
grant insert (organization_id, factory_id, material_id, custom_name, notes) on public.factory_materials to authenticated;
grant update (material_id, custom_name, notes) on public.factory_materials to authenticated;
create policy factory_materials_select on public.factory_materials for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy factory_materials_insert_owner on public.factory_materials for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy factory_materials_update_owner on public.factory_materials for update to authenticated
  using ((select private.is_org_owner(organization_id))) with check ((select private.is_org_owner(organization_id)));
create policy factory_materials_delete_owner on public.factory_materials for delete to authenticated
  using ((select private.is_org_owner(organization_id)));

-- products: independent record (soft delete). hs_code_status and source are not client-writable.
grant select on public.products to authenticated;
grant insert (organization_id, name, internal_code, description, category, intended_use, hs_code_claimed,
              unit_weight_g, units_per_carton, carton_gross_weight_kg, carton_length_mm, carton_width_mm, carton_height_mm)
  on public.products to authenticated;
grant update (name, internal_code, description, category, intended_use, hs_code_claimed,
              unit_weight_g, units_per_carton, carton_gross_weight_kg, carton_length_mm, carton_width_mm, carton_height_mm, archived_at)
  on public.products to authenticated;
create policy products_select on public.products for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy products_insert_owner on public.products for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy products_update_owner on public.products for update to authenticated
  using ((select private.is_org_owner(organization_id)) and archived_at is null)
  with check ((select private.is_org_owner(organization_id)));

-- product_specifications: link-style rows.
grant select, delete on public.product_specifications to authenticated;
grant insert (organization_id, product_id, name, value_text, value_number, unit) on public.product_specifications to authenticated;
grant update (name, value_text, value_number, unit) on public.product_specifications to authenticated;
create policy product_specifications_select on public.product_specifications for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy product_specifications_insert_owner on public.product_specifications for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy product_specifications_update_owner on public.product_specifications for update to authenticated
  using ((select private.is_org_owner(organization_id))) with check ((select private.is_org_owner(organization_id)));
create policy product_specifications_delete_owner on public.product_specifications for delete to authenticated
  using ((select private.is_org_owner(organization_id)));

-- product_materials: link-style rows.
grant select, delete on public.product_materials to authenticated;
grant insert (organization_id, product_id, material_id, custom_name, share_percent, role, origin_country)
  on public.product_materials to authenticated;
grant update (material_id, custom_name, share_percent, role, origin_country) on public.product_materials to authenticated;
create policy product_materials_select on public.product_materials for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy product_materials_insert_owner on public.product_materials for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy product_materials_update_owner on public.product_materials for update to authenticated
  using ((select private.is_org_owner(organization_id))) with check ((select private.is_org_owner(organization_id)));
create policy product_materials_delete_owner on public.product_materials for delete to authenticated
  using ((select private.is_org_owner(organization_id)));

-- factory_products: pure link rows.
grant select, delete on public.factory_products to authenticated;
grant insert (organization_id, factory_id, product_id, notes) on public.factory_products to authenticated;
grant update (notes) on public.factory_products to authenticated;
create policy factory_products_select on public.factory_products for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy factory_products_insert_owner on public.factory_products for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy factory_products_update_owner on public.factory_products for update to authenticated
  using ((select private.is_org_owner(organization_id))) with check ((select private.is_org_owner(organization_id)));
create policy factory_products_delete_owner on public.factory_products for delete to authenticated
  using ((select private.is_org_owner(organization_id)));

-- certifications: independent record (soft delete). The links (factory_id, product_id) are
-- insert-only. verification_status, verified_by, verified_at and source are NOT client-writable:
-- a manufacturer can neither insert nor update them, so nothing can be marked verified through
-- the API. A future reviewer workflow (a SECURITY DEFINER function or staff tool) will set them.
grant select on public.certifications to authenticated;
grant insert (organization_id, factory_id, product_id, name, kind, issuer, certificate_number, issued_on, expires_on, notes)
  on public.certifications to authenticated;
grant update (name, kind, issuer, certificate_number, issued_on, expires_on, notes, archived_at)
  on public.certifications to authenticated;
create policy certifications_select on public.certifications for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy certifications_insert_owner on public.certifications for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));
create policy certifications_update_owner on public.certifications for update to authenticated
  using ((select private.is_org_owner(organization_id)) and archived_at is null)
  with check ((select private.is_org_owner(organization_id)));


-- -----------------------------------------------------------------------------
-- Foundation correction: archived factories are frozen (policy only; no schema change)
--
-- The foundation policy factories_update_owner let an owner update ANY factory of their
-- company, including an archived one, and so restore it (archived_at = NULL) or edit it.
-- This migration treats archived records as history that the manufacturer API cannot change,
-- and freezes the dependents of an archived factory, so the policy is tightened to match.
-- (The foundation migration file itself is not edited: it is already applied.)
--
--   * archive an ACTIVE factory:      allowed (the existing row is active, the new row passes WITH CHECK)
--   * edit an ACTIVE factory:         allowed
--   * edit or restore an ARCHIVED one: no row is visible to the UPDATE, so nothing changes
--   * register a replacement:         unaffected (INSERT policy, and the partial unique index on
--                                     active names lets an archived factory's name be reused)
-- Restoring an archived factory is an administrator action (SQL), recorded in audit_log.
-- ALTER POLICY changes only the USING clause; the role list, WITH CHECK and column grants stay.
-- -----------------------------------------------------------------------------

alter policy factories_update_owner on public.factories
  using ((select private.is_org_owner(organization_id)) and archived_at is null)
  with check ((select private.is_org_owner(organization_id)));
