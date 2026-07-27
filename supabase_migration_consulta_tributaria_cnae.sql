-- ============================================================================
-- CATÁLOGO JURÍDICO VERSIONADO — CNAE x SIMPLES NACIONAL
-- Regras globais de consulta. Não substitui a configuração manual por empresa.
-- Idempotente: pode ser executada múltiplas vezes no Supabase SQL Editor.
-- ============================================================================

create table if not exists public.tributario_cnae_regras (
  id                    uuid primary key default gen_random_uuid(),
  codigo_regra          text not null,
  versao                integer not null check (versao > 0),
  tipo_correspondencia  text not null check (tipo_correspondencia in ('exato','prefixo','secao','divisao','grupo')),
  padroes               text[] not null check (cardinality(padroes) > 0),
  prioridade            smallint not null default 0,
  natureza              text not null check (natureza in ('comercio','industria','servico','construcao','transporte','agropecuaria','extracao','financeira','administracao_publica','outros')),
  tratamento_principal  text not null check (tratamento_principal in ('anexo_i','anexo_ii','anexo_iii','anexo_iv','fator_r','inconclusivo')),
  anexo_principal       text check (anexo_principal in ('I','II','III','IV','V')),
  titulo                text not null,
  explicacao            text not null,
  confianca             text not null check (confianca in ('alta','media','baixa')),
  conclusivo            boolean not null default false,
  condicoes             jsonb not null default '[]'::jsonb check (jsonb_typeof(condicoes) = 'array'),
  alertas               jsonb not null default '[]'::jsonb check (jsonb_typeof(alertas) = 'array'),
  excecoes              jsonb not null default '[]'::jsonb check (jsonb_typeof(excecoes) = 'array'),
  entendimentos         jsonb not null default '[]'::jsonb
                          constraint tributario_cnae_regras_entendimentos_array
                          check (jsonb_typeof(entendimentos) = 'array'),
  fontes                jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes) = 'array'),
  vigencia_inicio       date not null,
  vigencia_fim          date,
  ativo                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (codigo_regra, versao),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

-- Compatibilidade para quem já executou uma versão anterior desta migração.
alter table public.tributario_cnae_regras
  add column if not exists entendimentos jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tributario_cnae_regras_entendimentos_array'
      and conrelid = 'public.tributario_cnae_regras'::regclass
  ) then
    alter table public.tributario_cnae_regras
      add constraint tributario_cnae_regras_entendimentos_array
      check (jsonb_typeof(entendimentos) = 'array');
  end if;
end $$;

create index if not exists idx_tributario_cnae_regras_vigencia
  on public.tributario_cnae_regras (ativo, vigencia_inicio, vigencia_fim, prioridade desc);
create index if not exists idx_tributario_cnae_regras_padroes
  on public.tributario_cnae_regras using gin (padroes);

alter table public.tributario_cnae_regras enable row level security;

drop policy if exists "tributario_cnae_regras_select" on public.tributario_cnae_regras;
create policy "tributario_cnae_regras_select"
  on public.tributario_cnae_regras
  for select
  using (auth.role() = 'authenticated');

revoke all on table public.tributario_cnae_regras from anon;
grant select on table public.tributario_cnae_regras to authenticated;

insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'SN_CNAE_ADVOCACIA', 1, 'exato', array['6911701'], 100,
  'servico', 'anexo_iv', 'IV', 'Regra principal: Anexo IV',
  'As receitas decorrentes de serviços advocatícios são tributadas pelo Anexo IV.',
  'alta', true,
  '["Confirmar que a receita decorre efetivamente de serviço advocatício."]'::jsonb,
  '["A contribuição patronal previdenciária não está incluída no DAS do Anexo IV."]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, § 5º-C, VII","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, IV, c","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_VIGILANCIA', 1, 'exato', array['8011101'], 100,
  'servico', 'anexo_iv', 'IV', 'Regra principal: Anexo IV',
  'Os serviços de vigilância são tributados pelo Anexo IV.',
  'alta', true,
  '["Confirmar que a prestação possui natureza de vigilância e segurança privada."]'::jsonb,
  '["A contribuição patronal previdenciária não está incluída no DAS do Anexo IV."]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, § 5º-C, VI","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, IV, b","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_LIMPEZA_CONSERVACAO', 1, 'exato', array['8121400','8122200'], 100,
  'servico', 'anexo_iv', 'IV', 'Regra principal: Anexo IV',
  'Serviços de limpeza, conservação, imunização e controle de pragas são tributados pelo Anexo IV quando caracterizada essa natureza de prestação.',
  'alta', true,
  '["Confirmar a descrição e a natureza efetiva do serviço prestado."]'::jsonb,
  '["A contribuição patronal previdenciária não está incluída no DAS do Anexo IV."]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, IV, b","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},{"titulo":"Solução de Consulta Cosit nº 275/2014","referencia":"Limpeza, conservação e controle de pragas","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=32607"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_CONTABILIDADE', 1, 'exato', array['6920601'], 100,
  'servico', 'anexo_iii', 'III', 'Regra principal: Anexo III',
  'Os serviços próprios de escritório de serviços contábeis são tributados pelo Anexo III.',
  'alta', true,
  '["Confirmar que a receita está no rol de atribuições dos profissionais da contabilidade."]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, VIII","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},{"titulo":"Solução de Consulta Cosit nº 65/2025","referencia":"Serviços próprios de profissionais da contabilidade","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78489"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_AGENCIA_VIAGEM', 1, 'exato', array['7911200'], 100,
  'servico', 'anexo_iii', 'III', 'Regra principal: Anexo III',
  'As receitas de agência de viagem e turismo são tributadas pelo Anexo III.',
  'alta', true,
  '["Confirmar a receita própria da agência e sua forma de remuneração."]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, § 5º-B, III","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, III, c","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_FATOR_R_ESPORTES', 1, 'exato', array['8591100','9313100'], 100,
  'servico', 'fator_r', null, 'Regra principal: verificar Fator R',
  'Escolas de esportes e academias de atividades físicas são tributadas pelo Anexo III quando o Fator R for igual ou superior a 28%, ou pelo Anexo V quando for inferior.',
  'alta', true,
  '["Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V."]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Resolução CGSN nº 140/2018","referencia":"Arts. 25, § 1º, V, c, e 26","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_FATOR_R_ADMIN_IMOVEIS', 1, 'exato', array['6822600'], 100,
  'servico', 'fator_r', null, 'Regra principal: verificar Fator R',
  'A gestão e administração de imóveis de terceiros é tributada pelo Anexo III quando o Fator R for igual ou superior a 28%, ou pelo Anexo V quando for inferior.',
  'alta', true,
  '["Confirmar que se trata de imóvel de terceiro.","Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V."]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"Resolução CGSN nº 140/2018","referencia":"Arts. 25, § 1º, V, a, e 26","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_INSTALACAO_MANUTENCAO', 1, 'exato', array['4321500','4322301','4322303','4329103','4330404'], 100,
  'construcao', 'anexo_iii', 'III', 'Regra geral: Anexo III',
  'Serviços autônomos de instalação, manutenção, reparação ou pintura são, em regra, tributados pelo Anexo III.',
  'alta', true,
  '["Confirmar que a empresa foi contratada para executar o serviço específico.","Confirmar que o objeto do contrato não é a construção do imóvel ou a execução integral da obra de engenharia."]'::jsonb,
  '[]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o serviço fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita do serviço acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["Ser contratada por construtora ou trabalhar no local da obra, isoladamente, não transforma o serviço em Anexo IV.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Solução de Consulta Cosit nº 252/2017","referencia":"Instalações vinculadas ou não à obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=44045"}]}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, §§ 5º-B, IX, e 5º-C, I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Solução de Consulta Cosit nº 252/2017","referencia":"Instalações vinculadas ou não à obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=44045"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_REVESTIMENTOS', 1, 'exato', array['4330405'], 110,
  'construcao', 'anexo_iii', 'III', 'Regra geral: Anexo III',
  'A preparação de piso e a aplicação de revestimentos, como serviço próprio e não como execução de obra assumida pela empresa, são tributadas pelo Anexo III.',
  'alta', true,
  '["Confirmar que a empresa foi contratada para o serviço específico, ainda que por empreitada.","Confirmar que o objeto do contrato não é a construção do imóvel ou a execução integral da obra de engenharia."]'::jsonb,
  '[]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o revestimento fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["A contratação por construtora, a empreitada do serviço isolado ou o trabalho no local da obra não bastam para mudar o anexo."],"fontes":[{"titulo":"Solução de Consulta Cosit nº 252/2017","referencia":"Serviço integrante de contrato de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=44045"}]}]'::jsonb,
  '[{"titulo":"Solução de Consulta Cosit nº 513/2017","referencia":"Preparação de piso e aplicação de revestimento","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=46072"},{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, §§ 5º-B, IX, e 5º-C, I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"}]'::jsonb,
  '2018-08-01', null, true
)
-- Uma versão publicada é imutável. Alterações jurídicas devem ser
-- inseridas com nova versão e vigência, preservando consultas históricas.
on conflict (codigo_regra, versao) do nothing;

insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, entendimentos, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values (
  'SN_CNAE_DESIGN_INTERIORES', 1, 'exato', array['7410202'], 120,
  'servico', 'fator_r', null, 'Regra principal: projetos sujeitos ao Fator R',
  'Para receitas de desenvolvimento de projetos de design de interiores, aplica-se o Anexo III quando o Fator R for igual ou superior a 28%, ou o Anexo V quando for inferior.',
  'alta', false,
  '["Confirmar que a receita corresponde ao desenvolvimento do projeto de design de interiores.","Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V.","Separar eventual receita de execução material da decoração e de venda de mercadorias."]'::jsonb,
  '["O CNAE possui descritores amplos; a descrição da NFS-e e o objeto do contrato devem identificar a receita efetivamente prestada."]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Tratamento distinto: execução de decoração de interiores","quando":"Quando a receita não decorrer apenas do desenvolvimento do projeto, mas da execução efetiva da decoração de interiores.","explicacao":"A execução de decoração de interiores está entre os serviços tributados pelo Anexo IV. É necessário distinguir o projeto intelectual da execução material contratada.","alertas":["A denominação do CNAE, isoladamente, não resolve a segregação da receita.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, IV, a","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},{"titulo":"Solução de Consulta Cosit nº 243/2025","referencia":"Projetos de design de interiores — Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=DESIGN+DE+INTERIORES"}]}]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 243/2025","data_publicacao":"2025-11-28","efeito":"distingue_receitas","titulo":"Projetos de design de interiores estão sujeitos ao Fator R","resumo":"A Receita Federal enquadrou a receita de desenvolvimento de projetos de design de interiores no Anexo III ou V, conforme o Fator R.","aplicacao":["Aplicar à receita decorrente do desenvolvimento de projeto de design de interiores.","Não estender automaticamente o entendimento à execução material de decoração de interiores."],"fonte":{"titulo":"Solução de Consulta Cosit nº 243/2025","referencia":"Projetos de design de interiores — Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=DESIGN+DE+INTERIORES"}}]'::jsonb,
  '[{"titulo":"Lei nº 13.369/2016","referencia":"Profissão de designer de interiores e ambientes","url":"https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13369.htm"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Arts. 25, § 1º, IV, a, e V, r, e 26","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},{"titulo":"Solução de Consulta Cosit nº 243/2025","referencia":"Projetos de design de interiores — Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=DESIGN+DE+INTERIORES"}]'::jsonb,
  '2025-11-28', null, true
)
on conflict (codigo_regra, versao) do nothing;

