-- =======================================================================
-- MIGRAÇÃO — Reserva atômica de quota de XMLs (Reforma Tributária)
-- Executar no Supabase Studio → SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem erros.
--
-- Corrige a condição de corrida do limite mensal de XMLs do Plano
-- Essencial: antes, a checagem de saldo e o incremento do contador eram
-- feitos em dois passos separados no código da aplicação (ler → comparar
-- → gravar depois), permitindo que duas requisições simultâneas (ex: duas
-- abas, ou upload de ZIP com centenas de XMLs) somassem mais do que o
-- limite contratado. Agora toda a decisão de "quantos XMLs cabem no saldo
-- e quais chaves já foram contabilizadas" acontece dentro de uma única
-- função Postgres, serializada por advisory lock — nenhuma outra
-- requisição para a mesma assinatura/ciclo consegue reservar quota ao
-- mesmo tempo, mesmo que a linha de rt_uso_mensal ainda não exista.
-- =======================================================================

-- -----------------------------------------------------------------------
-- 0. RT_RECONCILIACOES_USO — trilha de auditoria da reconciliação manual
--    de uso mensal (ferramenta administrativa, nunca automática)
-- -----------------------------------------------------------------------
create table if not exists public.rt_reconciliacoes_uso (
  id                  uuid default gen_random_uuid() primary key,
  assinatura_id       uuid references public.rt_assinaturas(id) on delete cascade not null,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,

  periodo_inicio      date not null,
  valor_anterior      integer not null,
  valor_recalculado   integer not null,

  justificativa       text not null,
  admin_email         text not null,

  criado_em           timestamptz default now()
);

create index if not exists idx_rt_reconciliacoes_org        on public.rt_reconciliacoes_uso(org_id);
create index if not exists idx_rt_reconciliacoes_assinatura on public.rt_reconciliacoes_uso(assinatura_id);

alter table public.rt_reconciliacoes_uso enable row level security;

drop policy if exists "rt_reconciliacoes_select" on public.rt_reconciliacoes_uso;
create policy "rt_reconciliacoes_select" on public.rt_reconciliacoes_uso
  for select using (public.is_member_of(org_id));

-- Sem policy de insert/update/delete: só gravado via rt_reconciliar_uso_xml
-- (SECURITY DEFINER) chamada pela área admin com createAdminClient().

