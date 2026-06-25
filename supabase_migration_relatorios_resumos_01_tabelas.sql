create table if not exists public.rel_resumo_produtos_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  tipo_movimento text not null,
  descricao text not null default '',
  ncm text not null default '',
  valor_total numeric(15,2) not null default 0,
  quantidade numeric(15,4) not null default 0,
  count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, tipo_movimento, descricao, ncm)
);

create table if not exists public.rel_resumo_cfop_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  cfop text not null default 'sem-cfop',
  tipo text not null,
  valor_total numeric(15,2) not null default 0,
  quantidade numeric(15,4) not null default 0,
  count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, cfop)
);

create table if not exists public.rel_resumo_ncm_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  ncm text not null default 'sem-ncm',
  descricao_exemplo text not null default '',
  valor_total numeric(15,2) not null default 0,
  quantidade numeric(15,4) not null default 0,
  count_produtos bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, ncm)
);

create table if not exists public.rel_resumo_participantes_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  tipo_movimento text not null,
  cnpj text not null,
  nome text not null default '',
  valor_total numeric(15,2) not null default 0,
  count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, tipo_movimento, cnpj)
);