-- Segundo lote: entendimentos administrativos com impacto direto no anexo
-- ou na permanência da empresa no Simples Nacional.
insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, entendimentos, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'SN_CNAE_DESIGN_PRODUTO', 1, 'exato', array['7410203'], 130,
  'servico', 'fator_r', null, 'Regra principal: verificar Fator R',
  'As receitas de design de produto são tributadas pelo Anexo III quando o Fator R for igual ou superior a 28%, ou pelo Anexo V quando for inferior.',
  'alta', true,
  '["Confirmar que a receita decorre de atividade de design.","Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V."]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"CNAE 7410-2/03 — Design de produto","url":"https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=7410203&tipo=cnae&view=subclasse"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Arts. 25, § 1º, V, r, e 26 — design e Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_PINTURA_PREDIAL', 1, 'exato', array['4330404'], 130,
  'construcao', 'anexo_iii', 'III', 'Regra principal: pintura isolada no Anexo III',
  'A pintura predial contratada como serviço próprio e isolado é tributada pelo Anexo III, ainda que executada por empreitada.',
  'alta', true,
  '["Confirmar que o objeto contratado é especificamente o serviço de pintura.","Confirmar que a empresa não assumiu a construção, a obra de engenharia, o paisagismo ou a decoração de interiores."]'::jsonb,
  '["Se houver cessão ou locação de mão de obra, verificar possível vedação ou exclusão do Simples Nacional; não se trata apenas de trocar o anexo."]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: pintura integrada a contrato de obra ou projeto","quando":"Quando a empresa for contratada para construir imóvel, executar obra de engenharia ou projeto de paisagismo ou decoração de interiores e a pintura fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita da pintura acompanha o contrato principal e é tributada pelo Anexo IV.","alertas":["No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Solução de Divergência Cosit nº 33/2013","referencia":"SD Cosit 33/2013 — pintura predial nos Anexos III e IV","url":"https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=23%2F12%2F2013&jornal=1&pagina=50"}]}]'::jsonb,
  '[{"tipo":"solucao_divergencia","identificacao":"SD Cosit nº 33/2013","data_publicacao":"2013-12-23","efeito":"distingue_receitas","titulo":"Pintura isolada e pintura integrada à obra possuem tratamentos diferentes","resumo":"A Receita Federal consolidou o Anexo III para pintura predial contratada isoladamente e o Anexo IV quando a pintura integrar contrato assumido de construção, obra, paisagismo ou decoração de interiores.","aplicacao":["Pintura predial contratada como serviço isolado, inclusive por empreitada: Anexo III.","Pintura que integra contrato de construção, obra, paisagismo ou decoração de interiores: Anexo IV."],"fonte":{"titulo":"Solução de Divergência Cosit nº 33/2013","referencia":"SD Cosit 33/2013 — pintura predial nos Anexos III e IV","url":"https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=23%2F12%2F2013&jornal=1&pagina=50"}},{"tipo":"solucao_divergencia","identificacao":"SD Cosit nº 33/2013","data_publicacao":"2013-12-23","efeito":"risco_exclusao","titulo":"Cessão de mão de obra pode impedir a permanência no Simples","resumo":"Se o serviço do Anexo III for executado mediante cessão ou locação de mão de obra, a consequência pode ser a vedação ou exclusão do Simples Nacional, e não a simples mudança para o Anexo IV.","aplicacao":["Verificar se trabalhadores foram colocados à disposição do contratante para serviço contínuo.","Não confundir empreitada do serviço de pintura, admitida no entendimento, com cessão de mão de obra."],"fonte":{"titulo":"Solução de Divergência Cosit nº 33/2013","referencia":"SD Cosit 33/2013 — pintura predial nos Anexos III e IV","url":"https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=23%2F12%2F2013&jornal=1&pagina=50"}}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, §§ 5º-B, IX, e 5º-C, I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Solução de Divergência Cosit nº 33/2013","referencia":"Pintura predial nos Anexos III e IV","url":"https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=23%2F12%2F2013&jornal=1&pagina=50"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_CLIMATIZACAO', 1, 'exato', array['4322302'], 130,
  'construcao', 'anexo_iii', 'III', 'Regra principal: climatização no Anexo III',
  'A instalação, manutenção e reparação de sistemas centrais de ar-condicionado, ventilação e refrigeração, quando contratadas como serviço específico, são tributadas pelo Anexo III.',
  'alta', true,
  '["Confirmar que o objeto contratado é o serviço específico de instalação ou manutenção do sistema.","Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia."]'::jsonb,
  '["Se houver cessão ou locação de mão de obra, avaliar risco de vedação ou exclusão do Simples Nacional; não se trata apenas de escolher outro anexo."]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o serviço fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita do serviço acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["Ser contratada por construtora ou trabalhar no local da obra, isoladamente, não transforma o serviço em Anexo IV.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Solução de Consulta Cosit nº 167/2014","referencia":"Climatização nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31670"}]}]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 167/2014","data_publicacao":"2014-06-25","efeito":"distingue_receitas","titulo":"Climatização isolada e serviço integrante da obra têm anexos diferentes","resumo":"A instalação e a manutenção de aparelhos e sistemas de climatização são tributadas pelo Anexo III quando contratadas como serviço próprio; se integrarem contrato assumido de construção ou obra de engenharia, acompanham a obra no Anexo IV.","aplicacao":["Serviço específico de instalação ou manutenção de climatização: Anexo III.","Serviço que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV."],"fonte":{"titulo":"Solução de Consulta Cosit nº 167/2014","referencia":"Climatização nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31670"}},{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 169/2014 e nº 47/2018","data_publicacao":"2018-04-03","efeito":"risco_exclusao","titulo":"Cessão ou locação de mão de obra pode excluir a empresa do Simples","resumo":"Nas receitas tratadas pelo Anexo III, a prestação mediante cessão ou locação de mão de obra pode vedar a opção ou causar a exclusão do Simples Nacional.","aplicacao":["Examinar se há trabalhadores à disposição do contratante para atender necessidade contínua.","Visitas para executar tarefas específicas, sob organização da contratada, não devem ser tratadas automaticamente como cessão de mão de obra."],"fonte":{"titulo":"Solução de Consulta Cosit nº 47/2018","referencia":"Manutenção de refrigeração e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=47938"}}]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"CNAE 4322-3/02 — climatização central","url":"https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=4322302&tipo=cnae&view=subclasse"},{"titulo":"Solução de Consulta Cosit nº 167/2014","referencia":"Climatização nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31670"},{"titulo":"Solução de Consulta Cosit nº 169/2014","referencia":"Climatização no Anexo III e risco de exclusão","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31408"},{"titulo":"Solução de Consulta Cosit nº 47/2018","referencia":"Manutenção de refrigeração e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=47938"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_COLETA_RESIDUOS_NAO_PERIGOSOS', 1, 'exato', array['3811400'], 130,
  'servico', 'anexo_iii', 'III', 'Regra principal: coleta de resíduos no Anexo III',
  'A coleta e o transporte de resíduos não perigosos não se confundem com serviço de limpeza e são tributados pelo Anexo III.',
  'alta', true,
  '["Confirmar que a receita corresponde à coleta ou ao transporte de resíduos não perigosos.","Separar eventual serviço de limpeza, conservação, tratamento ou disposição final contratado com objeto distinto."]'::jsonb,
  '["A execução mediante cessão ou locação de mão de obra pode causar exclusão do Simples Nacional."]'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 18/2014","data_publicacao":"2014-04-09","efeito":"confirma_regra","titulo":"Coleta de resíduos não perigosos não se confunde com limpeza","resumo":"A mera coleta e o transporte de resíduos não perigosos são tributados pelo Anexo III, pois não se enquadram como serviço de limpeza do Anexo IV.","aplicacao":["Aplicar à receita de coleta e transporte de resíduos não perigosos do CNAE 3811-4/00.","Segregar serviços de limpeza efetivamente prestados, pois possuem tratamento próprio."],"fonte":{"titulo":"Solução de Consulta Cosit nº 18/2014","referencia":"Coleta de resíduos não perigosos no Anexo III","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34491"}},{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 18/2014","data_publicacao":"2014-04-09","efeito":"risco_exclusao","titulo":"Coleta mediante cessão de mão de obra pode causar exclusão","resumo":"Quando a coleta for prestada mediante cessão ou locação de mão de obra, a prestadora fica sujeita à exclusão do Simples Nacional; enquanto permanecer regularmente no regime e no Anexo III, a solução afasta a retenção previdenciária de 11%.","aplicacao":["Verificar a forma real de execução do contrato, especialmente a colocação de trabalhadores à disposição.","Não reclassificar automaticamente a coleta no Anexo IV apenas por ser chamada de limpeza urbana."],"fonte":{"titulo":"Solução de Consulta Cosit nº 18/2014","referencia":"Coleta de resíduos e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34491"}}]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"CNAE 3811-4/00 — coleta de resíduos não perigosos","url":"https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=3811400&tipo=cnae&view=subclasse"},{"titulo":"Solução de Consulta Cosit nº 18/2014","referencia":"Coleta de resíduos no Anexo III e risco de exclusão","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34491"}]'::jsonb,
  '2018-08-01', null, true
)
on conflict (codigo_regra, versao) do nothing;

