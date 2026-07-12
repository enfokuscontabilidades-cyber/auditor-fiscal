'use client'

import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, FileX2 } from 'lucide-react'
import { cor, cardBase, raio, situacaoCor, botaoSecundario } from './tokens'
import type { SituacaoReforma } from '@/lib/fiscal/analiseReformaTributaria'
import BotaoRelatorioPdf from './BotaoRelatorioPdf'

interface ItemResultado {
  itemNumero: number
  descricao: string
  ncm: string
  cfop: string
  cst: string
  cclass: string
  base: number
  valorIbs: number
  valorCbs: number
  situacao: SituacaoReforma
}

export interface ResultadoArquivo {
  id: string
  arquivo: string
  ok: boolean
  mensagemFalha?: string
  tipoDocumento?: string
  numero?: string
  serie?: string
  dataEmissao?: string | null
  emitenteMascarado?: string
  situacao?: SituacaoReforma
  camposEncontrados?: string[]
  camposAusentes?: string[]
  itens?: ItemResultado[]
  recomendacoes?: string[]
}

export interface ResumoAnalise {
  totalAnalisado: number
  adequado: number
  atencao: number
  critico: number
}

interface Props {
  resultados: ResultadoArquivo[]
  resumo: ResumoAnalise
  codigoDiagnostico: string
  relatorioToken: string | null
  onNovaAnalise: () => void
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const TITULOS: Record<SituacaoReforma, string> = {
  ok: 'O XML possui informações de IBS e CBS',
  alerta: 'Algumas informações precisam ser verificadas',
  critico: 'Este XML pode não estar preparado para as novas exigências',
}

const TEXTOS: Record<SituacaoReforma, string> = {
  ok: 'Encontramos no documento os principais grupos relacionados aos novos tributos. Confira os dados localizados.',
  alerta: 'O documento possui campos relacionados ao IBS e à CBS, mas existem informações ausentes, incompletas ou que merecem validação.',
  critico: 'Não encontramos todas as informações esperadas. O sistema emissor pode precisar de atualização ou configuração antes das novas validações.',
}

const ICONES: Record<SituacaoReforma, typeof CheckCircle2> = { ok: CheckCircle2, alerta: AlertTriangle, critico: XCircle }

function dataBr(data?: string | null) {
  if (!data) return '-'
  const [ano, mes, dia] = data.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

export default function PainelResultado({ resultados, resumo, codigoDiagnostico, relatorioToken, onNovaAnalise }: Props) {
  return (
    <section id="resultado" style={{ padding: '44px 0' }}>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: cor.acento }}>
        Resultado
      </p>
      <h2 style={{ margin: '0 0 22px', fontSize: 24, fontWeight: 800, color: cor.texto }}>
        Diagnóstico concluído
      </h2>

      <BotaoRelatorioPdf relatorioToken={relatorioToken} />

      {resultados.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 22 }} className="grid-4-responsivo">
          <Estatistica rotulo="Analisados" valor={resumo.totalAnalisado} cor={cor.texto} />
          <Estatistica rotulo="Adequados" valor={resumo.adequado} cor={cor.sucesso} />
          <Estatistica rotulo="Com atenção" valor={resumo.atencao} cor={cor.alerta} />
          <Estatistica rotulo="Críticos" valor={resumo.critico} cor={cor.critico} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {resultados.map(resultado => (
          <CardResultado key={resultado.id} resultado={resultado} />
        ))}
      </div>

      <div style={{ ...cardBase, padding: '18px 22px', marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 11.5, color: cor.textoFraco, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Código do diagnóstico</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: cor.acento, fontFamily: 'monospace' }}>{codigoDiagnostico || '—'}</p>
        </div>
        <button type="button" onClick={onNovaAnalise} style={botaoSecundario}>
          <RotateCcw size={15} />
          Analisar outros XMLs
        </button>
      </div>
    </section>
  )
}

function Estatistica({ rotulo, valor, cor: c }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div style={{ ...cardBase, padding: 16, textAlign: 'center' }}>
      <p style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: c }}>{valor}</p>
      <p style={{ margin: 0, fontSize: 11.5, color: cor.textoFraco }}>{rotulo}</p>
    </div>
  )
}

