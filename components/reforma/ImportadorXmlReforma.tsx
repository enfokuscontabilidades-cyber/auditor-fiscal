'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { extrairXmlsDeArquivos } from '@/lib/fiscal/xmlArchive'
import { parseNfeParaDocumento } from '@/lib/nfe/parseNfe'
import type { DocumentoFiscalInput, DocumentoFiscalItemInput } from '@/lib/types'

interface ImportadorXmlReformaProps {
  empresaId: string
  cnpjEmpresa: string
  cnaePrincipal?: string
  onImportado?: () => void
}

export default function ImportadorXmlReforma({ empresaId, cnpjEmpresa, cnaePrincipal, onImportado }: ImportadorXmlReformaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)
  const [resumo, setResumo] = useState<{ salvos: number; rejeitados: string[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const cnpjLimpo = (cnpjEmpresa || '').replace(/\D/g, '')
  const ehIndustrial = /^(1[0-9]|2[0-9]|3[0-3])/.test(cnaePrincipal ?? '')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setProcessando(true)
    setErro(null)
    setResumo(null)

    try {
      const extraidos = await extrairXmlsDeArquivos(files)
      const rejeitados: string[] = [...extraidos.avisos]
      const documentos: Omit<DocumentoFiscalInput, 'empresa_id'>[] = []
      const itensPorChave: Record<string, Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]> = {}

      for (const arquivo of extraidos.arquivos) {
        const resultado = parseNfeParaDocumento(arquivo.txt, cnpjLimpo, ehIndustrial, arquivo.nome)
        if (!resultado) {
          rejeitados.push(`${arquivo.nome}: não foi possível extrair dados do XML`)
          continue
        }

        const { emitente_cnpj, destinatario_cnpj } = resultado.metadados
        const pertenceAEmpresa = emitente_cnpj === cnpjLimpo || destinatario_cnpj === cnpjLimpo
        if (!pertenceAEmpresa) {
          rejeitados.push(`${arquivo.nome}: o documento não pertence à empresa selecionada`)
          continue
        }

        const chave = resultado.metadados.chave_acesso ?? arquivo.nome
        documentos.push(resultado.documento)
        itensPorChave[chave] = resultado.itens
      }

      if (documentos.length === 0) {
        setResumo({ salvos: 0, rejeitados })
        setProcessando(false)
        return
      }

      const res = await fetch('/api/documentos-fiscais/importar-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId, documentos, itens: itensPorChave }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const mensagem = body.error ?? (Array.isArray(body.erros) && body.erros.length ? body.erros.join(' ') : `Erro ao importar (${res.status})`)
        setErro(mensagem)
        setProcessando(false)
        return
      }

      const body = await res.json()
      if (Array.isArray(body.erros)) rejeitados.push(...body.erros)
      setResumo({ salvos: body.documentos_salvos ?? body.salvos ?? documentos.length, rejeitados })
      onImportado?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao processar os arquivos.')
    } finally {
      setProcessando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="af-page-stack">
      <div className="af-upload-inline">
        <button
          type="button"
          disabled={processando || !empresaId}
          onClick={() => inputRef.current?.click()}
          className="af-btn af-btn-primary"
        >
          {processando ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
          {processando ? 'Processando...' : 'Importar XMLs'}
        </button>
        <span className="af-help">Aceita arquivos .xml ou .zip contendo XMLs de NF-e.</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xml,.zip"
          hidden
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {erro && (
        <div className="af-alert af-alert-danger">
          <AlertTriangle size={14} /> {erro}
        </div>
      )}

      {resumo && (
        <div className="af-page-stack">
          {resumo.salvos > 0 && (
            <div className="af-alert af-alert-success">
              <CheckCircle2 size={14} /> {resumo.salvos} documento(s) importado(s) com sucesso.
            </div>
          )}
          {resumo.rejeitados.length > 0 && (
            <div className="af-alert af-alert-warning" style={{ display: 'grid' }}>
              {resumo.rejeitados.map(msg => (
                <div key={msg} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
