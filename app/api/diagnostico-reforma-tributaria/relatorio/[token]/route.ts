import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarRateLimit, obterIpRequisicao } from '@/lib/security/rateLimit'
import { montarDadosRelatorio, nomeArquivoRelatorio, type DiagnosticoPersistido, type LeadPersistido } from '@/lib/relatorioReforma/dadosRelatorio'
import { gerarRelatorioPdf } from '@/lib/pdf/gerarRelatorioPdf'

export const runtime = 'nodejs'

// Token de alta entropia: 32 bytes em hexadecimal (64 caracteres). Qualquer
// valor fora desse formato é recusado antes de consultar o banco — evita
// tentativas de enumeração ou de injeção via o parâmetro de rota.
const TOKEN_REGEX = /^[0-9a-f]{64}$/i

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const ip = obterIpRequisicao(request.headers)
  const limite = verificarRateLimit(`relatorio-download:${ip}`, { limite: 20, janelaMs: 15 * 60 * 1000 })
  if (!limite.permitido) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  if (!TOKEN_REGEX.test(token)) {
    return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Configuração do Supabase pendente no servidor.' }, { status: 500 })
  }

  const { data: diagnostico, error: erroDiagnostico } = await admin
    .from('diagnosticos_reforma_tributaria')
    .select('id, lead_id, token, resultados, resumo, pontuacao, classificacao, versao_regras, versao_base_legal, versao_relatorio, criado_em, downloads_count, primeiro_download_em')
    .eq('token', token)
    .maybeSingle()

  if (erroDiagnostico || !diagnostico) {
    return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  }

  if (!diagnostico.lead_id) {
    return NextResponse.json({ error: 'Não foi possível localizar os dados da empresa para este diagnóstico.' }, { status: 404 })
  }

  const { data: lead, error: erroLead } = await admin
    .from('leads_reforma_tributaria')
    .select('nome, empresa, cnpj, regime_tributario, estado, cidade, sistema_emissor, codigo_diagnostico')
    .eq('id', diagnostico.lead_id)
    .maybeSingle()

  if (erroLead || !lead) {
    return NextResponse.json({ error: 'Não foi possível localizar os dados da empresa para este diagnóstico.' }, { status: 404 })
  }

  try {
    const dados = montarDadosRelatorio(diagnostico as unknown as DiagnosticoPersistido, lead as LeadPersistido)
    const { buffer, hash } = await gerarRelatorioPdf(dados)
    const nomeArquivo = nomeArquivoRelatorio(dados)

    const agora = new Date().toISOString()
    await admin
      .from('diagnosticos_reforma_tributaria')
      .update({
        relatorio_gerado_em: agora,
        relatorio_hash: hash,
        downloads_count: (diagnostico.downloads_count || 0) + 1,
        primeiro_download_em: diagnostico.primeiro_download_em || agora,
        ultimo_download_em: agora,
        status: 'pronto',
        mensagem_erro: null,
      })
      .eq('id', diagnostico.id)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (erro) {
    await admin
      .from('diagnosticos_reforma_tributaria')
      .update({ status: 'erro', mensagem_erro: erro instanceof Error ? erro.message.slice(0, 500) : 'Falha desconhecida na geração do PDF.' })
      .eq('id', diagnostico.id)

    return NextResponse.json({ error: 'Não foi possível gerar o relatório agora. Tente novamente em instantes.' }, { status: 500 })
  }
}
