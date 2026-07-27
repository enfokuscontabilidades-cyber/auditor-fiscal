-- ============================================================================
-- CONSULTA NCM - CONTEXTO DE ICMS-ST E PRIMEIRA REGRA DE GOIAS
--
-- A conclusao exige correspondencia cumulativa de NCM, descricao, CEST, UF e
-- posicao da empresa. A carga inicial cobre apenas pneumaticos, protetores e
-- camaras de ar NOVOS incorporados ao Apendice II do Anexo VIII do RCTE/GO.
-- Idempotente: pode ser executada multiplas vezes no Supabase SQL Editor.
-- ============================================================================

alter table public.tributario_ncm_regras
  add column if not exists cests text[] not null default '{}',
  add column if not exists correspondencias_cest jsonb not null default '[]'::jsonb,
  add column if not exists ufs_destino text[] not null default '{}',
  add column if not exists exige_cest boolean not null default false,
  add column if not exists descricao_legal text;

create index if not exists idx_tributario_ncm_regras_cests
  on public.tributario_ncm_regras using gin (cests);

insert into public.tributario_ncm_regras (
  codigo_regra, versao, tributos, tipo_correspondencia, padroes, padroes_excluir,
  prioridade, categoria, titulo, explicacao, descricao_obrigatoria,
  palavras_incluir, palavras_excluir, cests, ufs_destino, exige_cest,
  correspondencias_cest, descricao_legal, resultados, condicoes, alertas, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values (
  'ICMS_ST_GO_PNEUMATICOS_NOVOS',
  1,
  array['icms'],
  'prefixo',
  array['4011','401290','4013'],
  array['40115000','40132000'],
  220,
  'ICMS-ST GO - pneumaticos, protetores e camaras de ar novos',
  'ICMS-ST em Goias - pneumaticos, protetores e camaras de ar novos',
  'O RCTE/GO relaciona produtos novos deste segmento por descricao, NCM e CEST. A presenca do NCM, isoladamente, nao caracteriza substituicao tributaria.',
  true,
  array['pneu','pneumatico','protetor','camara de ar'],
  array['usado','recauchutado','reformado','bicicleta'],
  array['1600100','1600200','1600300','1600400','1600700','1600800'],
  array['GO'],
  true,
  $$[
    {"cests":["1600100"],"tipo_correspondencia":"exato","padroes":["40111000"],"palavras_incluir":["automovel","carro"]},
    {"cests":["1600200"],"tipo_correspondencia":"prefixo","padroes":["4011"],"padroes_excluir":["40111000","40114000","40115000"],"palavras_incluir":["caminhao","onibus","aviao","aeronave","agricola","terraplenagem","empilhadeira","maquina"]},
    {"cests":["1600300"],"tipo_correspondencia":"exato","padroes":["40114000"],"palavras_incluir":["motocicleta","moto"]},
    {"cests":["1600400"],"tipo_correspondencia":"prefixo","padroes":["4011"],"padroes_excluir":["40111000","40114000","40115000"],"palavras_incluir":["pneu","pneumatico"],"palavras_excluir":["caminhao","onibus","aviao","aeronave","agricola","terraplenagem","empilhadeira","motocicleta","moto","bicicleta"]},
    {"cests":["1600700"],"tipo_correspondencia":"prefixo","padroes":["401290"],"palavras_incluir":["protetor"]},
    {"cests":["1600800"],"tipo_correspondencia":"prefixo","padroes":["4013"],"padroes_excluir":["40132000"],"palavras_incluir":["camara de ar"]}
  ]$$::jsonb,
  'Pneumaticos novos para automoveis, caminhoes, onibus, motocicletas e outras aplicacoes, exceto bicicletas; protetores e camaras de ar novos, exceto os destinados a bicicletas, conforme os CESTs incorporados pelo Estado de Goias.',
  $$[
    {
      "perfis":["qualquer"],
      "operacoes":["qualquer"],
      "posicoes_icms":["nao_informada"],
      "tratamento":"inconclusivo",
      "titulo":"Mercadoria potencialmente sujeita a ICMS-ST em Goias",
      "explicacao":"NCM, descricao e CEST podem estar na lista estadual, mas ainda e necessario identificar se a empresa atua como substituta ou substituida nesta operacao.",
      "orientacao_simples":"Nao escolha a segregacao do PGDAS-D antes de confirmar quem reteve ou deve recolher o ICMS-ST na operacao."
    },
    {
      "perfis":["qualquer"],
      "operacoes":["qualquer"],
      "posicoes_icms":["substituto"],
      "tratamento":"substituicao_tributaria",
      "titulo":"Substituto tributario: retencao ou recolhimento do ICMS-ST",
      "explicacao":"Com mercadoria, CEST e operacao alcancados pela norma, a empresa indicada como substituta deve observar a retencao ou o recolhimento do ICMS-ST.",
      "orientacao_simples":"No PGDAS-D, o substituto informa a receita propria sem substituicao tributaria; o ICMS proprio permanece no DAS. O ICMS-ST devido como responsavel e apurado e recolhido fora do Simples Nacional."
    },
    {
      "perfis":["qualquer"],
      "operacoes":["qualquer"],
      "posicoes_icms":["substituido"],
      "tratamento":"substituicao_tributaria",
      "titulo":"Substituido tributario: mercadoria recebida com ICMS retido",
      "explicacao":"Com mercadoria, CEST e operacao alcancados pela norma, a empresa indicada como substituida recebe a mercadoria com o ICMS-ST ja retido ou antecipado na forma aplicavel.",
      "orientacao_simples":"No PGDAS-D, segregar a receita com substituicao tributaria de ICMS, excluindo somente a parcela do ICMS do calculo do DAS; os demais tributos continuam conforme a atividade."
    }
  ]$$::jsonb,
  $$[
    "Confirmar a correspondencia simultanea entre a descricao legal, o NCM e o CEST.",
    "Confirmar se a operacao e interna ou se existe convenio ou protocolo aplicavel a operacao interestadual.",
    "Confirmar no documento fiscal e na legislacao quem ocupa a posicao de substituto e de substituido.",
    "Verificar as excecoes da clausula nona do Convenio ICMS 142/2018, inclusive transferencias, industrializacao e operacoes entre estabelecimentos do mesmo industrial."
  ]$$::jsonb,
  $$[
    "A lista de Goias nao inclui nesta regra os CESTs especificos de pneus, protetores e camaras de ar para bicicletas nem pneus recauchutados.",
    "MVA, base de calculo, beneficio fiscal e recolhimento nao sao definidos por esta classificacao e exigem validacao propria.",
    "A indicacao nao substitui a conferencia do documento fiscal, do fornecedor e do acordo interestadual aplicavel."
  ]$$::jsonb,
  $$[
    {
      "titulo":"Decreto GO no 10.799/2025",
      "referencia":"Apendice II do Anexo VIII do RCTE/GO - segmento de pneumaticos",
      "url":"https://legisla.casacivil.go.gov.br/pesquisa_legislacao/111443/decreto-numerado-10799"
    },
    {
      "titulo":"Convenio ICMS 142/2018",
      "referencia":"Clausulas segunda, setima, oitava e nona; Anexo XVI",
      "url":"https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18"
    },
    {
      "titulo":"Manual do PGDAS-D",
      "referencia":"Segregacao do ICMS por substituto e substituido tributario",
      "url":"https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_PGDAS-D_2018_V4.pdf"
    }
  ]$$::jsonb,
  '2025-10-21',
  null,
  true
)
on conflict (codigo_regra, versao) do update set
  tributos = excluded.tributos,
  tipo_correspondencia = excluded.tipo_correspondencia,
  padroes = excluded.padroes,
  padroes_excluir = excluded.padroes_excluir,
  prioridade = excluded.prioridade,
  categoria = excluded.categoria,
  titulo = excluded.titulo,
  explicacao = excluded.explicacao,
  descricao_obrigatoria = excluded.descricao_obrigatoria,
  palavras_incluir = excluded.palavras_incluir,
  palavras_excluir = excluded.palavras_excluir,
  cests = excluded.cests,
  correspondencias_cest = excluded.correspondencias_cest,
  ufs_destino = excluded.ufs_destino,
  exige_cest = excluded.exige_cest,
  descricao_legal = excluded.descricao_legal,
  resultados = excluded.resultados,
  condicoes = excluded.condicoes,
  alertas = excluded.alertas,
  fontes = excluded.fontes,
  vigencia_inicio = excluded.vigencia_inicio,
  vigencia_fim = excluded.vigencia_fim,
  ativo = excluded.ativo,
  updated_at = now();

comment on column public.tributario_ncm_regras.cests is
  'CESTs estaduais aceitos pela regra, armazenados somente com sete digitos.';
comment on column public.tributario_ncm_regras.correspondencias_cest is
  'Pares versionados de CEST e faixas de NCM; impede aceitar apenas a presenca em uma lista geral do segmento.';
comment on column public.tributario_ncm_regras.ufs_destino is
  'UFs para as quais a regra foi juridicamente validada; lista vazia significa regra nao estadual.';
comment on column public.tributario_ncm_regras.descricao_legal is
  'Resumo da descricao legal que deve ser confrontada com a mercadoria, sem substituir o texto normativo.';