-- Terceiro lote: instalações prediais, gesso/estuque e manutenção de
-- máquinas e equipamentos, com distinção entre empreitada e cessão.
insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, entendimentos, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'SN_CNAE_INSTALACOES_PREDIAIS_ESPECIFICAS', 1, 'exato', array['4321500','4322301','4322303'], 140,
  'construcao', 'anexo_iii', 'III', 'Regra principal: serviço específico no Anexo III',
  'Os serviços específicos de instalação, manutenção e reparação elétrica, hidráulica, sanitária, de gás e de sistemas contra incêndio são tributados pelo Anexo III, ainda que executados mediante empreitada.',
  'alta', true,
  '["Confirmar que o objeto do contrato é o serviço específico de instalação, manutenção ou reparação.","Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia."]'::jsonb,
  '["Se houver cessão ou locação de mão de obra, avaliar risco de exclusão do Simples Nacional; não se trata apenas de escolher outro anexo."]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o serviço fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita do serviço acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["Ser contratada por construtora ou trabalhar no local da obra, isoladamente, não transforma o serviço em Anexo IV.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Ato Declaratório Interpretativo RFB nº 8/2013","referencia":"Instalações prediais nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ATO+DECLARATORIO+INTERPRETATIVO+RFB+N+8+30+DEZEMBRO+2013"}]}]'::jsonb,
  '[{"tipo":"ato_interpretativo","identificacao":"ADI RFB nº 8/2013 e SD Cosit nº 36/2013","data_publicacao":"2014-01-02","efeito":"distingue_receitas","titulo":"Serviço específico e serviço integrante da obra têm anexos diferentes","resumo":"Os serviços de instalação, manutenção e reparação elétrica, hidráulica, sanitária, de gás e de sistemas contra incêndio são tributados pelo Anexo III quando contratados de forma específica, inclusive por empreitada; quando integram contrato da própria empresa para construir imóvel ou executar obra de engenharia, acompanham a obra no Anexo IV.","aplicacao":["Serviço específico de instalação, manutenção ou reparação, ainda que por empreitada: Anexo III.","Serviço que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV."],"fonte":{"titulo":"Ato Declaratório Interpretativo RFB nº 8/2013","referencia":"Instalações prediais nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ATO+DECLARATORIO+INTERPRETATIVO+RFB+N+8+30+DEZEMBRO+2013"}},{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 25/2026","data_publicacao":"2026-03-04","efeito":"risco_exclusao","titulo":"Cessão ou locação de mão de obra não equivale a empreitada","resumo":"Na prestação enquadrada no Anexo III, a cessão ou locação de mão de obra pode sujeitar a empresa à exclusão do Simples Nacional. A empreitada do serviço específico, por si só, não provoca essa consequência.","aplicacao":["Verificar se os trabalhadores permanecem à disposição do contratante para atender necessidade contínua.","Não presumir cessão de mão de obra apenas porque o serviço é executado no estabelecimento do cliente ou por empreitada."],"fonte":{"titulo":"Solução de Consulta Cosit nº 25/2026","referencia":"Instalações elétricas e contra incêndio","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=INSTALACAO+MANUTENCAO+REPARACAO+ELETRICA+SISTEMAS+CONTRA+INCENDIO"}}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Arts. 17, XII, e 18, §§ 5º-B, IX, e 5º-C, I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Ato Declaratório Interpretativo RFB nº 8/2013","referencia":"Instalações prediais nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ATO+DECLARATORIO+INTERPRETATIVO+RFB+N+8+30+DEZEMBRO+2013"},{"titulo":"Solução de Consulta Cosit nº 25/2026","referencia":"Instalações elétricas e contra incêndio","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=INSTALACAO+MANUTENCAO+REPARACAO+ELETRICA+SISTEMAS+CONTRA+INCENDIO"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_GESSO_ESTUQUE', 1, 'exato', array['4330403'], 140,
  'construcao', 'anexo_iii', 'III', 'Regra principal: acabamento em gesso no Anexo III',
  'O acabamento em gesso e estuque contratado como serviço próprio e separado da execução integral da obra é tributado pelo Anexo III.',
  'alta', true,
  '["Confirmar que o contrato tem por objeto o acabamento em gesso ou estuque.","Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia."]'::jsonb,
  '[]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o acabamento fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita do acabamento acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["A execução no local da obra, isoladamente, não altera o anexo.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Solução de Consulta Cosit nº 201/2015","referencia":"Acabamento em gesso e estuque","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=37749"}]}]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 201/2015","data_publicacao":"2015-09-30","efeito":"distingue_receitas","titulo":"Acabamento em gesso isolado e integrado à obra têm anexos diferentes","resumo":"As atividades de acabamento em gesso e estuque são tributadas pelo Anexo III quando contratadas separadamente; se fizerem parte de contrato assumido de construção de imóvel ou obra de engenharia, acompanham a obra no Anexo IV.","aplicacao":["Acabamento em gesso ou estuque contratado como serviço específico: Anexo III.","Atividade incluída no contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV."],"fonte":{"titulo":"Solução de Consulta Cosit nº 201/2015","referencia":"Acabamento em gesso e estuque","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=37749"}}]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"CNAE 4330-4/03 — obras de acabamento em gesso e estuque","url":"https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=4330403&tipo=cnae&view=subclasse"},{"titulo":"Solução de Consulta Cosit nº 201/2015","referencia":"Acabamento em gesso nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=37749"}]'::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_MANUTENCAO_MAQUINAS_EQUIPAMENTOS', 1, 'prefixo', array['33'], 120,
  'servico', 'anexo_iii', 'III', 'Regra principal: manutenção e reparação no Anexo III',
  'A receita de manutenção, reparação ou instalação de máquinas e equipamentos da divisão CNAE 33 é, em regra, tributada pelo Anexo III quando a contratada assume a execução e o resultado do serviço.',
  'alta', true,
  '["Confirmar que a receita corresponde ao serviço de manutenção, reparação ou instalação descrito no CNAE.","Confirmar que a equipe permanece sob organização da contratada e comparece apenas pelo tempo necessário à execução das tarefas."]'::jsonb,
  '["Se os trabalhadores forem colocados à disposição do contratante para serviço contínuo, avaliar vedação ou exclusão do Simples Nacional."]'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 67/2026","data_publicacao":"2026-04-24","efeito":"condiciona_enquadramento","titulo":"Manutenção de equipamentos com obrigação de resultado permanece no Anexo III","resumo":"A manutenção e a reparação de equipamentos são, em regra, tributadas pelo Anexo III. Visitas ou chamados periódicos, limitados ao tempo necessário para executar a tarefa e sem equipe à disposição, caracterizam empreitada e não cessão de mão de obra.","aplicacao":["Aplicar quando a contratada assume a execução e o resultado da manutenção ou do reparo.","A presença no cliente apenas pelo tempo necessário à tarefa não configura cessão automaticamente."],"fonte":{"titulo":"Solução de Consulta Cosit nº 67/2026","referencia":"Manutenção de equipamentos e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=SERVICOS+DE+MANUTENCAO+PREVENTIVA+E+CORRETIVA+DE+EQUIPAMENTOS"}},{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 67/2026","data_publicacao":"2026-04-24","efeito":"risco_exclusao","titulo":"Equipe colocada à disposição pode causar exclusão do Simples","resumo":"Quando a execução envolver colocação de trabalhadores à disposição da contratante para serviço contínuo, pode haver cessão ou locação de mão de obra e, consequentemente, vedação ou exclusão do Simples Nacional.","aplicacao":["A caracterização tributária não depende apenas do nome adotado no contrato ou na licitação.","A ausência de transferência formal do comando ou da supervisão não afasta, sozinha, a cessão de mão de obra."],"fonte":{"titulo":"Solução de Consulta Cosit nº 67/2026","referencia":"Manutenção de equipamentos e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=SERVICOS+DE+MANUTENCAO+PREVENTIVA+E+CORRETIVA+DE+EQUIPAMENTOS"}}]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"Divisão 33 — manutenção, reparação e instalação de máquinas e equipamentos","url":"https://concla.ibge.gov.br/busca-online-cnae.html?divisao=33&tipo=cnae&view=divisao"},{"titulo":"Solução de Consulta Cosit nº 67/2026","referencia":"Manutenção de equipamentos e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=SERVICOS+DE+MANUTENCAO+PREVENTIVA+E+CORRETIVA+DE+EQUIPAMENTOS"}]'::jsonb,
  '2026-04-24', null, true
)
on conflict (codigo_regra, versao) do nothing;

