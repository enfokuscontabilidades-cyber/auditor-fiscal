import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { cor } from '../diagnostico-reforma-tributaria/_components/tokens'

export const metadata: Metadata = {
  title: 'Termos de Uso | Enfokus Contabilidade',
  description: 'Condições de uso do diagnóstico gratuito de IBS e CBS da Enfokus Contabilidade.',
  robots: { index: true, follow: true },
}

const S = {
  page: { minHeight: '100vh', background: cor.fundoDegrade, color: cor.texto } as React.CSSProperties,
  header: { borderBottom: `1px solid ${cor.borda}`, padding: '18px 0' } as React.CSSProperties,
  shell: { width: 'min(860px, calc(100% - 32px))', margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 32, fontWeight: 900, color: cor.texto, margin: '34px 0 6px' } as React.CSSProperties,
  atualizado: { color: cor.textoFraco, fontSize: 13, marginBottom: 28 } as React.CSSProperties,
  h2: { fontSize: 18, fontWeight: 850, color: cor.acento, margin: '28px 0 8px' } as React.CSSProperties,
  p: { color: cor.textoSuave, fontSize: 14.5, lineHeight: 1.75, margin: '0 0 12px' } as React.CSSProperties,
  li: { color: cor.textoSuave, fontSize: 14.5, lineHeight: 1.75, marginBottom: 6 } as React.CSSProperties,
}

export default function TermosDeUsoPage() {
  return (
    <main style={S.page}>
      <div style={S.header}>
        <div style={S.shell}>
          <Link href="/diagnostico-reforma-tributaria">
            <Image src="/logo-enfokus-contabilidade.png" alt="Enfokus Contabilidade" width={864} height={289} style={{ width: 180, height: 'auto' }} />
          </Link>
        </div>
      </div>
      <div style={S.shell}>
        <h1 style={S.h1}>Termos de Uso</h1>
        <p style={S.atualizado}>Última atualização: julho de 2026</p>

        <p style={S.p}>
          Estes Termos de Uso regulam a utilização do diagnóstico gratuito de IBS e CBS disponibilizado pela
          <strong> Enfokus Contabilidade</strong> nesta página. Ao utilizar a ferramenta, você concorda com as
          condições abaixo.
        </p>

        <h2 style={S.h2}>1. Natureza da ferramenta</h2>
        <p style={S.p}>O diagnóstico é uma ferramenta gratuita e de caráter informativo, que analisa a estrutura
          técnica de arquivos XML de notas fiscais eletrônicas enviados voluntariamente pelo usuário, verificando a
          presença e a consistência básica dos campos relacionados ao IBS e à CBS, tributos da Reforma Tributária.</p>

        <h2 style={S.h2}>2. O que o diagnóstico não é</h2>
        <p style={S.p}>O resultado apresentado não constitui parecer contábil, tributário ou jurídico, não substitui
          uma análise individualizada da operação, do regime tributário ou do enquadramento da empresa, e não garante
          conformidade fiscal. A presença dos campos de IBS e CBS no XML não significa que os cálculos, alíquotas e
          códigos aplicados estejam corretos para a operação específica.</p>

        <h2 style={S.h2}>3. Responsabilidade pelo conteúdo enviado</h2>
        <p style={S.p}>O usuário é responsável por garantir que possui autorização para enviar os arquivos XML
          analisados e que estes correspondem a documentos fiscais legítimos da própria empresa. É proibido utilizar
          a ferramenta para envio de arquivos que não sejam documentos fiscais eletrônicos válidos ou para tentativas
          de sobrecarga, abuso ou ataque à plataforma.</p>

        <h2 style={S.h2}>4. Limites de uso</h2>
        <p style={S.p}>A ferramenta pode aplicar limites de quantidade e tamanho de arquivos por diagnóstico, bem
          como limites de tentativas por período, como medida de proteção contra uso abusivo. Esses limites podem ser
          ajustados a qualquer momento, sem aviso prévio.</p>

        <h2 style={S.h2}>5. Contato comercial</h2>
        <p style={S.p}>Ao autorizar expressamente no formulário, o usuário concorda em ser contatado pela Enfokus
          Contabilidade por telefone, WhatsApp ou e-mail para receber orientações e propostas de serviços contábeis e
          tributários relacionados ao resultado do diagnóstico.</p>

        <h2 style={S.h2}>6. Alterações</h2>
        <p style={S.p}>Estes termos podem ser atualizados a qualquer momento para refletir mudanças na ferramenta ou
          na legislação aplicável. A versão vigente é sempre a publicada nesta página.</p>

        <p style={{ ...S.p, marginTop: 24 }}>
          Para mais informações sobre o tratamento de dados pessoais, consulte a{' '}
          <Link href="/privacidade" style={{ color: cor.acento, fontWeight: 700 }}>Política de Privacidade</Link>.
        </p>

        <div style={{ padding: '30px 0 50px' }}>
          <Link href="/diagnostico-reforma-tributaria" style={{ color: cor.acento, fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            ← Voltar ao diagnóstico
          </Link>
        </div>
      </div>
    </main>
  )
}