-- -----------------------------------------------------------------------
-- 1. RT_RESERVAR_QUOTA_XML — reserva atômica de quota para um lote de XMLs
--
-- Recebe as chaves de acesso candidatas do lote (para documentos sem
-- chave_acesso, o chamador deve gerar uma chave sintética única por
-- requisição, para que nunca sejam consideradas "já processadas" — mesmo
-- comportamento do código anterior, que sempre tratava doc sem chave como
-- "novo").
--
-- Retorna:
--   ja_processadas -- chaves que já constavam em rt_documentos_processados
--                     (reprocessamento: não consome quota, pode ser salvo)
--   reservadas     -- chaves novas aceitas e já contabilizadas nesta chamada
--   rejeitadas     -- chaves novas que NÃO cabem no saldo disponível
--                     (não devem ser persistidas; nenhuma quota é gasta)
--   elegiveis      -- total de chaves novas (reservadas + rejeitadas)
--   permitidas     -- saldo disponível no momento da reserva
--   uso_atual      -- uso antes desta chamada
--   uso_apos       -- uso depois de aplicar as reservas desta chamada
--
-- Regra: se elegiveis > permitidas, TODO o lote de chaves novas é
-- rejeitado (nunca uma seleção parcial automática dos primeiros itens) —
-- cabe à aplicação decidir se oferece upgrade ou nova tentativa com menos
-- arquivos.
-- -----------------------------------------------------------------------
create or replace function public.rt_reservar_quota_xml(
  p_assinatura_id uuid,
  p_org_id        uuid,
  p_empresa_id    uuid,
  p_periodo_inicio date,
  p_periodo_fim    date,
  p_limite         integer,   -- null = sem limite comercial (planos Profissional/Ilimitado)
  p_chaves         text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key      bigint;
  v_uso_id        uuid;
  v_uso_atual     integer;
  v_ja_processadas text[];
  v_novas         text[];
  v_elegiveis     integer;
  v_permitidas    integer;
  v_reservadas    text[];
  v_rejeitadas    text[];
begin
  if p_chaves is null then
    p_chaves := '{}';
  end if;

  -- Serializa qualquer reserva concorrente para a mesma assinatura+ciclo,
  -- mesmo antes de a linha de rt_uso_mensal existir.
  v_lock_key := hashtextextended(p_assinatura_id::text || ':' || p_periodo_inicio::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  insert into public.rt_uso_mensal (assinatura_id, org_id, periodo_inicio, periodo_fim, xmls_processados)
  values (p_assinatura_id, p_org_id, p_periodo_inicio, p_periodo_fim, 0)
  on conflict (assinatura_id, periodo_inicio) do nothing;

  select id, xmls_processados into v_uso_id, v_uso_atual
  from public.rt_uso_mensal
  where assinatura_id = p_assinatura_id and periodo_inicio = p_periodo_inicio
  for update;

  select coalesce(array_agg(chave) filter (where existe), '{}'),
         coalesce(array_agg(chave) filter (where not existe), '{}')
    into v_ja_processadas, v_novas
  from (
    select chave,
           exists(
             select 1 from public.rt_documentos_processados rdp
             where rdp.assinatura_id = p_assinatura_id and rdp.chave_acesso = chave
           ) as existe
    from unnest(p_chaves) as chave
  ) t;

  v_elegiveis := coalesce(array_length(v_novas, 1), 0);

  if p_limite is null then
    v_permitidas := v_elegiveis;
    v_reservadas := v_novas;
    v_rejeitadas := '{}';
  else
    v_permitidas := greatest(p_limite - v_uso_atual, 0);
    if v_elegiveis <= v_permitidas then
      v_reservadas := v_novas;
      v_rejeitadas := '{}';
    else
      v_reservadas := '{}';
      v_rejeitadas := v_novas;
    end if;
  end if;

  if coalesce(array_length(v_reservadas, 1), 0) > 0 then
    insert into public.rt_documentos_processados (assinatura_id, org_id, empresa_id, chave_acesso, periodo_inicio)
    select p_assinatura_id, p_org_id, p_empresa_id, chave, p_periodo_inicio
    from unnest(v_reservadas) as chave
    on conflict (assinatura_id, chave_acesso) do nothing;

    update public.rt_uso_mensal
    set xmls_processados = xmls_processados + array_length(v_reservadas, 1),
        atualizado_em = now()
    where id = v_uso_id;

    v_uso_atual := v_uso_atual + array_length(v_reservadas, 1);
  end if;

  return jsonb_build_object(
    'ja_processadas', to_jsonb(v_ja_processadas),
    'reservadas', to_jsonb(v_reservadas),
    'rejeitadas', to_jsonb(v_rejeitadas),
    'elegiveis', v_elegiveis,
    'permitidas', v_permitidas,
    'uso_apos', v_uso_atual
  );
end;
$$;

revoke execute on function public.rt_reservar_quota_xml(uuid, uuid, uuid, date, date, integer, text[]) from public, anon, authenticated;
grant execute on function public.rt_reservar_quota_xml(uuid, uuid, uuid, date, date, integer, text[]) to service_role;

-- -----------------------------------------------------------------------
-- 2. RT_LIBERAR_QUOTA_XML — devolve quota de chaves reservadas que não
--    chegaram a ser persistidas com sucesso (ex: falha ao gravar em
--    fa_documentos_fiscais depois da reserva). Nunca deixa o contador
--    ficar negativo.
-- -----------------------------------------------------------------------
create or replace function public.rt_liberar_quota_xml(
  p_assinatura_id  uuid,
  p_periodo_inicio date,
  p_chaves         text[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key  bigint;
  v_removidas integer;
begin
  if p_chaves is null or array_length(p_chaves, 1) is null then
    return 0;
  end if;

  v_lock_key := hashtextextended(p_assinatura_id::text || ':' || p_periodo_inicio::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  with removidos as (
    delete from public.rt_documentos_processados
    where assinatura_id = p_assinatura_id
      and periodo_inicio = p_periodo_inicio
      and chave_acesso = any(p_chaves)
    returning 1
  )
  select count(*) into v_removidas from removidos;

  if v_removidas > 0 then
    update public.rt_uso_mensal
    set xmls_processados = greatest(xmls_processados - v_removidas, 0),
        atualizado_em = now()
    where assinatura_id = p_assinatura_id and periodo_inicio = p_periodo_inicio;
  end if;

  return v_removidas;
end;
$$;

revoke execute on function public.rt_liberar_quota_xml(uuid, date, text[]) from public, anon, authenticated;
grant execute on function public.rt_liberar_quota_xml(uuid, date, text[]) to service_role;

-- -----------------------------------------------------------------------
-- 3. RT_RECONCILIAR_USO_XML — ferramenta administrativa: recalcula o uso
--    real do ciclo a partir de rt_documentos_processados (fonte de
--    verdade) e registra a trilha de auditoria. Nunca é chamada
--    automaticamente — sempre por ação explícita de um admin, com
--    justificativa obrigatória.
-- -----------------------------------------------------------------------
create or replace function public.rt_reconciliar_uso_xml(
  p_assinatura_id  uuid,
  p_periodo_inicio date,
  p_admin_email    text,
  p_justificativa  text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key      bigint;
  v_org_id        uuid;
  v_anterior      integer;
  v_recalculado   integer;
begin
  if p_justificativa is null or length(trim(p_justificativa)) = 0 then
    raise exception 'Justificativa obrigatória para reconciliação de uso';
  end if;

  v_lock_key := hashtextextended(p_assinatura_id::text || ':' || p_periodo_inicio::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select org_id into v_org_id from public.rt_assinaturas where id = p_assinatura_id;
  if v_org_id is null then
    raise exception 'Assinatura não encontrada: %', p_assinatura_id;
  end if;

  select count(*) into v_recalculado
  from public.rt_documentos_processados
  where assinatura_id = p_assinatura_id and periodo_inicio = p_periodo_inicio;

  select xmls_processados into v_anterior
  from public.rt_uso_mensal
  where assinatura_id = p_assinatura_id and periodo_inicio = p_periodo_inicio;

  if v_anterior is null then
    v_anterior := 0;
    insert into public.rt_uso_mensal (assinatura_id, org_id, periodo_inicio, periodo_fim, xmls_processados)
    values (p_assinatura_id, v_org_id, p_periodo_inicio, (p_periodo_inicio + interval '1 month')::date, v_recalculado)
    on conflict (assinatura_id, periodo_inicio) do update set xmls_processados = v_recalculado, atualizado_em = now();
  else
    update public.rt_uso_mensal
    set xmls_processados = v_recalculado, atualizado_em = now()
    where assinatura_id = p_assinatura_id and periodo_inicio = p_periodo_inicio;
  end if;

  insert into public.rt_reconciliacoes_uso
    (assinatura_id, org_id, periodo_inicio, valor_anterior, valor_recalculado, justificativa, admin_email)
  values
    (p_assinatura_id, v_org_id, p_periodo_inicio, v_anterior, v_recalculado, p_justificativa, p_admin_email);

  return jsonb_build_object('valor_anterior', v_anterior, 'valor_recalculado', v_recalculado);
end;
$$;

revoke execute on function public.rt_reconciliar_uso_xml(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.rt_reconciliar_uso_xml(uuid, date, text, text) to service_role;
