'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import FormularioAcessoAntecipado from './_components/FormularioAcessoAntecipado'

const C = { bg: '#f6f9fc', panel: '#ffffff', border: '#d6e1ec', cyan: '#10a9d1', text: '#10263d', muted: '#526a82', gold: '#a97816', green: '#168a55' }
const V: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'radial-gradient(900px 520px at 82% -8%, rgba(45,199,239,.16) 0%, transparent 62%), #f6f9fc', color: C.text, fontFamily: '"Segoe UI Variable Text", "Segoe UI", Arial, sans-serif', fontSize: 16, lineHeight: 1.6 },
  wrap: { width: 'min(1180px, calc(100% - 40px))', margin: '0 auto' }, nav: { height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #dce6ef' }, navLinks: { display: 'flex', gap: 22, alignItems: 'center', color: C.muted, fontSize: 14 },
  primary: { border: 0, borderRadius: 10, padding: '12px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 650, fontSize: 14, cursor: 'pointer', background: C.cyan, color: '#052235', textDecoration: 'none', boxShadow: '0 8px 20px rgba(16,169,209,.18)' },
  secondary: { border: '1px solid #b9cbdc', borderRadius: 10, padding: '12px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 650, fontSize: 14, background: '#ffffff', color: C.text, textDecoration: 'none' },
  hero: { padding: '42px 0 42px', display: 'grid', gridTemplateColumns: '1.04fr .96fr', gap: 40, alignItems: 'center' }, eyebrow: { display: 'inline-flex', color: '#087fa3', border: '1px solid rgba(16,169,209,.34)', background: 'rgba(16,169,209,.08)', padding: '6px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '.055em', textTransform: 'uppercase' }, h1: { fontFamily: '"Segoe UI Variable Display", "Segoe UI", Arial, sans-serif', fontWeight: 500, fontSize: 'clamp(38px,4.35vw,56px)', lineHeight: 1.08, margin: '16px 0', letterSpacing: '-.035em' }, heroText: { fontSize: 16, lineHeight: 1.65, color: C.muted, maxWidth: 650, margin: '0 0 16px' }, offer: { color: '#334d66', fontSize: 14, lineHeight: 1.55, margin: '0 0 20px' }, actions: { display: 'flex', gap: 12, flexWrap: 'wrap' }, proof: { fontSize: 13, color: '#6b8095', marginTop: 12 }, screen: { borderRadius: 20, border: '1px solid #b9cad9', background: '#10223a', boxShadow: '0 24px 60px rgba(25,59,91,.18)', overflow: 'hidden' },
  section: { padding: '56px 0' }, alt: { padding: '56px 0', background: 'linear-gradient(180deg,#edf5fa,#f7fafc)', borderTop: '1px solid #dce7ef', borderBottom: '1px solid #dce7ef' }, heading: { maxWidth: 800, marginBottom: 26 }, h2: { fontFamily: '"Segoe UI Variable Display", "Segoe UI", Arial, sans-serif', fontWeight: 500, fontSize: 'clamp(28px,2.7vw,36px)', lineHeight: 1.18, margin: '0 0 12px', letterSpacing: '-.025em' }, lead: { color: C.muted, margin: 0, fontSize: 16, lineHeight: 1.65 }, grid3: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }, grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }, grid2: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }, card: { background: '#ffffff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: '0 10px 28px rgba(25,59,91,.06)' }, icon: { width: 40, height: 40, borderRadius: 11, background: 'rgba(16,169,209,.10)', border: '1px solid rgba(16,169,209,.28)', color: C.cyan, display: 'grid', placeItems: 'center', fontWeight: 700, marginBottom: 15 }, cardTitle: { margin: '0 0 8px', fontSize: 17, fontWeight: 650, lineHeight: 1.35 }, cardText: { margin: 0, color: C.muted, fontSize: 14.5, lineHeight: 1.6 },
  quote: { marginTop: 22, padding: '18px 22px', borderLeft: `3px solid ${C.gold}`, background: '#fff9e9', borderRadius: '0 14px 14px 0', color: '#76520d', fontSize: 17, lineHeight: 1.5, fontWeight: 600 },
  feature: { display: 'grid', gridTemplateColumns: '.95fr 1.05fr', gap: 36, alignItems: 'center', marginBottom: 62 }, shot: { borderRadius: 17, padding: 6, background: '#10263d', border: '1px solid #b9cad9', boxShadow: '0 16px 40px rgba(25,59,91,.13)', overflow: 'hidden' }, bullets: { display: 'grid', gap: 9, marginTop: 18, color: '#334d66', fontSize: 15 },
  status: { display: 'inline-flex', borderRadius: 99, padding: '5px 9px', fontSize: 11, fontWeight: 700, letterSpacing: '.045em', textTransform: 'uppercase', marginBottom: 14 },
  timeline: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, margin: '24px 0' }, timelineCard: { padding: 18, background: '#ffffff', border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: '0 8px 22px rgba(25,59,91,.05)' },
  ctaBox: { border: '1px solid rgba(16,169,209,.35)', borderRadius: 24, background: 'linear-gradient(130deg,#eaf8fc,#ffffff 60%,#edf6fb)', padding: 42, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 30, boxShadow: '0 18px 50px rgba(25,59,91,.10)' },
  faq: { display: 'grid', gap: 10, maxWidth: 900 }, faqItem: { border: `1px solid ${C.border}`, borderRadius: 13, background: '#ffffff', padding: '18px 20px', boxShadow: '0 6px 18px rgba(25,59,91,.04)' },
  footer: { padding: '30px 0', borderTop: '1px solid #dce6ef', color: '#6b8095', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
}

const useCases = [
  ['Auditor SPED', 'Cruze SPED Fiscal e SPED Contribuições e identifique documentos ausentes, divergências e situações que merecem revisão.'],
  ['Validador NF-e', 'Importe XMLs, analise documentos e itens, valide operações e organize sua base fiscal.'],
  ['Simples Nacional', 'Confronte faturamento fiscal com PGDAS-D e identifique divergências na receita declarada.'],
  ['Relatórios', 'Analise dados por documento, produto, fornecedor, CFOP, NCM e competência.'],
  ['Planejamento tributário', 'Simule cenários e compare regimes para apoiar análises tributárias.'],
  ['Reforma tributária', 'Analise documentos e campos relacionados ao IBS e à CBS nas funcionalidades disponíveis do módulo.'],
]

const roadmap = [
  ['Disponível', 'Auditor SPED', 'Cruzamentos entre SPED Fiscal e Contribuições, regras e exportações.', 'ready'],
  ['Disponível', 'Validador NF-e e relatórios', 'Importação de XML, validação por item e relatórios fiscais.', 'ready'],
  ['Em validação', 'Simples Nacional', 'Confronto entre faturamento fiscal, apuração e PGDAS-D.', 'validating'],
  ['Em validação', 'Planejamento tributário', 'Simulações comparativas para apoiar estudos de regime.', 'validating'],
  ['Em desenvolvimento', 'Reforma tributária', 'Evolução das análises de IBS e CBS conforme a implementação dos documentos.', 'building'],
  ['Planejado', 'Novos cruzamentos', 'Expansão do catálogo conforme validação técnica e feedback dos participantes.', 'planned'],
]

const faq = [
  ['O teste é realmente gratuito?', 'Sim. Você terá 7 dias para conhecer a plataforma sem cobrança.'],
  ['Preciso cadastrar cartão para testar?', 'Não. Durante os 7 dias de teste não é necessário cadastrar cartão.'],
  ['O que acontece depois dos 7 dias?', 'Você poderá encerrar o acesso ou continuar participando do Programa de Acesso Antecipado por R$ 79/mês.'],
  ['Existe fidelidade?', 'Não durante o Programa de Acesso Antecipado.'],
  ['O Enfokus substitui meu sistema contábil?', 'Não. O Enfokus complementa seu sistema atual, atuando principalmente nas etapas de conferência, cruzamento, auditoria e análise.'],
  ['Posso utilizar dados de clientes reais?', 'Sim, desde que você tenha autorização para tratar esses dados. A plataforma utiliza acesso autenticado, isolamento dos dados por organização e controles de segurança compatíveis com a operação. Consulte nossa Política de Privacidade.'],
  ['O produto já está finalizado?', 'Não. O Enfokus está em fase de acesso antecipado. O núcleo da plataforma já pode ser utilizado, enquanto funcionalidades continuam sendo evoluídas com base no uso e no feedback dos primeiros profissionais.'],
]

function Check({ children }: { children: React.ReactNode }) { return <div><span style={{ color: C.green, fontWeight: 700, marginRight: 9 }}>✓</span>{children}</div> }

function ExpandableImage({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  const [aberta, setAberta] = useState(false)
  useEffect(() => {
    if (!aberta) return
    const fechar = (event: KeyboardEvent) => { if (event.key === 'Escape') setAberta(false) }
    document.addEventListener('keydown', fechar)
    return () => document.removeEventListener('keydown', fechar)
  }, [aberta])

  return <>
    <button type="button" className="lp-image-button" onClick={() => setAberta(true)} aria-label={`Ampliar imagem: ${alt}`}>
      <img src={src} alt={alt} style={{ width: '100%', height: 'auto', display: 'block', ...style }} />
      <span className="lp-image-hint">Clique para ampliar</span>
    </button>
    {aberta && <div className="lp-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setAberta(false)}>
      <button type="button" className="lp-lightbox-close" onClick={() => setAberta(false)} aria-label="Fechar imagem ampliada">×</button>
      <img src={src} alt={alt} onClick={event => event.stopPropagation()} />
    </div>}
  </>
}

export default function LandingPage() {
  const cta = { href: '#solicitar-acesso' }
  return <div className="lp-page" style={V.page}>
    <header><div style={V.wrap}><nav style={V.nav} aria-label="Navegação principal">
      <a href="#top" style={{ display: 'inline-flex', padding: '7px 11px', borderRadius: 9, background: '#10263d' }}><img src="/logo-enfokus-white.png" alt="Enfokus" style={{ height: 25, display: 'block' }} /></a>
      <div className="lp-navlinks" style={V.navLinks}><a href="#como-funciona">Como funciona</a><a href="#recursos">Funcionalidades</a><a href="#consulta-tributaria">CNAE e NCM</a><a href="#telas">Telas reais</a><a href="#roadmap">Roadmap</a></div>
      <div style={{ display: 'flex', gap: 10 }}><Link href="/login" style={{ ...V.secondary, padding: '10px 15px' }}>Entrar</Link><a {...cta} style={{ ...V.primary, padding: '10px 15px' }}>Quero testar por 7 dias</a></div>
    </nav></div></header>

    <main id="top">
      <div style={V.wrap}><section className="lp-hero" style={V.hero}>
        <div><span style={V.eyebrow}>Programa de Acesso Antecipado</span><h1 style={V.h1}>Pare de gastar horas reunindo dados para <em style={{ color: C.cyan, fontStyle: 'normal' }}>começar uma análise.</em></h1>
          <p style={V.heroText}>O Enfokus Auditor cruza SPED, XML, PGDAS-D e outras informações fiscais para ajudar contadores, consultores e auditores a encontrar divergências e direcionar suas análises com muito mais rapidez.</p>
          <p style={V.offer}><strong>7 dias gratuitos com acompanhamento</strong> · Depois, condição especial de R$ 79/mês durante o acesso antecipado.</p>
          <div style={V.actions}><a {...cta} style={V.primary}>Quero testar por 7 dias</a><a href="#recursos" style={V.secondary}>Ver o que o Enfokus analisa</a></div>
          <p style={V.proof}>Sem fidelidade. Você testa com um caso real da sua rotina.</p>
        </div>
        <div style={V.screen}><ExpandableImage src="/landing/dashboard-atual-anonimizado.png" alt="Dashboard fiscal atualizado do Enfokus Auditor com dados demonstrativos" /></div>
      </section></div>

      <section style={V.alt}><div style={V.wrap}>
        <div style={V.heading}><h2 style={V.h2}>Quanto do seu tempo técnico ainda é gasto montando planilhas?</h2><p style={V.lead}>Quem realiza conferência fiscal, auditoria ou planejamento sabe: muitas vezes, a análise não é a parte mais demorada. O tempo vai embora reunindo arquivos, consolidando dados, comparando documentos e procurando onde está a divergência.</p></div>
        <div className="lp-grid4" style={V.grid4}>{['Horas cruzando informações manualmente','Planilhas espalhadas entre diferentes fontes','Dificuldade para revisar o trabalho da equipe','Tempo técnico consumido antes da análise começar'].map((x,i)=><article style={V.card} key={x}><div style={V.icon}>0{i+1}</div><h3 style={V.cardTitle}>{x}</h3></article>)}</div>
        <p style={{ ...V.quote, fontSize: 18 }}>O Enfokus foi criado para reduzir essa etapa operacional. Menos tempo procurando. Mais tempo analisando.</p>
      </div></section>

      <section style={V.section}><div style={V.wrap}><div className="lp-origin" style={{ display: 'grid', gridTemplateColumns: '1fr .8fr', gap: 28, alignItems: 'center' }}>
        <div><span style={V.eyebrow}>Uma ferramenta nascida na rotina contábil</span><h2 style={{ ...V.h2, marginTop: 14 }}>Criado por quem sentia essa dor todos os meses.</h2><p style={V.lead}>O Enfokus Auditor começou dentro de um escritório contábil. Foi criado para revisar fechamentos fiscais, validar documentos e acelerar análises tributárias que antes exigiam horas de conferências manuais.</p><p style={{ ...V.lead, marginTop: 14 }}>À medida que novas dores apareciam na rotina, novas funcionalidades eram incorporadas. O que era uma ferramenta interna evoluiu para uma plataforma voltada a profissionais que enfrentam os mesmos desafios.</p></div>
        <div style={{ ...V.card, borderColor: '#e5cf9b', background: 'linear-gradient(145deg,#fff9e9,#ffffff)' }}><p style={{ color: C.gold, fontSize: 21, lineHeight: 1.4, fontWeight: 600, margin: 0 }}>Criado por profissionais da área, para profissionais da área.</p></div>
      </div></div></section>

      <section id="como-funciona" style={V.alt}><div style={V.wrap}><div style={V.heading}><h2 style={V.h2}>Da informação bruta à análise em três passos.</h2></div><div className="lp-grid3" style={V.grid3}>
        {[['Importe','Traga SPED, XML, PGDAS-D e demais informações utilizadas na análise.'],['Cruze','O Enfokus organiza os dados e executa cruzamentos e regras automaticamente.'],['Analise','Você recebe os pontos que merecem atenção e utiliza seu conhecimento técnico para decidir o que fazer.']].map((x,i)=><article style={V.card} key={x[0]}><div style={V.icon}>0{i+1}</div><h3 style={V.cardTitle}>{x[0]}</h3><p style={V.cardText}>{x[1]}</p></article>)}</div><div style={V.quote}>O sistema organiza e encontra os sinais. A decisão continua sendo do profissional.</div></div></section>

      <section id="recursos" style={V.section}><div style={V.wrap}><div style={V.heading}><h2 style={V.h2}>O que você pode analisar com o Enfokus.</h2><p style={V.lead}>Casos de uso para conferência, revisão e apoio à decisão na rotina fiscal e tributária.</p></div><div className="lp-grid3" style={V.grid3}>{useCases.map(([t,d])=><article style={V.card} key={t}><h3 style={{ ...V.cardTitle, color: '#087fa3' }}>{t}</h3><p style={V.cardText}>{d}</p></article>)}</div>
        <details style={{ ...V.faqItem, marginTop: 22 }}><summary style={{ cursor: 'pointer', color: '#087fa3', fontWeight: 650 }}>Ver todas as funcionalidades</summary><div className="lp-grid3" style={{ ...V.grid3, marginTop: 20 }}>
          <div><h3 style={V.cardTitle}>Auditoria e regras fiscais</h3><div style={V.bullets}><Check>Importação e análise de SPED Fiscal e Contribuições</Check><Check>Cruzamento entre arquivos e documentos ausentes</Check><Check>Regras para CFOP, ICMS, PIS, COFINS, CST e itens C170</Check><Check>Central de inconsistências por nível de risco</Check></div></div>
          <div><h3 style={V.cardTitle}>XML, NF-e e relatórios</h3><div style={V.bullets}><Check>Importação de XML e ZIP com validação de CNPJ</Check><Check>Classificação fiscal por documento e item</Check><Check>Relatórios por documento, participante, produto, NCM e CFOP</Check><Check>Filtros por competência e exportação para Excel</Check></div></div>
          <div><h3 style={V.cardTitle}>Simples e Editor SPED</h3><div style={V.bullets}><Check>Conferência entre faturamento fiscal e PGDAS-D</Check><Check>Tratamento de devoluções e divergências de receita</Check><Check>Mesclagem de SPED base com Bloco K</Check><Check>Validação, comparação e tratamento de conflitos</Check></div></div>
        </div></details>
      </div></section>

      <section style={V.alt} id="consulta-tributaria"><div style={V.wrap}>
        <div style={V.heading}><span style={V.eyebrow}>Consulta tributária em destaque</span><h2 style={{ ...V.h2, marginTop: 14 }}>Análise de CNAE e NCM com contexto para decidir.</h2><p style={V.lead}>Consulte a atividade ou o produto e receba uma leitura organizada das regras que merecem validação. O Enfokus reúne fontes oficiais, hipóteses tributárias e pontos de atenção sem transformar a consulta em uma conclusão automática.</p></div>
        <div className="lp-feature" style={{ ...V.feature, gridTemplateColumns: '.72fr 1.28fr', marginBottom: 34 }}>
          <article style={{ ...V.card, borderColor: 'rgba(16,169,209,.38)' }}><span style={V.eyebrow}>CNAE e anexos</span><h3 style={{ ...V.cardTitle, fontSize: 22, marginTop: 13 }}>Regra principal do Simples e condições que podem alterar o anexo.</h3><p style={V.cardText}>Consulte a atividade oficial pelo código CNAE, identifique situações como Fator R e veja o que precisa ser confirmado antes de aplicar o enquadramento.</p><div style={V.bullets}><Check>Descrição oficial e fonte IBGE</Check><Check>Anexo ou regra principal aplicável</Check><Check>Condições e validações necessárias</Check></div></article>
          <div style={V.shot}><ExpandableImage src="/landing/consulta-cnae-anonimizada.png" alt="Análise de CNAE e anexos do Simples Nacional com dados demonstrativos" style={{ borderRadius: 11 }} /></div>
        </div>
        <div className="lp-feature lp-reverse" style={{ ...V.feature, gridTemplateColumns: '.72fr 1.28fr', marginBottom: 26 }}>
          <article style={{ ...V.card, borderColor: 'rgba(169,120,22,.38)' }}><span style={{ ...V.eyebrow, color: '#87600f', borderColor: 'rgba(169,120,22,.34)', background: 'rgba(169,120,22,.08)' }}>NCM · PIS/Cofins · IPI</span><h3 style={{ ...V.cardTitle, fontSize: 22, marginTop: 13 }}>Tributação do produto com alertas sobre informações pendentes.</h3><p style={V.cardText}>Consulte o NCM e veja regras cadastradas, efeitos no Simples Nacional, referências legais e confirmações necessárias sobre produto, operação e papel da empresa na cadeia.</p><div style={V.bullets}><Check>PIS, Cofins e IPI por NCM</Check><Check>Efeito potencial na segregação do PGDAS-D</Check><Check>Base legal e análise complementar</Check></div></article>
          <div style={V.shot}><ExpandableImage src="/landing/consulta-ncm-anonimizada.png" alt="Detalhe da análise tributária de NCM para PIS, Cofins e IPI" style={{ borderRadius: 11 }} /></div>
        </div>
        <div style={{ ...V.quote, borderLeftColor: C.cyan, background: '#edf9fc', color: '#174b5b' }}>A consulta organiza a regra, mostra as ressalvas e indica o que precisa ser confirmado. A conclusão continua sendo técnica e profissional.</div>
      </div></section>

      <section style={V.section} id="auditoria"><div style={V.wrap}><div style={V.heading}><span style={V.eyebrow}>Núcleo disponível</span><h2 style={{ ...V.h2, marginTop: 14 }}>Auditor SPED: conflitos reunidos em um fluxo de revisão.</h2><p style={V.lead}>Cruze SPED Fiscal e SPED Contribuições, interprete registros relevantes e concentre pontos de atenção em uma mesma tela.</p></div><div className="lp-grid2" style={V.grid2}>
        <div style={V.card}><h3 style={V.cardTitle}>Cruzamentos e regras</h3><div style={V.bullets}><Check>Notas presentes em um SPED e ausentes no outro</Check><Check>CFOP de entrada e saída possivelmente invertido</Check><Check>Divergências de base, CST, ICMS, PIS e COFINS</Check><Check>Possível crédito indevido em uso e consumo</Check><Check>Validação analítica dos itens C170</Check></div></div>
        <div style={{ ...V.card, borderColor: 'rgba(66,226,141,.4)' }}><h3 style={V.cardTitle}>Apoio prático à revisão</h3><div style={V.bullets}><Check>Alertas classificados por nível de risco</Check><Check>Central de inconsistências com filtros</Check><Check>Exportações para documentar a análise</Check><Check>Mais contexto para decidir por onde começar</Check></div></div>
      </div></div></section>

      <section style={V.section}><div style={V.wrap}><div className="lp-difference" style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 30, alignItems: 'center' }}><div><span style={V.eyebrow}>Uma camada adicional de inteligência</span><h2 style={{ ...V.h2, marginTop: 14 }}>Não queremos substituir seu sistema fiscal.</h2><p style={V.lead}>Seu ERP ou sistema contábil continua responsável pela escrituração e pelo fechamento. O Enfokus entra em outra etapa: conferência, cruzamento, revisão e análise.</p></div><div style={V.quote}>Seu sistema fiscal fecha.<br />O Enfokus confere, cruza e ajuda você a decidir.</div></div></div></section>

      <section id="telas" style={V.alt}><div style={V.wrap}><div style={V.heading}><h2 style={V.h2}>Telas reais da plataforma.</h2><p style={V.lead}>Veja como os módulos organizam diferentes etapas da rotina: da entrada dos arquivos à conferência, ao relatório e ao apoio à decisão. Todos os dados exibidos abaixo são demonstrativos.</p></div>
        <div className="lp-feature" style={V.feature}><div><span style={V.eyebrow}>Validador NF-e / NFS-e</span><h3 style={{ fontSize: 25, fontWeight: 550, lineHeight: 1.3, margin: '12px 0' }}>Documentos, itens e classificações em uma visão operacional.</h3><p style={V.lead}>Importe NF-e e NFS-e, filtre por nota, fornecedor, CFOP, NCM e classificação, alterne entre entradas, saídas, serviços e resumo de CFOP e leve os dados para a apuração ou para o Excel.</p></div><div style={V.shot}><ExpandableImage src="/landing/validador-atual-anonimizado.png" alt="Validador NF-e e NFS-e atualizado do Enfokus com dados demonstrativos" style={{ borderRadius: 12 }} /></div></div>
        <div className="lp-feature lp-reverse" style={V.feature}><div><span style={V.eyebrow}>Simples Nacional</span><h3 style={{ fontSize: 25, fontWeight: 550, lineHeight: 1.3, margin: '12px 0' }}>Confronto mensal entre PGDAS-D e receita fiscal.</h3><p style={V.lead}>Compare receita declarada, receita considerada pelos XMLs, quantidade de documentos, variações e diferenças de DAS por período, com status para priorizar o que precisa de revisão.</p></div><div style={V.shot}><ExpandableImage src="/landing/simples-atual-anonimizado.png" alt="Confronto atualizado do Simples Nacional com dados demonstrativos" style={{ borderRadius: 12 }} /></div></div>
        <div className="lp-feature" style={{ ...V.feature, marginBottom: 38 }}><div><span style={V.eyebrow}>Relatórios fiscais</span><h3 style={{ fontSize: 25, fontWeight: 550, lineHeight: 1.3, margin: '12px 0' }}>Da visão consolidada ao detalhe do documento.</h3><p style={V.lead}>Consulte inconsistências, entradas e saídas, quantidade de documentos, produtos, participantes e CFOP. Combine filtros, pesquise participantes ou notas e exporte o resultado para Excel ou PDF.</p></div><div style={V.shot}><ExpandableImage src="/landing/relatorios-atual-anonimizado.png" alt="Relatórios fiscais atualizados do Enfokus com dados demonstrativos" style={{ borderRadius: 12 }} /></div></div>
        <div className="lp-screens" style={V.grid3}>{[
          ['dashboard-atual-anonimizado.png','Dashboard fiscal','Indicadores de entradas, saídas, alertas e evolução mensal em uma visão gerencial.'],
          ['editor-atual-anonimizado.png','Editor SPED Fiscal','Fluxo guiado em sete etapas para validar, comparar, tratar conflitos e gerar o arquivo.'],
          ['planejamento-atual-anonimizado.png','Planejamento Tributário','Seleção de empresas, período e premissas para simulações comparativas.'],
        ].map(([img,label,desc])=><figure style={{ ...V.shot, margin: 0, background: '#ffffff' }} key={img}><ExpandableImage src={`/landing/${img}`} alt={`${label} do Enfokus com dados demonstrativos`} style={{ borderRadius: 10 }} /><figcaption style={{ padding: '13px 10px 8px', color: C.text, fontSize: 14 }}><strong style={{ display: 'block', marginBottom: 4 }}>{label}</strong><span style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>{desc}</span></figcaption></figure>)}</div>
      </div></section>

      <section id="roadmap" style={V.section}><div style={V.wrap}><div style={V.heading}><h2 style={V.h2}>Roadmap com status claro.</h2><p style={V.lead}>O acesso antecipado combina um núcleo utilizável com funcionalidades em diferentes estágios de evolução.</p></div><div className="lp-grid3" style={V.grid3}>{roadmap.map(([status,title,desc,kind])=>{const palette=kind==='ready'?['rgba(66,226,141,.12)',C.green]:kind==='validating'?['rgba(45,199,239,.11)','#74def7']:kind==='building'?['rgba(214,178,92,.11)',C.gold]:['rgba(148,163,184,.1)','#94a3b8'];return <article style={V.card} key={title}><span style={{ ...V.status, background: palette[0], color: palette[1], border: `1px solid ${palette[1]}55` }}>{status}</span><h3 style={V.cardTitle}>{title}</h3><p style={V.cardText}>{desc}</p></article>})}</div></div></section>

      <section style={V.alt} id="acesso-antecipado"><div style={V.wrap}><div style={V.heading}><span style={V.eyebrow}>Programa de Acesso Antecipado</span><h2 style={{ ...V.h2, marginTop: 14 }}>Teste o Enfokus em um caso real da sua rotina.</h2><p style={V.lead}>Durante 7 dias, você testa a plataforma com acompanhamento. Antes de liberar o acesso, entendemos rapidamente sua rotina e escolhemos junto com você uma análise real para direcionar sua experiência.</p></div>
        <div className="lp-timeline" style={V.timeline}>{[['Dia 0','Entendemos sua rotina e definimos o caso de teste.'],['Dia 1','Liberamos o acesso e orientamos os primeiros passos.'],['Dia 3','Acompanhamos a experiência e tiramos dúvidas.'],['Dia 7','Coletamos seu feedback e avaliamos a continuidade.']].map(([d,t])=><div style={V.timelineCard} key={d}><strong style={{ color: C.cyan }}>{d}</strong><p style={{ ...V.cardText, marginTop: 8 }}>{t}</p></div>)}</div>
        <div className="lp-program" style={V.ctaBox}><div><h3 style={{ fontSize: 25, fontWeight: 550, margin: '0 0 10px' }}>Gostou e quer continuar?</h3><p style={{ color: C.muted, margin: 0 }}>Participantes poderão continuar utilizando a plataforma por <strong style={{ color: C.text }}>R$ 79/mês</strong> — condição especial enquanto durar o Programa de Acesso Antecipado.</p><div style={V.bullets}><Check>Sem fidelidade durante o programa</Check><Check>Canal direto para feedback</Check><Check>Participação próxima na evolução da plataforma</Check></div></div><a {...cta} style={V.primary}>Quero participar do acesso antecipado</a></div>
      </div></section>

      <FormularioAcessoAntecipado />

      <section style={V.section}><div style={V.wrap}><div style={V.heading}><h2 style={V.h2}>Perguntas frequentes.</h2></div><div style={V.faq}>{faq.map(([q,a])=><details style={V.faqItem} key={q}><summary style={{ cursor: 'pointer', fontWeight: 650 }}>{q}</summary><p style={{ color: C.muted, margin: '12px 0 0' }}>{a}</p></details>)}</div></div></section>

      <section style={{ padding: '0 0 56px' }}><div style={V.wrap}><div className="lp-final" style={V.ctaBox}><div><span style={V.eyebrow}>7 dias gratuitos + acompanhamento</span><h2 style={{ ...V.h2, marginTop: 14 }}>Seu conhecimento vale mais do que horas de trabalho manual.</h2><p style={{ color: C.muted, margin: 0 }}>Teste o Enfokus Auditor em um caso real da sua rotina e veja quanto do processo de conferência pode ser simplificado.</p><p style={{ color: '#6b8095', fontSize: 13 }}>Após o teste, continue por R$ 79/mês durante o Programa de Acesso Antecipado.</p></div><a {...cta} style={V.primary}>Quero testar o Enfokus</a></div></div></section>
    </main>
    <footer><div style={V.wrap}><div style={V.footer}><span>© {new Date().getFullYear()} Enfokus Auditor</span><span><Link href="/privacidade" style={{ color: 'inherit' }}>Privacidade</Link> · <Link href="/termos" style={{ color: 'inherit' }}>Termos</Link></span></div></div></footer>
    <style>{`html{scroll-behavior:smooth}.lp-page h1,.lp-page h2,.lp-page h3{font-family:"Segoe UI Variable Display","Segoe UI",Arial,sans-serif}.lp-page strong{font-weight:650}.lp-page button,.lp-page a{letter-spacing:0}.lp-navlinks a{color:inherit;text-decoration:none}.lp-navlinks a:hover{color:#087fa3}.lp-image-button{position:relative;display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in;overflow:hidden;border-radius:inherit}.lp-image-button:focus-visible{outline:3px solid #10a9d1;outline-offset:3px}.lp-image-hint{position:absolute;right:12px;bottom:12px;padding:7px 10px;border-radius:8px;background:rgba(6,25,43,.84);color:#fff;font-size:12px;font-weight:600;opacity:0;transform:translateY(4px);transition:.2s}.lp-image-button:hover .lp-image-hint,.lp-image-button:focus-visible .lp-image-hint{opacity:1;transform:none}.lp-lightbox{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:28px;background:rgba(3,13,24,.88);backdrop-filter:blur(8px);cursor:zoom-out}.lp-lightbox img{display:block;max-width:96vw;max-height:91vh;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:0 28px 90px rgba(0,0,0,.45);cursor:default}.lp-lightbox-close{position:fixed;top:18px;right:22px;width:44px;height:44px;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(6,25,43,.85);color:#fff;font-size:30px;line-height:1;cursor:pointer;z-index:1}@media(max-width:900px){.lp-hero,.lp-origin,.lp-difference,.lp-feature{grid-template-columns:1fr!important}.lp-grid4,.lp-timeline{grid-template-columns:repeat(2,1fr)!important}.lp-program,.lp-final{grid-template-columns:1fr!important}.lp-program a,.lp-final a{width:fit-content}.lp-reverse>div:first-child{order:0}}@media(max-width:700px){.lp-navlinks{display:none!important}.lp-grid3,.lp-grid2,.lp-grid4,.lp-screens,.lp-timeline{grid-template-columns:1fr!important}.lp-hero{padding-top:28px!important}.lp-hero h1{font-size:36px!important;line-height:1.12!important}.lp-feature{margin-bottom:34px!important}.lp-program,.lp-final{padding:24px!important}.lp-program a,.lp-final a{width:100%}.lp-navlinks+div>a:last-child{display:none!important}.lp-image-hint{display:none}.lp-lightbox{padding:12px}.lp-lightbox img{max-width:98vw;max-height:88vh}}`}</style>
  </div>
}