-- Quarto lote: revestimentos, elevadores, serviços contábeis especializados e
-- administração de banco de dados. As regras mais específicas têm prioridade
-- superior às versões genéricas já aplicadas, preservando o histórico imutável.
insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, entendimentos, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'SN_CNAE_REVESTIMENTOS_E_RESINAS_DETALHADO', 1, 'exato', array['4330405'], 150,
  'construcao', 'anexo_iii', 'III', 'Regra principal: revestimento no Anexo III',
  'A preparação de piso e a aplicação de revestimentos ou resinas, quando contratadas como serviço específico, são tributadas pelo Anexo III.',
  'alta', true,
  '["Confirmar que o objeto do contrato é a preparação do piso ou a aplicação do revestimento.","Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia."]'::jsonb,
  '["Se houver cessão ou locação de mão de obra, avaliar risco de exclusão do Simples Nacional; não se trata apenas de escolher outro anexo."]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o serviço fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita do serviço acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["Ser contratada por uma construtora ou trabalhar no local de uma obra, isoladamente, não transforma o serviço em Anexo IV.","Verifique o objeto e o escopo assumidos pela empresa no contrato, e não apenas o CNAE ou o local da prestação.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Solução de Consulta Disit/SRRF10 nº 10.014/2024","referencia":"Revestimento epóxi, obra e cessão","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=construcao"}]}]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 513/2017","data_publicacao":"2017-11-01","efeito":"confirma_regra","titulo":"Preparação de piso e aplicação de revestimento no Anexo III","resumo":"A preparação de piso e a aplicação de revestimentos, quando contratadas como serviços específicos, são tributadas pelo Anexo III.","aplicacao":["Aplicar à receita do serviço específico de preparação de piso ou aplicação de revestimento.","Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia."],"fonte":{"titulo":"Solução de Consulta Cosit nº 513/2017","referencia":"Preparação de piso e revestimento","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=46072"}},{"tipo":"solucao_consulta_disit","identificacao":"SC Disit/SRRF10 nº 10.014/2024","data_publicacao":"2024-12-18","efeito":"distingue_receitas","titulo":"Revestimento específico e revestimento integrante da obra têm anexos diferentes","resumo":"A aplicação de revestimento epóxi em piso permanece no Anexo III como serviço específico; quando integra contrato assumido pela própria empresa para construir imóvel ou executar obra de engenharia, acompanha a obra no Anexo IV.","aplicacao":["Aplicação de revestimento contratada como serviço específico: Anexo III.","Aplicação que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV."],"fonte":{"titulo":"Solução de Consulta Disit/SRRF10 nº 10.014/2024","referencia":"Revestimento epóxi, obra e cessão","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=construcao"}},{"tipo":"solucao_consulta_disit","identificacao":"SC Disit/SRRF10 nº 10.014/2024","data_publicacao":"2024-12-18","efeito":"risco_exclusao","titulo":"Cessão ou locação de mão de obra pode excluir a empresa do Simples","resumo":"A prestação do serviço do Anexo III mediante cessão ou locação de mão de obra constitui vedação ao Simples Nacional e pode causar a exclusão da empresa, em vez de simples mudança de anexo.","aplicacao":["Verificar se trabalhadores são colocados à disposição do contratante para atender necessidade contínua.","Não confundir a empreitada do serviço específico com cessão de mão de obra."],"fonte":{"titulo":"Solução de Consulta Disit/SRRF10 nº 10.014/2024","referencia":"Revestimento epóxi, obra e cessão","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=construcao"}}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Arts. 17, XII, e 18, §§ 5º-B, IX, e 5º-C, I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Solução de Consulta Cosit nº 513/2017","referencia":"Preparação de piso e revestimento","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=46072"},{"titulo":"Solução de Consulta Disit/SRRF10 nº 10.014/2024","referencia":"Revestimento epóxi, obra e cessão","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=construcao"}]'::jsonb,
  '2024-12-18', null, true
),
(
  'SN_CNAE_ELEVADORES_ESCADAS_ESTEIRAS', 1, 'exato', array['4329103'], 150,
  'construcao', 'anexo_iii', 'III', 'Regra principal: elevadores e equipamentos similares no Anexo III',
  'A instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes, quando contratadas como serviço específico, são tributadas pelo Anexo III, inclusive por empreitada.',
  'alta', true,
  '["Confirmar que a empresa foi contratada para executar o serviço específico.","Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia."]'::jsonb,
  '["Se houver cessão ou locação de mão de obra, avaliar vedação ou exclusão do Simples Nacional."]'::jsonb,
  '[{"tratamento":"anexo_iv","anexo":"IV","titulo":"Exceção: execução vinculada a contrato de obra","quando":"Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o serviço fizer parte desse contrato.","explicacao":"Nessa hipótese, a receita do serviço acompanha a execução da obra e é tributada pelo Anexo IV.","alertas":["Ser contratada por uma construtora ou trabalhar no local de uma obra, isoladamente, não transforma o serviço em Anexo IV.","No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS."],"fontes":[{"titulo":"Ato Declaratório Interpretativo RFB nº 8/2013","referencia":"Elevadores, escadas e esteiras nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ATO+DECLARATORIO+INTERPRETATIVO+RFB+N+8+30+DEZEMBRO+2013"},{"titulo":"Solução de Divergência Cosit nº 2/2014","referencia":"Elevadores, escadas e esteiras rolantes","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ELEVADORES+ESCADAS+ESTEIRAS+ROLANTES"}]}]'::jsonb,
  '[{"tipo":"solucao_divergencia","identificacao":"SD Cosit nº 2/2014 e ADI RFB nº 8/2013","data_publicacao":"2014-02-25","efeito":"distingue_receitas","titulo":"Elevadores contratados isoladamente e integrados à obra têm anexos diferentes","resumo":"A instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes são tributadas pelo Anexo III, inclusive por empreitada; se integrarem contrato assumido de construção ou obra de engenharia, acompanham a obra no Anexo IV.","aplicacao":["Instalação, manutenção ou reparação contratada como serviço específico, inclusive por empreitada: Anexo III.","Serviço que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV."],"fonte":{"titulo":"Solução de Divergência Cosit nº 2/2014","referencia":"Elevadores, escadas e esteiras rolantes","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ELEVADORES+ESCADAS+ESTEIRAS+ROLANTES"}},{"tipo":"solucao_divergencia","identificacao":"SD Cosit nº 2/2014","data_publicacao":"2014-02-25","efeito":"risco_exclusao","titulo":"Cessão ou locação de mão de obra é vedada nessa prestação do Anexo III","resumo":"Quando o serviço for prestado mediante cessão ou locação de mão de obra, a atividade é vedada ao Simples Nacional; a consequência não é a simples troca para o Anexo IV.","aplicacao":["Verificar se a contratada entrega o resultado do serviço ou apenas disponibiliza trabalhadores.","A execução por empreitada, por si só, não caracteriza cessão de mão de obra."],"fonte":{"titulo":"Solução de Divergência Cosit nº 2/2014","referencia":"Elevadores, escadas e esteiras rolantes","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ELEVADORES+ESCADAS+ESTEIRAS+ROLANTES"}}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Arts. 17, XII, e 18, §§ 5º-B, IX, e 5º-C, I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Ato Declaratório Interpretativo RFB nº 8/2013","referencia":"Elevadores, escadas e esteiras nos Anexos III e IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ATO+DECLARATORIO+INTERPRETATIVO+RFB+N+8+30+DEZEMBRO+2013"},{"titulo":"Solução de Divergência Cosit nº 2/2014","referencia":"Elevadores, escadas e esteiras rolantes","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ELEVADORES+ESCADAS+ESTEIRAS+ROLANTES"}]'::jsonb,
  '2014-02-25', null, true
),
(
  'SN_CNAE_SERVICOS_CONTABEIS_ESPECIALIZADOS', 1, 'exato', array['6920601','6920602'], 150,
  'servico', 'anexo_iii', 'III', 'Regra principal: serviços contábeis no Anexo III',
  'As receitas próprias de escritório contábil, inclusive perícia, auditoria e consultoria contábil compreendidas nas atribuições da profissão, são tributadas pelo Anexo III sem submissão ao Fator R.',
  'alta', false,
  '["Confirmar o registro regular do escritório no Conselho Regional de Contabilidade.","Confirmar que a receita decorre de serviço incluído nas atribuições dos profissionais da contabilidade."]'::jsonb,
  '["Serviços de consultoria, perícia ou auditoria que não sejam contábeis devem ser segregados e analisados por sua natureza própria, inclusive quanto ao Fator R."]'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 65/2025","data_publicacao":"2025-03-31","efeito":"condiciona_enquadramento","titulo":"Perícia, auditoria e consultoria contábil permanecem no Anexo III quando forem atribuições profissionais","resumo":"As receitas de perícia, auditoria e consultoria contábil auferidas por escritório contábil optante e registrado no Conselho de Contabilidade são tributadas pelo Anexo III quando estiverem no rol das atribuições dos profissionais da contabilidade.","aplicacao":["Confirmar que o prestador é escritório contábil devidamente registrado no Conselho Regional de Contabilidade.","Confirmar que o serviço está entre as atribuições legalmente reservadas ou reconhecidas aos profissionais da contabilidade.","Não estender o tratamento a consultorias, perícias ou auditorias estranhas à profissão contábil."],"fonte":{"titulo":"Solução de Consulta Cosit nº 65/2025","referencia":"Perícia, auditoria e consultoria contábil","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78489"}}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, § 5º-B, XIV","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, V, x, itens 1 e 2","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},{"titulo":"Solução de Consulta Cosit nº 65/2025","referencia":"Perícia, auditoria e consultoria contábil","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78489"}]'::jsonb,
  '2025-03-31', null, true
),
(
  'SN_CNAE_ADMINISTRACAO_BANCO_DADOS', 1, 'exato', array['6209100'], 150,
  'servico', 'fator_r', null, 'Regra principal: administração de banco de dados sujeita ao Fator R',
  'A receita de administração de banco de dados é tributada pelo Anexo III quando o Fator R for igual ou superior a 28%, ou pelo Anexo V quando for inferior.',
  'alta', false,
  '["Confirmar que a receita consultada corresponde efetivamente à administração de banco de dados.","Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V."]'::jsonb,
  '["O CNAE 6209-1/00 abrange outros serviços de tecnologia da informação; a SC Cosit nº 24/2025 não deve ser aplicada automaticamente a todas essas receitas."]'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 24/2025","data_publicacao":"2025-03-11","efeito":"condiciona_enquadramento","titulo":"Administração de banco de dados está sujeita ao Fator R","resumo":"A Receita Federal qualificou a administração de banco de dados como atividade intelectual de natureza técnica, tributada pelo Anexo III quando o Fator R for igual ou superior a 28% e pelo Anexo V quando for inferior.","aplicacao":["Aplicar apenas à receita efetiva de administração de banco de dados.","Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V.","Segregar outras receitas abrangidas pelo CNAE amplo 6209-1/00 e analisá-las conforme o serviço efetivamente prestado."],"fonte":{"titulo":"Solução de Consulta Cosit nº 24/2025","referencia":"Administração de banco de dados e Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78278"}}]'::jsonb,
  '[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, §§ 5º-I, XII, e 5º-J","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Resolução CGSN nº 140/2018","referencia":"Art. 25, § 1º, V, r, e § 2º","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},{"titulo":"Solução de Consulta Cosit nº 24/2025","referencia":"Administração de banco de dados e Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78278"}]'::jsonb,
  '2025-03-11', null, true
)
on conflict (codigo_regra, versao) do nothing;

