-- Diagnostico dos relatorios para a empresa e competencia do erro atual.
-- Execute inteiro no Supabase SQL Editor e envie o resultado ao Codex.

with params as (
  select
    'f7dc159f-145c-49fc-b848-231199632bfb'::uuid as empresa_id,
    '01/2025'::text as comp_mm_yyyy,
    '2025-01'::text as comp_yyyy_mm,
    date '2025-01-01' as data_ini,
    date '2025-02-01' as data_fim
)
select '01_empresa' as bloco, 'empresas' as origem, 'registro encontrado' as metrica, count(*)::text as valor
from public.empresas e, params p
where e.id = p.empresa_id

union all
select '02_docs' as bloco, 'fa_documentos_fiscais' as origem, 'total da empresa' as metrica, count(*)::text as valor
from public.fa_documentos_fiscais d, params p
where d.empresa_id = p.empresa_id

union all
select '02_docs' as bloco, 'fa_documentos_fiscais' as origem, 'data_competencia = 01/2025' as metrica, count(*)::text as valor
from public.fa_documentos_fiscais d, params p
where d.empresa_id = p.empresa_id and d.data_competencia = p.comp_mm_yyyy

union all
select '02_docs' as bloco, 'fa_documentos_fiscais' as origem, 'data_competencia = 2025-01' as metrica, count(*)::text as valor
from public.fa_documentos_fiscais d, params p
where d.empresa_id = p.empresa_id and d.data_competencia = p.comp_yyyy_mm

union all
select '02_docs' as bloco, 'fa_documentos_fiscais' as origem, 'data_emissao em jan/2025' as metrica, count(*)::text as valor
from public.fa_documentos_fiscais d, params p
where d.empresa_id = p.empresa_id and d.data_emissao >= p.data_ini and d.data_emissao < p.data_fim

union all
select '02_docs' as bloco, 'fa_documentos_fiscais' as origem, 'competencias existentes' as metrica, coalesce(string_agg(distinct coalesce(d.data_competencia, 'NULL'), ', ' order by coalesce(d.data_competencia, 'NULL')), 'nenhuma') as valor
from public.fa_documentos_fiscais d, params p
where d.empresa_id = p.empresa_id

union all
select '03_itens' as bloco, 'fa_documentos_itens' as origem, 'itens total da empresa' as metrica, count(*)::text as valor
from public.fa_documentos_itens i, params p
where i.empresa_id = p.empresa_id

union all
select '03_itens' as bloco, 'fa_documentos_itens' as origem, 'itens ligados a docs jan/2025 por competencia' as metrica, count(*)::text as valor
from public.fa_documentos_itens i
join public.fa_documentos_fiscais d on d.id = i.documento_id
cross join params p
where i.empresa_id = p.empresa_id
  and d.empresa_id = p.empresa_id
  and d.data_competencia in (p.comp_mm_yyyy, p.comp_yyyy_mm)

union all
select '03_itens' as bloco, 'fa_documentos_itens' as origem, 'itens ligados a docs jan/2025 por emissao' as metrica, count(*)::text as valor
from public.fa_documentos_itens i
join public.fa_documentos_fiscais d on d.id = i.documento_id
cross join params p
where i.empresa_id = p.empresa_id
  and d.empresa_id = p.empresa_id
  and d.data_emissao >= p.data_ini
  and d.data_emissao < p.data_fim

union all
select '04_resumos' as bloco, 'rel_resumo_documentos_mensal' as origem, 'linhas 01/2025' as metrica, count(*)::text as valor
from public.rel_resumo_documentos_mensal r, params p
where r.empresa_id = p.empresa_id and r.competencia = p.comp_mm_yyyy

union all
select '04_resumos' as bloco, 'rel_resumo_produtos_mensal' as origem, 'linhas 01/2025' as metrica, count(*)::text as valor
from public.rel_resumo_produtos_mensal r, params p
where r.empresa_id = p.empresa_id and r.competencia = p.comp_mm_yyyy

union all
select '04_resumos' as bloco, 'rel_resumo_cfop_mensal' as origem, 'linhas 01/2025' as metrica, count(*)::text as valor
from public.rel_resumo_cfop_mensal r, params p
where r.empresa_id = p.empresa_id and r.competencia = p.comp_mm_yyyy

union all
select '04_resumos' as bloco, 'rel_resumo_ncm_mensal' as origem, 'linhas 01/2025' as metrica, count(*)::text as valor
from public.rel_resumo_ncm_mensal r, params p
where r.empresa_id = p.empresa_id and r.competencia = p.comp_mm_yyyy

union all
select '04_resumos' as bloco, 'rel_resumo_participantes_mensal' as origem, 'linhas 01/2025' as metrica, count(*)::text as valor
from public.rel_resumo_participantes_mensal r, params p
where r.empresa_id = p.empresa_id and r.competencia = p.comp_mm_yyyy

union all
select '05_xml_legado' as bloco, 'fa_arquivos_xml' as origem, 'total da empresa' as metrica, count(*)::text as valor
from public.fa_arquivos_xml x, params p
where x.empresa_id = p.empresa_id

union all
select '05_xml_legado' as bloco, 'fa_arquivos_xml' as origem, 'competencia = 01/2025' as metrica, count(*)::text as valor
from public.fa_arquivos_xml x, params p
where x.empresa_id = p.empresa_id and x.competencia = p.comp_mm_yyyy

union all
select '05_xml_legado' as bloco, 'fa_arquivos_xml' as origem, 'competencia = 2025-01' as metrica, count(*)::text as valor
from public.fa_arquivos_xml x, params p
where x.empresa_id = p.empresa_id and x.competencia = p.comp_yyyy_mm

union all
select '05_xml_legado' as bloco, 'fa_arquivos_xml' as origem, 'data_emissao em jan/2025' as metrica, count(*)::text as valor
from public.fa_arquivos_xml x, params p
where x.empresa_id = p.empresa_id and x.data_emissao >= p.data_ini and x.data_emissao < p.data_fim

order by bloco, origem, metrica;
