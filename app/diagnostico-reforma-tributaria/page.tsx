'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import { AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle2, Clock3, Download, FileCheck2, FileSearch, Loader2, LockKeyhole, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react'
import { parseNfeParaDocumento } from '@/lib/nfe/parseNfe'

const PORTES = ['MEI', 'ME', 'EPP', 'Média empresa', 'Grande empresa', 'Não sei']
const REGIMES = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Não sei']
const FUNCIONARIOS = ['0', '1 a 5', '6 a 10', '11 a 20', '21 a 50', '51 a 100', 'Acima de 100']
const FATURAMENTOS = [
  'Até R$ 100 mil',
  'R$ 100 mil a R$ 200 mil',
  'R$ 200 mil a R$ 500 mil',
  'R$ 500 mil a R$ 1 milhão',
  'R$ 1 milhão a R$ 3 milhões',
  'Acima de R$ 3 milhões',
]
const SEGMENTOS = ['Serviço', 'Comércio atacadista', 'Comércio varejista', 'Indústria']

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const ALIQUOTA_IBS_UF_2026 = 0.1
const ALIQUOTA_CBS_2026 = 0.9

type FormLead = {
  nome: string
  telefone: string
  email: string
  empresa: string
  porte_empresa: string
  regime_tributario: string
  funcionarios_faixa: string
  faturamento_faixa: string
  segmentos: string[]
}

type LinhaRelatorio = {
  chave: string
  arquivo: string
  nota: string
  data: string
  participante: string
  produto: string
  ncm: string
  cfop: string
  valorItem: number
  cst: string
  cclass: string
  base: number
  aliquotaIbsUf: number
  valorIbsUf: number
  aliquotaIbsMun: number
  valorIbsMun: number
  valorIbs: number
  aliquotaCbs: number
  valorCbs: number
  destacado: boolean
  alertas: string[]
  situacao: 'ok' | 'alerta' | 'critico'
}

type BaseLinha = Omit<LinhaRelatorio, 'destacado' | 'alertas' | 'situacao'> & {
  destacado?: boolean
}

