import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { cor } from '../diagnostico-reforma-tributaria/_components/tokens'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Enfokus Contabilidade',
  description: 'Como a Enfokus trata os dados pessoais coletados em seus formulários públicos.',
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

export default function PoliticaPrivacidadePage() {
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
        <h1 style={S.h1}>Política de Privacidade</h1>
        <p style={S.atualizado}>Última atualização: julho de 2026</p>

        <p style={S.p}>
          Esta Política de Privacidade descreve como a <strong>Enfokus Contabilidade</strong> coleta, utiliza e protege os
          dados pessoais informados por visitantes que utilizam o diagnóstico gratuito de IBS e CBS ou solicitam
          acesso antecipado à plataforma, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>

        <h2 style={S.h2}>1. Quais dados coletamos</h2>
        <p style={S.p}>Ao preencher o formulário do diagnóstico, coletamos: nome, nome da empresa, CNPJ, WhatsApp, e-mail,
          regime tributário, estado, cidade e, quando informado, o sistema utilizado para emissão de notas fiscais.
          No formulário de acesso antecipado, coletamos nome, WhatsApp, e-mail, perfil profissional, finalidades de uso
          selecionadas e, quando informados, escritório ou empresa, cargo, quantidade de clientes e principal desafio.
          Também registramos automaticamente a origem do acesso, os parâmetros de campanha (UTM), a página de origem,
          o endereço IP e o horário do envio, para fins de segurança e mensuração de campanhas.</p>

        <h2 style={S.h2}>2. O que fazemos com os arquivos XML enviados</h2>
        <p style={S.p}>Os arquivos XML enviados para análise são processados em memória, em nosso servidor, apenas
          para gerar o diagnóstico solicitado, e não são gravados em disco nem armazenados de forma permanente. Após
          o processamento, o conteúdo do arquivo é descartado. Apenas um resumo numérico do resultado do diagnóstico
          (quantidade de notas analisadas e situação de cada uma) é associado ao seu cadastro.</p>

        <h2 style={S.h2}>3. Finalidade do tratamento</h2>
        <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
          <li style={S.li}>Viabilizar a execução do diagnóstico gratuito solicitado;</li>
          <li style={S.li}>Analisar solicitações de acesso antecipado e selecionar perfis para testes da plataforma;</li>
          <li style={S.li}>Entrar em contato para apresentar orientações e serviços de adequação tributária, quando você autorizar;</li>
          <li style={S.li}>Cumprir obrigações legais e prevenir fraudes e uso abusivo da ferramenta.</li>
        </ul>

        <h2 style={S.h2}>4. Compartilhamento</h2>
        <p style={S.p}>Os dados não são vendidos ou compartilhados com terceiros para fins de marketing alheios à
          Enfokus Contabilidade. Podemos utilizar prestadores de infraestrutura (hospedagem e banco de dados) que
          atuam como operadores, sempre sob obrigações contratuais de confidencialidade.</p>

        <h2 style={S.h2}>5. Seus direitos</h2>
        <p style={S.p}>Você pode solicitar, a qualquer momento, a confirmação, o acesso, a correção, a portabilidade
          ou a eliminação dos seus dados pessoais, bem como revogar o consentimento para contato comercial, entrando
          em contato pelos canais informados no rodapé desta página.</p>

        <h2 style={S.h2}>6. Retenção</h2>
        <p style={S.p}>Os dados cadastrais são mantidos pelo prazo necessário ao atendimento das finalidades acima ou
          até a solicitação de eliminação pelo titular, respeitadas eventuais obrigações legais de guarda.</p>

        <p style={{ ...S.p, marginTop: 24 }}>
          Dúvidas sobre esta política podem ser enviadas para o e-mail de contato informado no rodapé do site.
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