function CardResultado({ resultado }: { resultado: ResultadoArquivo }) {
  if (!resultado.ok) {
    return (
      <div style={{ ...cardBase, padding: 22, borderColor: 'rgba(255,107,122,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <FileX2 size={18} color={cor.critico} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: cor.texto }}>{resultado.arquivo}</p>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: cor.textoSuave }}>{resultado.mensagemFalha}</p>
      </div>
    )
  }

  const situacao = resultado.situacao || 'critico'
  const paleta = situacaoCor(situacao)
  const Icone = ICONES[situacao]

  return (
    <div style={{ ...cardBase, padding: 24, borderColor: paleta.cor + '55' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: raio.sm, background: paleta.fundo, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icone size={19} color={paleta.cor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: 15.5, fontWeight: 800, color: cor.texto }}>{TITULOS[situacao]}</p>
          <p style={{ margin: 0, fontSize: 13, color: cor.textoSuave, lineHeight: 1.5 }}>{TEXTOS[situacao]}</p>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: paleta.fundo, color: paleta.cor, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
          {situacao === 'ok' ? 'Adequado' : situacao === 'alerta' ? 'Atenção' : 'Crítico'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px 16px', marginBottom: 16, padding: '14px 16px', borderRadius: raio.sm, background: 'rgba(255,255,255,0.02)' }} className="grid-4-responsivo">
        <InfoCampo rotulo="Arquivo" valor={resultado.arquivo} />
        <InfoCampo rotulo="Tipo" valor={resultado.tipoDocumento || '-'} />
        <InfoCampo rotulo="Número / Série" valor={`${resultado.numero || '-'} / ${resultado.serie || '-'}`} />
        <InfoCampo rotulo="Emissão" valor={dataBr(resultado.dataEmissao)} />
        <InfoCampo rotulo="Emitente" valor={resultado.emitenteMascarado || '-'} />
      </div>

      {(resultado.camposEncontrados?.length || resultado.camposAusentes?.length) ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }} className="grid-2-responsivo">
          {!!resultado.camposEncontrados?.length && (
            <div>
              <p style={rotuloLista}>Campos encontrados</p>
              {resultado.camposEncontrados.map(c => <p key={c} style={itemListaOk}><CheckCircle2 size={12} color={cor.sucesso} />{c}</p>)}
            </div>
          )}
          {!!resultado.camposAusentes?.length && (
            <div>
              <p style={rotuloLista}>Campos ausentes</p>
              {resultado.camposAusentes.map(c => <p key={c} style={itemListaAlerta}><AlertTriangle size={12} color={cor.alerta} />{c}</p>)}
            </div>
          )}
        </div>
      ) : null}

      {!!resultado.itens?.length && (
        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: cor.textoFraco }}>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>NCM</th>
                <th style={thStyle}>CFOP</th>
                <th style={thStyle}>CST</th>
                <th style={thStyle}>cClassTrib</th>
                <th style={thStyle}>Base</th>
                <th style={thStyle}>IBS</th>
                <th style={thStyle}>CBS</th>
              </tr>
            </thead>
            <tbody>
              {resultado.itens.slice(0, 6).map(item => (
                <tr key={item.itemNumero} style={{ color: cor.textoSuave, borderTop: `1px solid ${cor.borda}` }}>
                  <td style={tdStyle} title={item.descricao}>{item.itemNumero}</td>
                  <td style={tdStyle}>{item.ncm || '-'}</td>
                  <td style={tdStyle}>{item.cfop || '-'}</td>
                  <td style={tdStyle}>{item.cst}</td>
                  <td style={tdStyle}>{item.cclass}</td>
                  <td style={tdStyle}>{money.format(item.base)}</td>
                  <td style={tdStyle}>{money.format(item.valorIbs)}</td>
                  <td style={tdStyle}>{money.format(item.valorCbs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {resultado.itens.length > 6 && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: cor.textoFraco }}>+ {resultado.itens.length - 6} item(ns) adicional(is) não exibido(s) aqui.</p>
          )}
        </div>
      )}

      {!!resultado.recomendacoes?.length && (
        <div>
          <p style={rotuloLista}>Recomendações</p>
          {resultado.recomendacoes.map(r => <p key={r} style={{ margin: '3px 0', fontSize: 12.5, color: cor.textoSuave, lineHeight: 1.5 }}>• {r}</p>)}
        </div>
      )}
    </div>
  )
}

function InfoCampo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: '0 0 2px', fontSize: 10.5, color: cor.textoFraco, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{rotulo}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: cor.texto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</p>
    </div>
  )
}

const rotuloLista: React.CSSProperties = { margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: cor.textoFraco, textTransform: 'uppercase', letterSpacing: '0.05em' }
const itemListaOk: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0', fontSize: 12.5, color: cor.textoSuave }
const itemListaAlerta: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0', fontSize: 12.5, color: cor.textoSuave }
const thStyle: React.CSSProperties = { padding: '6px 10px', fontWeight: 700, whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '7px 10px', whiteSpace: 'nowrap' }