const formInicial: FormLead = {
  nome: '',
  telefone: '',
  email: '',
  empresa: '',
  porte_empresa: '',
  regime_tributario: '',
  funcionarios_faixa: '',
  faturamento_faixa: '',
  segmentos: [],
}

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function dataBr(data?: string) {
  if (!data) return '-'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

function arred2(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function temReforma(item: Pick<LinhaRelatorio, 'cst' | 'cclass' | 'base' | 'valorIbs' | 'valorCbs' | 'valorIbsUf' | 'valorIbsMun'>) {
  return Boolean(
    (item.cst && item.cst !== '-') ||
    (item.cclass && item.cclass !== '-') ||
    item.base > 0 ||
    item.valorIbs > 0 ||
    item.valorCbs > 0 ||
    item.valorIbsUf > 0 ||
    item.valorIbsMun > 0,
  )
}

function analisarLinha(base: Omit<LinhaRelatorio, 'alertas' | 'situacao'>): Pick<LinhaRelatorio, 'alertas' | 'situacao'> {
  const alertas: string[] = []

  if (!base.destacado) {
    alertas.push('Sem destaque de IBS/CBS')
  } else {
    if (!base.cst || base.cst === '-') alertas.push('CST IBS/CBS ausente')
    if (!base.cclass || base.cclass === '-') alertas.push('cClassTrib ausente')
    if (base.aliquotaIbsUf > 0 && Math.abs(base.aliquotaIbsUf - ALIQUOTA_IBS_UF_2026) > 0.0001) {
      alertas.push(`Alíquota IBS UF diferente de ${numberFmt.format(ALIQUOTA_IBS_UF_2026)}%`)
    }
    if (base.aliquotaCbs > 0 && Math.abs(base.aliquotaCbs - ALIQUOTA_CBS_2026) > 0.0001) {
      alertas.push(`Alíquota CBS diferente de ${numberFmt.format(ALIQUOTA_CBS_2026)}%`)
    }
    const baseCalculo = base.base || base.valorItem
    if (baseCalculo > 0 && base.valorIbsUf > 0) {
      const esperado = arred2(baseCalculo * (ALIQUOTA_IBS_UF_2026 / 100))
      if (Math.abs(base.valorIbsUf - esperado) > 0.02) alertas.push(`IBS UF esperado: ${money.format(esperado)}`)
    }
    if (baseCalculo > 0 && base.valorCbs > 0) {
      const esperado = arred2(baseCalculo * (ALIQUOTA_CBS_2026 / 100))
      if (Math.abs(base.valorCbs - esperado) > 0.02) alertas.push(`CBS esperado: ${money.format(esperado)}`)
    }
  }

  return { alertas, situacao: alertas.length ? (base.destacado ? 'alerta' : 'critico') : 'ok' }
}

function montarLinha(base: BaseLinha): LinhaRelatorio {
  const destacado = base.destacado ?? temReforma(base)
  const linhaBase = { ...base, destacado }
  return { ...linhaBase, ...analisarLinha(linhaBase) }
}

function lerArquivo(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`))
    reader.readAsText(file)
  })
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#f7faf9', color: '#17302e', overflowX: 'hidden' },
  shell: { width: 'min(1180px, calc(100% - 32px))', margin: '0 auto' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '22px 0' },
  logo: { width: 220, maxWidth: '58vw', height: 'auto', display: 'block' },
  hero: { position: 'relative', padding: '34px 0 62px' },
  heroGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(360px, .8fr)', gap: 42, alignItems: 'center' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #f2c6bf', background: '#fff2ef', color: '#a83b2d', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 900, letterSpacing: '.03em' },
  h1: { margin: '18px 0 0', color: '#17302e', fontSize: 'clamp(38px, 5.2vw, 68px)', lineHeight: .98, fontWeight: 950, letterSpacing: '-.045em', maxWidth: 760 },
  highlight: { color: '#168c80' },
  lead: { margin: '22px 0 0', color: '#536c68', fontSize: 18, lineHeight: 1.65, maxWidth: 720 },
  deadline: { display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 24, maxWidth: 720, borderLeft: '4px solid #e56755', background: '#fff', padding: '16px 18px', borderRadius: '0 14px 14px 0', boxShadow: '0 16px 40px rgba(30, 75, 69, .08)' },
  benefitGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 26, maxWidth: 780 },
  benefit: { border: '1px solid #dce8e5', background: 'rgba(255,255,255,.82)', borderRadius: 16, padding: 15 },
  panel: { background: '#fff', border: '1px solid #dce9e6', borderRadius: 24, boxShadow: '0 28px 80px rgba(27, 73, 67, .16)', overflow: 'hidden' },
  panelTop: { padding: '22px 22px 18px', background: 'linear-gradient(135deg, #173c38 0%, #1e6159 100%)', color: '#fff' },
  form: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 20 },
  fieldFull: { gridColumn: '1 / -1' },
  label: { display: 'block', marginBottom: 7, color: '#3d5652', fontSize: 12, fontWeight: 850 },
  input: { width: '100%', border: '1px solid #cadbd7', borderRadius: 12, padding: '12px 13px', background: '#fbfdfc', color: '#172b29', outline: 'none', fontSize: 14, boxSizing: 'border-box' },
  button: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: 0, background: 'linear-gradient(135deg, #59d7c9 0%, #32b9aa 100%)', color: '#103733', borderRadius: 13, padding: '14px 18px', fontWeight: 950, cursor: 'pointer', width: '100%', boxShadow: '0 12px 28px rgba(49, 185, 170, .26)' },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid #c9dbd7', background: '#fff', color: '#243f3b', borderRadius: 12, padding: '11px 15px', fontWeight: 850, cursor: 'pointer' },
  section: { marginTop: 24, padding: 22, background: '#fff', border: '1px solid #dce8e5', borderRadius: 20, boxShadow: '0 14px 38px rgba(32, 76, 70, .08)' },
  trustBar: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginTop: 4, background: '#dce8e5', border: '1px solid #dce8e5', borderRadius: 18, overflow: 'hidden' },
  trustItem: { display: 'flex', gap: 11, alignItems: 'flex-start', background: '#fff', padding: 18 },
}

export default function DiagnosticoReformaTributariaPage() {
  const [form, setForm] = useState<FormLead>(formInicial)
  const [leadId, setLeadId] = useState('')
  const [enviandoLead, setEnviandoLead] = useState(false)
  const [erroLead, setErroLead] = useState('')
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([])
  const [errosArquivos, setErrosArquivos] = useState<string[]>([])
  const [processando, setProcessando] = useState(false)

  const desbloqueado = Boolean(leadId)

  const totais = useMemo(() => ({
    xmlsLidos: new Set(linhas.map(l => l.arquivo)).size + errosArquivos.length,
    notasValidas: new Set(linhas.map(l => `${l.arquivo}|${l.nota}`)).size,
    itens: linhas.length,
    semDestaque: linhas.filter(l => !l.destacado).length,
    divergencias: linhas.filter(l => l.alertas.length).length,
    ibs: linhas.reduce((s, l) => s + l.valorIbs, 0),
    cbs: linhas.reduce((s, l) => s + l.valorCbs, 0),
  }), [errosArquivos.length, linhas])

  function alterarCampo(campo: keyof FormLead, valor: string) {
    setForm(atual => ({ ...atual, [campo]: valor }))
  }

  function alternarSegmento(segmento: string) {
    setForm(atual => ({
      ...atual,
      segmentos: atual.segmentos.includes(segmento)
        ? atual.segmentos.filter(s => s !== segmento)
        : [...atual.segmentos, segmento],
    }))
  }

  async function enviarLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroLead('')
    setEnviandoLead(true)

    try {
      const response = await fetch('/api/leads/reforma-tributaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, origem: 'diagnostico-reforma-tributaria' }),
      })
      const data = await response.json() as { ok?: boolean; leadId?: string; error?: string }
      if (!response.ok || !data.ok || !data.leadId) {
        throw new Error(data.error || 'Não foi possível liberar o diagnóstico agora.')
      }
      setLeadId(data.leadId)
    } catch (error) {
      setErroLead(error instanceof Error ? error.message : 'Não foi possível liberar o diagnóstico agora.')
    } finally {
      setEnviandoLead(false)
    }
  }

  async function analisarArquivos(files: FileList | null) {
    if (!files?.length) return
    setProcessando(true)
    setErrosArquivos([])

    const novasLinhas: LinhaRelatorio[] = []
    const novosErros: string[] = []

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.xml')) {
        novosErros.push(`${file.name}: envie apenas arquivos XML.`)
        continue
      }

      try {
        const xml = await lerArquivo(file)
        const resultado = parseNfeParaDocumento(xml, '', false, file.name)
        if (!resultado || !resultado.itens.length) {
          novosErros.push(`${file.name}: XML de NF-e não reconhecido ou sem itens.`)
          continue
        }

        const participante = resultado.metadados.destinatario_nome || resultado.metadados.destinatario_cnpj || '-'
        resultado.itens.forEach((item, index) => {
          novasLinhas.push(montarLinha({
            chave: `${file.name}|${resultado.metadados.chave_acesso || resultado.metadados.numero}|${index}`,
            arquivo: file.name,
            nota: resultado.metadados.numero || '-',
            data: resultado.metadados.data_emissao || '',
            participante,
            produto: item.descricao || item.codigo_produto || '-',
            ncm: item.ncm || '-',
            cfop: item.cfop || '-',
            valorItem: n(item.valor_total),
            cst: item.cst_ibs_cbs || '-',
            cclass: item.cclass_trib || '-',
            base: n(item.valor_bc_ibs_cbs),
            aliquotaIbsUf: n(item.aliquota_ibs_uf),
            valorIbsUf: n(item.valor_ibs_uf),
            aliquotaIbsMun: n(item.aliquota_ibs_mun),
            valorIbsMun: n(item.valor_ibs_mun),
            valorIbs: n(item.valor_ibs),
            aliquotaCbs: n(item.aliquota_cbs),
            valorCbs: n(item.valor_cbs),
          }))
        })
      } catch (error) {
        novosErros.push(`${file.name}: ${error instanceof Error ? error.message : 'falha ao processar arquivo.'}`)
      }
    }

    setLinhas(novasLinhas.sort((a, b) => `${b.data}${b.nota}`.localeCompare(`${a.data}${a.nota}`)))
    setErrosArquivos(novosErros)
    setProcessando(false)
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(linhas.map(l => ({
      Arquivo: l.arquivo,
      Nota: l.nota,
      Data: dataBr(l.data),
      Participante: l.participante,
      Produto: l.produto,
      NCM: l.ncm,
      CFOP: l.cfop,
      Valor_Item: l.valorItem,
      Destacado_IBS_CBS: l.destacado ? 'Sim' : 'Não',
      CST_IBS_CBS: l.cst,
      cClassTrib: l.cclass,
      Base_IBS_CBS: l.base,
      Aliquota_IBS_UF: l.aliquotaIbsUf,
      Valor_IBS_UF: l.valorIbsUf,
      Aliquota_IBS_Municipio: l.aliquotaIbsMun,
      Valor_IBS_Municipio: l.valorIbsMun,
      Valor_IBS: l.valorIbs,
      Aliquota_CBS: l.aliquotaCbs,
      Valor_CBS: l.valorCbs,
      Alertas: l.alertas.join(' | '),
    })))
    ws['!cols'] = [
      { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 34 }, { wch: 42 },
      { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 46 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Diagnostico_IBS_CBS')
    XLSX.writeFile(wb, `diagnostico_ibs_cbs_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <main style={S.page}>
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus { border-color: #35b9aa !important; box-shadow: 0 0 0 4px rgba(53,185,170,.12); }
        button:hover, label[role="button"]:hover { transform: translateY(-1px); }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .benefit-grid, .trust-grid { grid-template-columns: 1fr !important; }
          .form-grid { grid-template-columns: 1fr !important; }
          .form-grid > * { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 560px) {
          .page-shell { width: min(100% - 22px, 1180px) !important; }
          .hero-title { font-size: 40px !important; }
          .hero-section { padding-top: 18px !important; }
          .desktop-note { display: none !important; }
        }
      `}</style>

      <div style={{ background: '#173c38', color: '#eafffb', fontSize: 13, fontWeight: 800 }}>
        <div className="page-shell" style={{ ...S.shell, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', textAlign: 'center' }}>
          <Clock3 size={15} /> Agosto inicia uma nova fase de atenção ao preenchimento de IBS e CBS nas notas fiscais.
        </div>
      </div>

      <div className="page-shell" style={S.shell}>
        <header style={S.nav}>
          <Image src="/logo-enfokus-contabilidade.png" alt="Enfokus Contabilidade e Finanças Corporativas" width={500} height={500} priority style={S.logo} />
          <span className="desktop-note" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#3f5c57', fontSize: 13, fontWeight: 850 }}>
            <ShieldCheck size={17} color="#168c80" /> Diagnóstico gratuito e confidencial
          </span>
        </header>

        <section className="hero-section" style={S.hero}>
          <div aria-hidden style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'rgba(87, 215, 201, .13)', filter: 'blur(8px)', top: -120, left: -230 }} />
          <div className="hero-grid" style={S.heroGrid}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <span style={S.badge}><AlertCircle size={15} /> ALERTA PARA EMPRESAS EMISSORAS DE NF-e</span>
              <h1 className="hero-title" style={S.h1}>
                Sua empresa está pronta para emitir notas com <span style={S.highlight}>IBS e CBS</span> sem erros?
              </h1>
              <p style={S.lead}>
                Faça uma verificação gratuita dos XMLs da sua empresa e identifique notas sem destaque, campos obrigatórios ausentes e possíveis divergências antes que o problema vire uma notificação fiscal.
              </p>

              <div style={S.deadline}>
                <AlertTriangle size={24} color="#d95343" style={{ flex: '0 0 auto', marginTop: 2 }} />
                <div>
                  <strong style={{ display: 'block', color: '#8e3025', fontSize: 15 }}>O prazo para ajustar o sistema emissor está acabando.</strong>
                  <span style={{ display: 'block', marginTop: 5, color: '#654c48', lineHeight: 1.5, fontSize: 14 }}>
                    A partir de agosto, falhas no preenchimento podem aumentar a exposição da empresa a notificações e penalidades. Corrigir antes é mais simples e mais barato.
                  </span>
                </div>
              </div>

              <div className="benefit-grid" style={S.benefitGrid}>
                {[
                  [FileCheck2, 'Análise por item', 'Verificação de CST, cClassTrib, bases, alíquotas, IBS e CBS.'],
                  [Sparkles, 'Resultado imediato', 'Veja rapidamente quantos itens estão corretos ou exigem atenção.'],
                  [Download, 'Relatório em Excel', 'Baixe a conferência e compartilhe com sua equipe ou contador.'],
                ].map(([Icon, titulo, texto]) => {
                  const C = Icon as typeof FileCheck2
                  return <div key={String(titulo)} style={S.benefit}>
                    <C size={20} color="#168c80" />
                    <strong style={{ display: 'block', marginTop: 10, color: '#203e39', fontSize: 14 }}>{String(titulo)}</strong>
                    <span style={{ display: 'block', marginTop: 5, color: '#657b77', fontSize: 12.5, lineHeight: 1.5 }}>{String(texto)}</span>
                  </div>
                })}
              </div>
            </div>

            {!desbloqueado ? (
              <aside style={S.panel}>
                <div style={S.panelTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8ef0e5', fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>
                    <FileSearch size={16} /> DIAGNÓSTICO GRATUITO
                  </div>
                  <h2 style={{ margin: '10px 0 0', fontSize: 25, lineHeight: 1.15 }}>Descubra agora se suas notas estão preparadas.</h2>
                  <p style={{ margin: '9px 0 0', color: '#d5eeea', lineHeight: 1.55, fontSize: 13.5 }}>Preencha os dados abaixo para liberar a análise dos XMLs.</p>
                </div>
                <form onSubmit={enviarLead} className="form-grid" style={S.form}>
                  <label style={S.fieldFull}><span style={S.label}>Seu nome</span><input required value={form.nome} onChange={e => alterarCampo('nome', e.target.value)} style={S.input} placeholder="Como podemos chamar você?" /></label>
                  <label><span style={S.label}>WhatsApp</span><input required value={form.telefone} onChange={e => alterarCampo('telefone', e.target.value)} style={S.input} placeholder="(00) 00000-0000" /></label>
                  <label><span style={S.label}>E-mail profissional</span><input required type="email" value={form.email} onChange={e => alterarCampo('email', e.target.value)} style={S.input} placeholder="voce@empresa.com.br" /></label>
                  <label style={S.fieldFull}><span style={S.label}>Nome da empresa</span><input required value={form.empresa} onChange={e => alterarCampo('empresa', e.target.value)} style={S.input} placeholder="Razão social ou nome fantasia" /></label>
                  <label><span style={S.label}>Porte</span><select required value={form.porte_empresa} onChange={e => alterarCampo('porte_empresa', e.target.value)} style={S.input}><option value="">Selecione</option>{PORTES.map(op => <option key={op} value={op}>{op}</option>)}</select></label>
                  <label><span style={S.label}>Regime tributário</span><select required value={form.regime_tributario} onChange={e => alterarCampo('regime_tributario', e.target.value)} style={S.input}><option value="">Selecione</option>{REGIMES.map(op => <option key={op} value={op}>{op}</option>)}</select></label>
                  <label><span style={S.label}>Funcionários</span><select required value={form.funcionarios_faixa} onChange={e => alterarCampo('funcionarios_faixa', e.target.value)} style={S.input}><option value="">Selecione</option>{FUNCIONARIOS.map(op => <option key={op} value={op}>{op}</option>)}</select></label>
                  <label><span style={S.label}>Faturamento mensal</span><select required value={form.faturamento_faixa} onChange={e => alterarCampo('faturamento_faixa', e.target.value)} style={S.input}><option value="">Selecione</option>{FATURAMENTOS.map(op => <option key={op} value={op}>{op}</option>)}</select></label>
                  <div style={S.fieldFull}>
                    <span style={S.label}>Atividade da empresa</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {SEGMENTOS.map(segmento => <label key={segmento} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${form.segmentos.includes(segmento) ? '#31b9aa' : '#cfddda'}`, background: form.segmentos.includes(segmento) ? '#eafbf8' : '#fff', borderRadius: 11, padding: '10px 11px', color: '#29433f', fontSize: 12.5, fontWeight: 750, cursor: 'pointer' }}><input type="checkbox" checked={form.segmentos.includes(segmento)} onChange={() => alternarSegmento(segmento)} />{segmento}</label>)}
                    </div>
                  </div>
                  {erroLead && <div style={{ ...S.fieldFull, color: '#b42318', fontSize: 13, fontWeight: 800 }}>{erroLead}</div>}
                  <div style={S.fieldFull}>
                    <button type="submit" disabled={enviandoLead} style={{ ...S.button, opacity: enviandoLead ? .68 : 1 }}>
                      {enviandoLead ? <Loader2 size={17} /> : <FileSearch size={17} />} Analisar minhas notas gratuitamente <ArrowRight size={17} />
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 11, color: '#758783', fontSize: 11.5 }}><LockKeyhole size={13} /> Seus XMLs são processados no navegador e não ficam armazenados.</div>
                  </div>
                </form>
              </aside>
            ) : (
              <aside style={{ ...S.panel, padding: 28 }}>
                <div style={{ width: 50, height: 50, display: 'grid', placeItems: 'center', borderRadius: 15, background: '#e9fbf7' }}><CheckCircle2 size={27} color="#168c80" /></div>
                <h2 style={{ margin: '17px 0 8px', fontSize: 27, color: '#203e39' }}>Diagnóstico liberado</h2>
                <p style={{ margin: 0, color: '#627873', lineHeight: 1.65 }}>Selecione seus XMLs de NF-e abaixo. A análise será realizada imediatamente.</p>
              </aside>
            )}
          </div>
        </section>

        <section className="trust-grid" style={S.trustBar}>
          {[
            [LockKeyhole, 'Privacidade', 'Os arquivos não são enviados nem armazenados.'],
            [Check, 'Sem compromisso', 'A ferramenta é gratuita e não exige contratação.'],
            [ShieldCheck, 'Análise preventiva', 'O resultado ajuda a localizar pontos que merecem revisão.'],
          ].map(([Icon, titulo, texto]) => { const C = Icon as typeof Check; return <div key={String(titulo)} style={S.trustItem}><C size={21} color="#168c80" /><div><strong style={{ display: 'block', color: '#29433f', fontSize: 13.5 }}>{String(titulo)}</strong><span style={{ display: 'block', marginTop: 4, color: '#71827e', fontSize: 12.5, lineHeight: 1.45 }}>{String(texto)}</span></div></div> })}
        </section>

        {desbloqueado && <>
          <section style={S.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div><span style={{ color: '#168c80', fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>ETAPA 2</span><h2 style={{ margin: '5px 0 0', color: '#203e39', fontSize: 25 }}>Envie os XMLs para análise</h2><p style={{ margin: '7px 0 0', color: '#657b77', fontSize: 14 }}>Você pode selecionar vários arquivos de NF-e de uma só vez.</p></div>
              <label role="button" style={{ ...S.button, width: 'auto', minWidth: 230 }}>{processando ? <Loader2 size={18} /> : <UploadCloud size={18} />}{processando ? 'Processando arquivos...' : 'Selecionar XMLs'}<input type="file" accept=".xml,text/xml,application/xml" multiple disabled={processando} onChange={e => analisarArquivos(e.target.files)} style={{ display: 'none' }} /></label>
            </div>
          </section>

          <section style={{ ...S.section, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 11 }}>
            {[
              ['XMLs lidos', String(totais.xmlsLidos)], ['Notas válidas', String(totais.notasValidas)], ['Itens analisados', String(totais.itens)], ['Sem IBS/CBS', String(totais.semDestaque)], ['Com divergência', String(totais.divergencias)], ['Total IBS', money.format(totais.ibs)], ['Total CBS', money.format(totais.cbs)],
            ].map(([label, value]) => <div key={label} style={{ border: `1px solid ${label === 'Sem IBS/CBS' || label === 'Com divergência' ? '#f2d1cb' : '#dce8e5'}`, borderRadius: 15, padding: 15, background: label === 'Sem IBS/CBS' || label === 'Com divergência' ? '#fff8f6' : '#fbfefd' }}><div style={{ color: '#748783', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 900, letterSpacing: '.08em' }}>{label}</div><div style={{ marginTop: 8, color: label === 'Sem IBS/CBS' || label === 'Com divergência' ? '#ad4133' : '#203e39', fontWeight: 950, fontSize: 21 }}>{value}</div></div>)}
          </section>

          {(errosArquivos.length > 0 || linhas.length > 0) && <section style={S.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}><div><span style={{ color: '#168c80', fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>RESULTADO</span><h2 style={{ margin: '5px 0 0', color: '#203e39', fontSize: 25 }}>Diagnóstico por item da nota</h2></div><button type="button" onClick={exportarExcel} disabled={!linhas.length} style={{ ...S.secondaryButton, opacity: linhas.length ? 1 : .5, cursor: linhas.length ? 'pointer' : 'not-allowed' }}><Download size={16} /> Baixar relatório em Excel</button></div>
            {errosArquivos.length > 0 && <div style={{ border: '1px solid #f2c7c0', background: '#fff3f1', color: '#9f3024', borderRadius: 13, padding: 13, marginBottom: 15, fontSize: 13, fontWeight: 750 }}>{errosArquivos.map(erro => <div key={erro}>{erro}</div>)}</div>}
            {!linhas.length ? <div style={{ color: '#657b77', padding: '20px 0' }}>Nenhum item válido encontrado nos XMLs selecionados.</div> : <div style={{ overflowX: 'auto', border: '1px solid #dce8e5', borderRadius: 14 }}><table style={{ minWidth: 1320, width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff' }}><thead><tr style={{ background: '#edf7f5' }}>{['Nota', 'Data', 'Participante', 'Produto', 'NCM', 'CFOP', 'Valor', 'IBS/CBS', 'CST', 'cClass', 'Base', 'IBS UF', 'IBS Mun', 'IBS', 'CBS', 'Alertas'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px', color: '#48625d', borderBottom: '1px solid #dce8e5', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead><tbody>{linhas.map(l => { const statusBg = l.situacao === 'ok' ? '#ecfdf5' : l.situacao === 'critico' ? '#fff1f2' : '#fff8e6'; const statusColor = l.situacao === 'ok' ? '#057a55' : l.situacao === 'critico' ? '#b42318' : '#9a6700'; return <tr key={l.chave} style={{ borderTop: '1px solid #edf3f2' }}><td style={{ padding: 12, fontWeight: 850 }}>{l.nota}</td><td style={{ padding: 12, whiteSpace: 'nowrap' }}>{dataBr(l.data)}</td><td style={{ padding: 12, minWidth: 200 }}>{l.participante}</td><td style={{ padding: 12, minWidth: 250 }}>{l.produto}</td><td style={{ padding: 12 }}>{l.ncm}</td><td style={{ padding: 12, color: '#168c80', fontWeight: 850 }}>{l.cfop}</td><td style={{ padding: 12, whiteSpace: 'nowrap' }}>{money.format(l.valorItem)}</td><td style={{ padding: 12 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 9px', background: statusBg, color: statusColor, fontWeight: 850 }}>{l.destacado ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{l.destacado ? 'Sim' : 'Não'}</span></td><td style={{ padding: 12 }}>{l.cst}</td><td style={{ padding: 12 }}>{l.cclass}</td><td style={{ padding: 12, whiteSpace: 'nowrap' }}>{money.format(l.base)}</td><td style={{ padding: 12, whiteSpace: 'nowrap' }}>{money.format(l.valorIbsUf)} <span style={{ color: '#718891' }}>({numberFmt.format(l.aliquotaIbsUf)}%)</span></td><td style={{ padding: 12, whiteSpace: 'nowrap' }}>{money.format(l.valorIbsMun)} <span style={{ color: '#718891' }}>({numberFmt.format(l.aliquotaIbsMun)}%)</span></td><td style={{ padding: 12, color: '#047857', fontWeight: 850, whiteSpace: 'nowrap' }}>{money.format(l.valorIbs)}</td><td style={{ padding: 12, color: '#0f6f83', fontWeight: 850, whiteSpace: 'nowrap' }}>{money.format(l.valorCbs)}</td><td style={{ padding: 12, minWidth: 230 }}>{l.alertas.length ? l.alertas.map(alerta => <span key={alerta} style={{ display: 'inline-flex', margin: '2px 4px 2px 0', borderRadius: 999, padding: '3px 8px', background: statusBg, color: statusColor, fontSize: 11, fontWeight: 800 }}>{alerta}</span>) : <span style={{ color: '#057a55', fontWeight: 850 }}>OK</span>}</td></tr>})}</tbody></table></div>}
          </section>}
        </>}

        <footer style={{ padding: '34px 0 42px', textAlign: 'center', color: '#71827e', fontSize: 12.5, lineHeight: 1.6 }}>
          O diagnóstico é preventivo e não substitui uma revisão tributária individualizada. Resultados devem ser avaliados conforme a operação e o regime da empresa.
        </footer>
      </div>
    </main>
  )
}