-- Quinto lote: serviços combinados de apoio a edifícios, portaria/zeladoria e
-- monitoramento eletrônico de segurança. O impedimento ao Simples é mantido
-- separado da escolha de anexo.
insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, entendimentos, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'SN_CNAE_APOIO_EDIFICIOS_PORTARIA_ZELADORIA', 1, 'exato', array['8111700'], 160,
  'servico', 'inconclusivo', null, 'Sem anexo único: identificar os serviços efetivamente combinados',
  'O CNAE 8111-7/00 é amplo e não define sozinho o tratamento. Portaria virtual limitada ao controle de acesso pode ser tributada pelo Anexo III; portaria ou zeladoria presencial mediante cessão de mão de obra pode vedar o Simples; limpeza, conservação e vigilância possuem tratamentos próprios.',
  'alta', false,
  '["Identificar separadamente cada serviço contratado e faturado: portaria, recepção, zeladoria, limpeza, conservação, manutenção ou vigilância.","Confirmar onde os empregados trabalham, quem organiza as tarefas e se permanecem à disposição do contratante.","Confirmar se eventual operação remota se limita ao controle de acesso ou também realiza monitoramento de segurança."]'::jsonb,
  '["O CNAE ou o nome genérico de facilities não permite escolher um único anexo para todas as receitas.","Monitoramento eletrônico de sistemas de segurança é serviço de vigilância no Anexo IV, e não portaria virtual do Anexo III."]'::jsonb,
  '[{"tratamento":"anexo_iii","anexo":"III","titulo":"Hipótese permitida: portaria virtual ou remota","quando":"Quando o porteiro trabalha na sede da prestadora e se limita a controlar e liberar o acesso de moradores e visitantes por monitores e interfone.","explicacao":"Atendidos esses fatos e sem atividade de vigilância ou cessão de mão de obra, a receita é permitida no Simples e tributada pelo Anexo III.","alertas":["Se houver monitoramento de alarmes, ronda virtual, prevenção de delitos ou resposta de segurança, analisar o tratamento de vigilância no Anexo IV.","A Receita Federal não define o CNAE correto no processo de consulta; a conclusão depende da atividade efetivamente prestada."],"fontes":[{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, § 5º-F","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Solução de Consulta Cosit nº 315/2019","referencia":"Portaria virtual ou remota no Anexo III","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=54986"}]}]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 315/2019, vinculada à SC Cosit nº 551/2017","data_publicacao":"2019-12-20","efeito":"distingue_receitas","titulo":"Portaria virtual limitada ao controle de acesso pode ser tributada pelo Anexo III","resumo":"A portaria virtual ou remota é permitida no Simples e tributada pelo Anexo III quando o porteiro trabalha nas dependências da prestadora, controlando apenas a entrada de moradores e visitantes por monitores e interfone, sem exercer vigilância.","aplicacao":["O porteiro remoto deve trabalhar nas dependências da empresa prestadora.","A atividade deve se limitar ao controle e à liberação de acesso de moradores, visitantes e prestadores.","Não pode haver colocação de trabalhadores à disposição do cliente nem finalidade de vigilância ou prevenção de delitos."],"fonte":{"titulo":"Solução de Consulta Cosit nº 315/2019","referencia":"Portaria virtual ou remota no Anexo III","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=54986"}},{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 57/2015 e ADI RFB nº 7/2015","data_publicacao":"2015-06-11","efeito":"risco_exclusao","titulo":"Portaria ou zeladoria presencial mediante cessão de mão de obra é vedada ao Simples","resumo":"Portaria e zeladoria não se confundem com vigilância, limpeza ou conservação. Quando prestadas mediante cessão ou locação de mão de obra, não recebem o permissivo do Anexo IV e podem impedir a opção ou permanência no Simples Nacional.","aplicacao":["Verificar se empregados permanecem nas dependências do contratante ou de terceiros por ele indicados.","Verificar se os trabalhadores são colocados à disposição para serviços contínuos de portaria, recepção ou zeladoria.","Não reclassificar a atividade para o Anexo IV apenas para tentar afastar a vedação."],"fonte":{"titulo":"Solução de Consulta Cosit nº 57/2015","referencia":"Portaria, zeladoria e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=35392"}}]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"CNAE 8111-7/00 — serviços combinados para apoio a edifícios","url":"https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=8111700&tipo=cnae&view=subclasse"},{"titulo":"Lei Complementar nº 123/2006","referencia":"Arts. 17, XII, e 18, §§ 5º-C, VI, 5º-F e 5º-H","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Solução de Consulta Cosit nº 57/2015","referencia":"Portaria, zeladoria e cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=35392"},{"titulo":"Ato Declaratório Interpretativo RFB nº 7/2015","referencia":"Portaria mediante cessão de mão de obra","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=PORTARIA+CESSAO+MAO+DE+OBRA"},{"titulo":"Solução de Consulta Cosit nº 315/2019","referencia":"Portaria virtual ou remota no Anexo III","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=54986"}]'::jsonb,
  '2019-12-20', null, true
),
(
  'SN_CNAE_MONITORAMENTO_SEGURANCA_ELETRONICO', 1, 'exato', array['8020001'], 160,
  'servico', 'anexo_iv', 'IV', 'Regra principal: monitoramento de segurança no Anexo IV',
  'A receita de monitoramento eletrônico de sistemas de segurança é tratada como serviço de vigilância e tributada pelo Anexo IV.',
  'alta', true,
  '["Confirmar que a receita decorre do monitoramento de alarmes, imagens ou outros sistemas com finalidade de segurança.","Segregar venda, instalação e manutenção de equipamentos contratadas separadamente do serviço de monitoramento."]'::jsonb,
  '["No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS.","Portaria virtual limitada ao controle de acesso, operada da sede da prestadora e sem finalidade de vigilância, possui tratamento distinto no Anexo III."]'::jsonb,
  '[]'::jsonb,
  '[{"tipo":"solucao_consulta_cosit","identificacao":"SC Cosit nº 73/2014","data_publicacao":"2014-05-06","efeito":"confirma_regra","titulo":"Monitoramento eletrônico de sistemas de segurança é serviço de vigilância","resumo":"Para o Simples Nacional, o monitoramento eletrônico de sistemas de segurança, inclusive alarmes, constitui serviço de vigilância e é tributado pelo Anexo IV.","aplicacao":["Aplicar à receita efetiva de monitoramento de sistemas de segurança eletrônico.","Separar venda, instalação ou manutenção de equipamentos quando forem contratadas de forma autônoma do monitoramento.","Não confundir monitoramento de segurança com portaria remota limitada à recepção e ao controle de acesso."],"fonte":{"titulo":"Solução de Consulta Cosit nº 73/2014","referencia":"Monitoramento eletrônico de segurança no Anexo IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34468"}}]'::jsonb,
  '[{"titulo":"CONCLA/IBGE — CNAE-Subclasses","referencia":"CNAE 8020-0/01 — monitoramento de sistemas de segurança eletrônico","url":"https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=8020001&tipo=cnae&view=subclasse"},{"titulo":"Lei Complementar nº 123/2006","referencia":"Art. 18, § 5º-C, VI","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},{"titulo":"Solução de Consulta Cosit nº 73/2014","referencia":"Monitoramento eletrônico de segurança no Anexo IV","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34468"},{"titulo":"Solução de Consulta Cosit nº 315/2019","referencia":"Distinção entre portaria remota e vigilância","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=54986"}]'::jsonb,
  '2014-05-06', null, true
)
on conflict (codigo_regra, versao) do nothing;

comment on table public.tributario_cnae_regras is
  'Catálogo jurídico global, versionado e auditável para sugestões de enquadramento do Simples Nacional por CNAE.';
