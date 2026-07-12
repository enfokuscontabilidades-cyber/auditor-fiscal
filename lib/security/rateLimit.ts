// Rate limiter simples em memória, por chave (ex: IP), para rotas públicas.
// Limitação conhecida: o contador é por instância do processo Node — em um
// deploy com múltiplas instâncias/serverless o limite é por instância, não
// global. Suficiente como primeira barreira contra abuso de formulário público;
// para um limite realmente global seria necessário um store compartilhado
// (ex. Redis), fora do escopo desta isca digital.

type Registro = { timestamps: number[] }

const janelas = new Map<string, Registro>()

const LIMPEZA_INTERVALO_MS = 10 * 60 * 1000
let ultimaLimpeza = Date.now()

function limparAntigos(agora: number, janelaMs: number) {
  if (agora - ultimaLimpeza < LIMPEZA_INTERVALO_MS) return
  ultimaLimpeza = agora
  for (const [chave, registro] of janelas) {
    registro.timestamps = registro.timestamps.filter(t => agora - t < janelaMs)
    if (registro.timestamps.length === 0) janelas.delete(chave)
  }
}

export function verificarRateLimit(
  chave: string,
  opcoes: { limite: number; janelaMs: number },
): { permitido: boolean; restantes: number } {
  const agora = Date.now()
  limparAntigos(agora, opcoes.janelaMs)

  const registro = janelas.get(chave) ?? { timestamps: [] }
  registro.timestamps = registro.timestamps.filter(t => agora - t < opcoes.janelaMs)

  if (registro.timestamps.length >= opcoes.limite) {
    janelas.set(chave, registro)
    return { permitido: false, restantes: 0 }
  }

  registro.timestamps.push(agora)
  janelas.set(chave, registro)
  return { permitido: true, restantes: opcoes.limite - registro.timestamps.length }
}

export function obterIpRequisicao(headers: Headers): string {
  const encaminhado = headers.get('x-forwarded-for')
  if (encaminhado) return encaminhado.split(',')[0].trim()
  return headers.get('x-real-ip') || 'desconhecido'
}
