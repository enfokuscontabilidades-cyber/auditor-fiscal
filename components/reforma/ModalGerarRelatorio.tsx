'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
import { X, Building2, Landmark, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { ModoParametrosReforma, ReportAudience, EscritorioContabilPerfil, RtParametrosCliente } from '@/lib/types'

export interface ParametrosEspecificosForm {
  aliquotaCbs: string
  aliquotaIbsTotal: string
  aliquotaIbsUf: string
  aliquotaIbsMun: string
  informarSeparado: boolean
  cst: string
  cclassTrib: string
  observacao: string
  vigenciaInicio: string
  vigenciaFim: string
}

export interface OpcoesGeracaoRelatorio {
  reportAudience: ReportAudience
  modoParametros?: ModoParametrosReforma
  parametrosEspecificos?: {
    aliquotaCbs: number
    aliquotaIbsTotal?: number
    aliquotaIbsUf?: number
    aliquotaIbsMun?: number
    cst: string
    cclassTrib: string
    observacao?: string
    vigenciaInicio: string
    vigenciaFim?: string
  }
  usarParametrosSalvos?: boolean
  salvarComoReferenciaCliente?: boolean
}

interface ModalGerarRelatorioProps {
  aberto: boolean
  onFechar: () => void
  empresaId: string
  empresaNome: string
  competencia?: string
  totalItensNaTela: number
  onConfirmar: (opcoes: OpcoesGeracaoRelatorio) => Promise<void>
}

const PARAMS_FORM_VAZIO: ParametrosEspecificosForm = {
  aliquotaCbs: '0,90', aliquotaIbsTotal: '0,10', aliquotaIbsUf: '', aliquotaIbsMun: '',
  informarSeparado: false, cst: '000', cclassTrib: '000001', observacao: '',
  vigenciaInicio: new Date().toISOString().slice(0, 10), vigenciaFim: '',
}

function numeroForm(v: string): number {
  return Number(v.replace(',', '.'))
}

export default function ModalGerarRelatorio({
  aberto, onFechar, empresaId, empresaNome, competencia, totalItensNaTela, onConfirmar,
}: ModalGerarRelatorioProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  const [audiencia, setAudiencia] = useState<ReportAudience>('company')
  const [modoParametros, setModoParametros] = useState<ModoParametrosReforma>('padrao_2026')
  const [form, setForm] = useState<ParametrosEspecificosForm>(PARAMS_FORM_VAZIO)
  const [salvarReferencia, setSalvarReferencia] = useState(false)
  const [usarSalvos, setUsarSalvos] = useState(false)

  const [perfil, setPerfil] = useState<EscritorioContabilPerfil | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [carregandoPerfil, setCarregandoPerfil] = useState(false)
  const [parametrosVigentes, setParametrosVigentes] = useState<RtParametrosCliente | null>(null)
  const [parametrosVigentesCarregados, setParametrosVigentesCarregados] = useState(false)

  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) {
      setEtapa(1)
      setAudiencia('company')
      setModoParametros('padrao_2026')
      setForm(PARAMS_FORM_VAZIO)
      setSalvarReferencia(false)
      setUsarSalvos(false)
      setErro(null)
      setParametrosVigentesCarregados(false)
      setParametrosVigentes(null)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto || audiencia !== 'accountant_client') return
    setCarregandoPerfil(true)
    Promise.all([
      fetch('/api/rt/escritorio').then(r => r.json()).catch(() => null),
      fetch(`/api/rt/parametros-cliente?empresa_id=${encodeURIComponent(empresaId)}`).then(r => r.json()).catch(() => null),
    ]).then(([escritorioResp, parametrosResp]) => {
      setPerfil(escritorioResp?.perfil ?? null)
      setLogoUrl(escritorioResp?.logoUrl ?? null)
      setParametrosVigentes(parametrosResp?.vigente ?? null)
      setParametrosVigentesCarregados(true)
    }).finally(() => setCarregandoPerfil(false))
  }, [aberto, audiencia, empresaId])

  const nomeEscritorioValido = Boolean(perfil?.nome?.trim())
  const podeAvancarEtapa2 = audiencia === 'company' || nomeEscritorioValido

  const parametrosEspecificosValidos = useMemo(() => {
    if (modoParametros !== 'especifico' || usarSalvos) return true
    return Boolean(form.cst && form.cclassTrib && form.vigenciaInicio && form.aliquotaCbs)
  }, [modoParametros, usarSalvos, form])

  async function confirmar() {
    setErro(null)
    setGerando(true)
    try {
      const opcoes: OpcoesGeracaoRelatorio = { reportAudience: audiencia }
      if (audiencia === 'accountant_client') {
        opcoes.modoParametros = modoParametros
        if (modoParametros === 'especifico') {
          if (usarSalvos) {
            opcoes.usarParametrosSalvos = true
          } else {
            opcoes.parametrosEspecificos = {
              aliquotaCbs: numeroForm(form.aliquotaCbs),
              aliquotaIbsTotal: form.informarSeparado ? undefined : numeroForm(form.aliquotaIbsTotal),
              aliquotaIbsUf: form.informarSeparado ? numeroForm(form.aliquotaIbsUf) : undefined,
              aliquotaIbsMun: form.informarSeparado ? numeroForm(form.aliquotaIbsMun) : undefined,
              cst: form.cst.trim(),
              cclassTrib: form.cclassTrib.trim(),
              observacao: form.observacao.trim() || undefined,
              vigenciaInicio: form.vigenciaInicio,
              vigenciaFim: form.vigenciaFim || undefined,
            }
            opcoes.salvarComoReferenciaCliente = salvarReferencia
          }
        }
      }
      await onConfirmar(opcoes)
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar relatorio.')
    } finally {
      setGerando(false)
    }
  }

  if (!aberto) return null

  const voltar = () => {
    if (etapa === 1) {
      onFechar()
      return
    }
    setEtapa(etapa === 3 ? (audiencia === 'accountant_client' ? 2 : 1) : 1)
  }

  const avancar = () => {
    setEtapa(etapa === 1 ? (audiencia === 'accountant_client' ? 2 : 3) : 3)
  }

  return (
    <div className="af-modal-overlay" onClick={onFechar}>
      <div className="af-modal" onClick={e => e.stopPropagation()}>
        <div className="af-modal-header">
          <p className="af-modal-title">Gerar relatorio PDF</p>
          <button type="button" onClick={onFechar} className="af-btn af-btn-secondary" style={{ minHeight: 32, padding: 7 }} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="af-modal-body">
          {etapa === 1 && (
            <div className="af-page-stack">
              <p className="af-muted" style={{ margin: 0 }}>
                Escolha o modelo de relatorio para <strong>{empresaNome}</strong>{competencia ? `, competencia ${competencia}` : ''}.
              </p>

              <label className="af-option" data-active={audiencia === 'company'}>
                <input type="radio" checked={audiencia === 'company'} onChange={() => setAudiencia('company')} style={{ marginTop: 3 }} />
                <div>
                  <div className="af-cell-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={15} /> Relatorio para a propria empresa</div>
                  <div className="af-help" style={{ marginTop: 4 }}>Mantem a identidade visual, dados de contato e orientacoes da versao empresarial.</div>
                </div>
              </label>

              <label className="af-option" data-active={audiencia === 'accountant_client'}>
                <input type="checkbox" checked={audiencia === 'accountant_client'} onChange={e => setAudiencia(e.target.checked ? 'accountant_client' : 'company')} style={{ marginTop: 3 }} />
                <div>
                  <div className="af-cell-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Landmark size={15} /> Versao do contador para o cliente</div>
                  <div className="af-help" style={{ marginTop: 4 }}>Usa a identidade do escritorio, lista notas sem destaque de IBS/CBS e orienta o cliente sobre proximos passos.</div>
                </div>
              </label>

              {audiencia === 'accountant_client' && (
                <div className={nomeEscritorioValido || carregandoPerfil ? 'af-alert af-alert-success' : 'af-alert af-alert-warning'}>
                  {carregandoPerfil ? (
                    <span>Carregando dados do escritorio...</span>
                  ) : nomeEscritorioValido ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {logoUrl ? <img src={logoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 6 }} /> : null}
                      <span><strong>{perfil?.nome}</strong><br /><span className="af-help">{logoUrl ? 'Logo cadastrada' : 'Sem logo cadastrada'}</span></span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={15} /> Cadastre o nome do escritorio em Configuracoes antes de gerar a versao para o cliente.
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {etapa === 2 && audiencia === 'accountant_client' && (
            <div className="af-page-stack">
              <p className="af-cell-strong" style={{ margin: 0 }}>Qual referencia tributaria deve ser usada nesta analise?</p>
              {([
                { valor: 'padrao_2026' as const, titulo: 'Padrao geral de 2026', desc: 'CBS 0,90%, IBS total 0,10%, CST 000 e cClassTrib 000001.', recomendado: true },
                { valor: 'especifico' as const, titulo: 'Parametros especificos do cliente', desc: 'Permite aliquotas, CST e cClassTrib proprios, com vigencia definida.' },
                { valor: 'estrutural' as const, titulo: 'Analise estrutural', desc: 'Valida presenca e consistencia dos campos sem afirmar tratamento tributario aplicavel.' },
              ]).map(op => (
                <label key={op.valor} className="af-option" data-active={modoParametros === op.valor}>
                  <input type="radio" checked={modoParametros === op.valor} onChange={() => setModoParametros(op.valor)} style={{ marginTop: 3 }} />
                  <div>
                    <div className="af-cell-strong">
                      {op.titulo}{op.recomendado && <span className="af-badge af-badge-success" style={{ marginLeft: 8 }}>Recomendado</span>}
                    </div>
                    <div className="af-help" style={{ marginTop: 4 }}>{op.desc}</div>
                  </div>
                </label>
              ))}

              {modoParametros === 'especifico' && (
                <div className="af-card af-form-grid" style={{ padding: 14, boxShadow: 'none' }}>
                  {!parametrosVigentesCarregados && <span className="af-help">Verificando parametros salvos deste cliente...</span>}

                  {parametrosVigentes && (
                    <label className="af-help" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={usarSalvos} onChange={e => setUsarSalvos(e.target.checked)} />
                      Usar parametros salvos deste cliente (versao {parametrosVigentes.versao})
                    </label>
                  )}

                  {!usarSalvos && (
                    <>
                      <div className="af-form-grid-2">
                        <div>
                          <span className="af-label">Aliquota CBS (%)</span>
                          <input className="af-input" value={form.aliquotaCbs} onChange={e => setForm({ ...form, aliquotaCbs: e.target.value })} placeholder="0,90" />
                        </div>
                        <div>
                          <span className="af-label">CST</span>
                          <input className="af-input" value={form.cst} onChange={e => setForm({ ...form, cst: e.target.value })} placeholder="000" />
                        </div>
                      </div>

                      <label className="af-help" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={form.informarSeparado} onChange={e => setForm({ ...form, informarSeparado: e.target.checked })} />
                        Informar IBS estadual e municipal separadamente
                      </label>

                      {form.informarSeparado ? (
                        <div className="af-form-grid-2">
                          <div>
                            <span className="af-label">IBS estadual (%)</span>
                            <input className="af-input" value={form.aliquotaIbsUf} onChange={e => setForm({ ...form, aliquotaIbsUf: e.target.value })} placeholder="0,05" />
                          </div>
                          <div>
                            <span className="af-label">IBS municipal (%)</span>
                            <input className="af-input" value={form.aliquotaIbsMun} onChange={e => setForm({ ...form, aliquotaIbsMun: e.target.value })} placeholder="0,05" />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="af-label">Aliquota total do IBS (%)</span>
                          <input className="af-input" value={form.aliquotaIbsTotal} onChange={e => setForm({ ...form, aliquotaIbsTotal: e.target.value })} placeholder="0,10" />
                        </div>
                      )}

                      <div>
                        <span className="af-label">cClassTrib</span>
                        <input className="af-input" value={form.cclassTrib} onChange={e => setForm({ ...form, cclassTrib: e.target.value })} placeholder="000001" />
                      </div>

                      <div>
                        <span className="af-label">Observacao sobre o tratamento tributario</span>
                        <textarea className="af-input" style={{ minHeight: 64, resize: 'vertical' }} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
                      </div>

                      <div className="af-form-grid-2">
                        <div>
                          <span className="af-label">Vigencia inicial</span>
                          <input type="date" className="af-input" value={form.vigenciaInicio} onChange={e => setForm({ ...form, vigenciaInicio: e.target.value })} />
                        </div>
                        <div>
                          <span className="af-label">Vigencia final</span>
                          <input type="date" className="af-input" value={form.vigenciaFim} onChange={e => setForm({ ...form, vigenciaFim: e.target.value })} />
                        </div>
                      </div>

                      <label className="af-help" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={salvarReferencia} onChange={e => setSalvarReferencia(e.target.checked)} />
                        Salvar estes parametros como referencia deste cliente
                      </label>

                      <div className="af-alert af-alert-warning">
                        <AlertTriangle size={14} /> Confirme que os parametros foram definidos pelo responsavel contabil ou tributario.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {etapa === 3 && (
            <div className="af-page-stack">
              <p className="af-cell-strong" style={{ margin: 0 }}>Revisao</p>
              <div className="af-card af-form-grid" style={{ padding: 14, boxShadow: 'none', fontSize: 13 }}>
                <div><strong>Tipo do relatorio:</strong> {audiencia === 'company' ? 'Empresarial (Enfokus)' : 'Contador para o cliente'}</div>
                {audiencia === 'accountant_client' && <div><strong>Escritorio emitente:</strong> {perfil?.nome}</div>}
                <div><strong>Empresa analisada:</strong> {empresaNome}</div>
                <div><strong>Itens carregados na tela:</strong> {totalItensNaTela}</div>
                {competencia && <div><strong>Competencia:</strong> {competencia}</div>}
                {audiencia === 'accountant_client' && (
                  <div><strong>Referencia tributaria:</strong> {{
                    padrao_2026: 'Padrao geral de 2026',
                    especifico: usarSalvos ? 'Especifica do cliente (salva)' : 'Especifica informada agora',
                    estrutural: 'Estrutural',
                  }[modoParametros]}</div>
                )}
                {audiencia === 'accountant_client' && modoParametros === 'especifico' && !usarSalvos && form.observacao && (
                  <div><strong>Observacao:</strong> {form.observacao}</div>
                )}
              </div>
            </div>
          )}

          {erro && (
            <div className="af-alert af-alert-danger" style={{ marginTop: 14 }}>
              <AlertTriangle size={14} /> {erro}
            </div>
          )}
        </div>

        <div className="af-modal-footer">
          <button type="button" onClick={voltar} className="af-btn af-btn-secondary">
            {etapa === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {etapa < 3 ? (
            <button
              type="button"
              disabled={etapa === 1 ? !podeAvancarEtapa2 : !parametrosEspecificosValidos}
              onClick={avancar}
              className="af-btn af-btn-primary"
            >
              Continuar
            </button>
          ) : (
            <button type="button" disabled={gerando} onClick={confirmar} className="af-btn af-btn-primary">
              {gerando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
              {gerando ? 'Gerando...' : 'Confirmar e gerar relatorio'}
            </button>
          )}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
