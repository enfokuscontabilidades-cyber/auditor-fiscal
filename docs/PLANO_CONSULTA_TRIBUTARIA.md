# Plano de evolução — Consulta Tributária

## Objetivo

Criar uma base tributária reutilizável para consulta individual, apoio à apuração do Simples Nacional e futuras validações de documentos fiscais e SPED, sem transformar o CNAE ou o NCM em decisão automática quando a legislação exigir análise da operação.

## Princípios de segurança fiscal

- Separar dado oficial, regra jurídica e conclusão apresentada ao usuário.
- Registrar a fonte, a versão da regra, o grau de confiança, as condições e os alertas de cada resposta.
- Não definir o anexo exclusivamente pelo CNAE quando contrato, receita efetiva, código do serviço ou Fator R forem necessários.
- Não substituir a escolha atual na apuração do Simples: inicialmente, apenas sugerir e alertar divergências.
- Segregar receita por natureza e tratamento tributário; uma empresa e até uma mesma atividade podem gerar receitas em anexos diferentes.
- Versionar regras por vigência para preservar a reprodutibilidade de apurações antigas.

## Etapa 1 — Catálogo CNAE e enquadramento indicativo (implementada)

- Consulta de qualquer CNAE por código ou descrição.
- Descrição, hierarquia, atividades compreendidas e observações provenientes da CNAE-Subclasses/CONCLA do IBGE.
- Classificação da natureza: comércio, indústria, serviço, construção, transporte e demais grupos.
- Indicação conservadora de Anexo I, II, III, IV, Fator R ou resultado inconclusivo.
- Exibição de condições, alertas, grau de confiança, versão da regra e links para fontes oficiais.
- Simulador informativo do Fator R.
- Autenticação obrigatória na API e cache da fonte oficial por 24 horas.
- Nenhuma alteração no cálculo vigente do Simples Nacional.

## Etapa 2 — Revisão jurídica ampliada dos serviços (em andamento)

- Estruturar tabela versionada de atividades e hipóteses legais, com vigência inicial e final. **Implementado:** catálogo global `tributario_cnae_regras`, protegido por RLS, com versões imutáveis e fallback seguro para as regras locais.
- Integrar a consulta de CNAE ao catálogo vigente sem alterar as configurações manuais das empresas. **Implementado.**
- Publicar o primeiro lote de regras exatas de alta confiança para advocacia, vigilância, limpeza, contabilidade, agência de viagem, atividades sujeitas ao Fator R e serviços selecionados de instalação/acabamento. **Implementado na migração `supabase_migration_consulta_tributaria_cnae.sql`.**
- Registrar entendimentos administrativos (como Soluções de Consulta Cosit) separadamente da regra legal geral, indicando alcance, data, efeito e condições de aplicação. **Estrutura implementada; primeiro caso: CNAE 7410-2/02, conforme SC Cosit nº 243/2025.**
- Diferenciar, no CNAE 7410-2/02, o desenvolvimento de projetos de design de interiores (Anexo III ou V pelo Fator R) da execução efetiva de decoração de interiores (Anexo IV). **Implementado.**
- Relacionar CNAE, item da lista da LC nº 116/2003, código municipal de serviço e palavras de contexto. **Estrutura versionada e primeiro lote de correspondências implementados; ampliação do catálogo continua por lotes revisados.**
- Cobrir expressamente as hipóteses dos Anexos III e IV e todas as atividades sujeitas ao Fator R.
- Tratar construção civil por natureza do contrato: obra, empreitada, subempreitada, serviço isolado e manutenção.
- Modelar impedimentos e exceções ao Simples separadamente do anexo.
- Criar casos de teste jurídicos com exemplos positivos, negativos e limítrofes.

## Etapa 3 — Integração consultiva com a apuração do Simples

- Vincular a receita de serviço ao CNAE e, quando disponível, ao código de serviço e à descrição da NFS-e. **Implementado o vínculo manual CNAE × código de serviço detectado na NFS-e.**
- Preservar o serviço da NFS-e como chave da apuração e usar o CNAE relacionado somente como conferência. **Implementado: o item nacional da Lista de Serviços tem prioridade; na sua ausência, o código municipal é identificado em conjunto com o município, evitando colisões.**
- Apresentar anexo sugerido, fundamento e confiança ao lado da seleção manual. **Implementado na configuração dos serviços, sem alterar o cálculo.**
- Alertar quando o anexo escolhido divergir da sugestão, sem impedir o fechamento. **Implementado; por decisão de produto, não há justificativa textual obrigatória.**
- Calcular o Fator R com folha e receita dos 12 meses anteriores e exibir a memória do cálculo.
- Guardar a decisão do usuário e a versão da regra utilizada para auditoria. **Implementado por trilha automática de criações e alterações, sem justificativa obrigatória.**
- Não reclassificar automaticamente apurações já fechadas.

## Etapa 4 — Catálogo NCM e tratamento por operação

- Importar e versionar a tabela oficial NCM, descrições e vigências.
- Modelar separadamente ICMS, PIS/Cofins e IPI; “monofásico”, “alíquota zero” e “ST” nunca serão um único marcador genérico.
- Considerar papel da empresa: fabricante/importador, atacadista, varejista e consumidor final.
- Considerar produto, NCM, CEST, origem, UF, CFOP, CST/CSOSN, regime e período.
- Tratar exceções por descrição do produto, finalidade, embalagem, concentração e demais critérios legais.
- Retornar conclusão por tributo, fundamento, vigência, confiança e dados ainda necessários.

## Etapa 5 — Integração NCM com Simples e documentos fiscais

- Segregar no PGDAS-D apenas o tributo alcançado pelo tratamento específico, mantendo os demais componentes do DAS.
- Comparar tratamento esperado com XML, NFS-e, SPED Fiscal e SPED Contribuições.
- Gerar alertas explicáveis, sem corrigir documento ou apuração automaticamente.
- Criar trilha de auditoria e relatório de divergências por empresa, competência, produto e fundamento legal.

## Fontes oficiais iniciais

- CNAE-Subclasses/CONCLA — IBGE.
- Lei Complementar nº 123/2006, especialmente art. 18 e Anexos I a V.
- Resolução CGSN nº 140/2018, texto vigente e consolidado.
- Perguntas e Respostas do Simples Nacional — Receita Federal/CGSN.
- Nas etapas de NCM: Portal Único Siscomex/TEC, EFD ICMS/IPI, EFD-Contribuições, legislação federal de PIS/Cofins e legislação estadual aplicável à operação.

## Critério de conclusão

Uma regra só poderá produzir sugestão de alta confiança quando todos os elementos jurídicos necessários estiverem disponíveis. Na ausência deles, o resultado deve indicar expressamente que é inconclusivo e solicitar os dados faltantes.
