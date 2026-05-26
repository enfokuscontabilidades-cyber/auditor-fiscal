"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, AlertTriangle, CheckCircle2, Search, Download,
  Filter, Trash2, FileText, FileX, ChevronDown, ChevronRight,
  Tag, ArrowUpRight, ArrowDownLeft, Info,
} from "lucide-react";
import * as XLSX from "xlsx";
import ModalSessao, { type DadosSessao } from "@/components/ModalSessao";
import { useEmpresaAtiva } from "@/lib/hooks/useEmpresaAtiva";

// ══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════════════════════

type StatusValidacao = "OK" | "ALERTA";
type PerfilEmpresa = "geral" | "supermercado" | "restaurante" | "construcao";
type ClassificacaoManual =
  | "revenda" | "insumo" | "uso_consumo" | "imobilizado" | "combustivel"
  | "desconhece" | "nao_recebido" | "servico" | null;

type AnaliseSugestao = {
  tipo: "uso_consumo" | "imobilizado" | "combustivel" | null;
  motivo: string;
  confianca: "alta" | "media" | "baixa" | null;
};

type DadosEmpresa = {
  nome: string; cnpj: string; ie: string; uf: string;
  periodoInicial: string; periodoFinal: string;
  ehIndustrial: boolean; // IND_ATIV=0 no registro 0000
};

type TipoNFe = "terceiro" | "proprio" | null;

type LinhaEntrada = {
  id: string;
  numero_nota: string; fornecedor: string; data: string;
  codigo_produto: string; cst_icms: string; ncm: string;
  descricao: string; cfop: string;
  valor_contabil: number; base_icms: number; aliquota_icms: number; valor_icms: number;
  // Composição do valor contábil (rateio de frete/desconto/despesas/IPI)
  valor_produto: number;       // vProd original sem rateio
  valor_desconto: number;      // desconto rateado
  valor_frete: number;         // frete rateado
  valor_despesas: number;      // outras despesas rateadas
  valor_ipi_item: number;      // IPI do item
  valor_total_nota?: number;   // total da nota (para referência)
  status: StatusValidacao; avisos: string[];
  sugestao: AnaliseSugestao; classificacao: ClassificacaoManual;
  classificacaoManual?: boolean; // true = usuário definiu manualmente; false/undefined = sugestão automática
  fonte: "sped" | "xml" | "c190" | "xml_proprio";
  tipo_nfe?: TipoNFe;           // terceiro = fornecedor emitiu para a empresa; proprio = empresa emitiu
  cfop_entrada_sugerido?: string; // CFOP sugerido para lançamento no SPED (apenas terceiros)
  cancelada?: boolean;
};

type LinhaSaida = {
  id: string;
  numero_nota: string; destinatario: string; data: string;
  codigo_produto: string; descricao: string; ncm: string; cfop: string;
  cst_icms: string; cst_pis: string; cst_cofins: string;
  valor_contabil: number;
  valor_produto: number;    // vProd original
  valor_desconto: number;   // desconto rateado
  valor_frete: number;      // frete rateado
  valor_despesas: number;   // outras despesas rateadas
  valor_ipi_item: number;   // IPI do item
  base_icms: number; aliquota_icms: number; valor_icms: number;
  base_st: number; valor_st: number; valor_ipi: number;
  base_pis: number; aliquota_pis: number; valor_pis: number;
  base_cofins: number; aliquota_cofins: number; valor_cofins: number;
  valor_ibs: number; valor_cbs: number;
  cbenef: string; cbenef_descricao: string;
  alertas_saida: string[]; status: StatusValidacao;
  cancelada?: boolean;
  valor_total_nota?: number;  // vNF da nota — fonte verdade para o total
};

// Nota de saída agrupada
type NotaSaida = {
  chave: string; numero_nota: string; destinatario: string; data: string;
  total_itens: number; total_contabil: number;
  total_icms: number; total_pis: number; total_cofins: number;
  total_ibs: number; total_cbs: number;
  status: StatusValidacao; itens: LinhaSaida[];
  tem_cbenef: boolean; alertas: string[];
};

type Filtros = {
  somenteAlertas: boolean; cfop: string; ncm: string; busca: string; classificacao: string;
};

type Item0200 = { descricao: string; ncm: string };
type Participante0150 = { nome: string };

type NotaEntrada = {
  chave: string; numero_nota: string; fornecedor: string; data: string;
  total_itens: number; total_contabil: number; total_base_icms: number; total_valor_icms: number;
  status: StatusValidacao; itens: LinhaEntrada[]; sugestoes: string[]; avisos: string[];
  classificacaoPredominante: ClassificacaoManual;
};

// ══════════════════════════════════════════════════════════════════════════════
// TABELA CBenef — Goiás (IN 1518/2022-GSE)
// ══════════════════════════════════════════════════════════════════════════════

const CBENEF_GO: Record<string, string> = {
  "GO800001":"NÃO INCIDÊNCIA - Exportação de mercadoria ao exterior",
  "GO800002":"NÃO INCIDÊNCIA - Petróleo/combustível/energia elétrica para outro Estado (comercialização/industrialização)",
  "GO800003":"NÃO INCIDÊNCIA - Ouro como ativo financeiro ou instrumento cambial",
  "GO800004":"NÃO INCIDÊNCIA - Livro, jornal, periódico e papel para impressão",
  "GO800005":"NÃO INCIDÊNCIA - Mercadoria sujeita ao ISS dos municípios",
  "GO800006":"NÃO INCIDÊNCIA - Remessa a sucessor legal sem saída física",
  "GO800007":"NÃO INCIDÊNCIA - Alienação fiduciária em garantia",
  "GO800008":"NÃO INCIDÊNCIA - Arrendamento mercantil (exceto venda do bem ao arrendatário)",
  "GO800012":"NÃO INCIDÊNCIA - Alienação de ativo imobilizado",
  "GO800013":"NÃO INCIDÊNCIA - Saída de bem em comodato",
  "GO800016":"NÃO INCIDÊNCIA - Saída interna para industrialização ou outro tratamento",
  "GO800021":"NÃO INCIDÊNCIA - Saída para demonstração (inclusive a consumidor final)",
  "GO800022":"NÃO INCIDÊNCIA - Saída para mostruário ou treinamento",
  "GO811001":"ISENÇÃO - Saída para exposição ou feira de amostra",
  "GO811004":"ISENÇÃO - Fornecimento de refeição sem finalidade lucrativa",
  "GO811010":"ISENÇÃO - Hortifrutícola, pintos de um dia, ovos em estado natural",
  "GO811015":"ISENÇÃO - Saída interna varejista de leite pasteurizado tipo especial",
  "GO811020":"ISENÇÃO - Energia elétrica residencial até 50 KW/h mensais",
  "GO811021":"ISENÇÃO - Transporte urbano/metropolitano com tarifa reduzida",
  "GO811024":"ISENÇÃO - Transporte rodoviário de passageiro por táxi",
  "GO811026":"ISENÇÃO - Amostra de produto de diminuto valor comercial",
  "GO811053":"ISENÇÃO - Mercadoria da cesta básica (saída interna)",
  "GO811064":"ISENÇÃO - Equipamentos/acessórios para portadores de deficiência física",
  "GO811082":"ISENÇÃO - Operação/prestação internas para Administração Pública Estadual Direta",
  "GO811128":"ISENÇÃO - Etanol anidro combustível para armazenagem dutoviária",
  "GO811130":"ISENÇÃO - Gorjeta em bares/restaurantes/hotéis",
  "GO811131":"ISENÇÃO - Energia elétrica pelo sistema de compensação (geração distribuída)",
  "GO811133":"ISENÇÃO - Produtos para geração de energia solar (operação interna)",
  "GO821001":"REDUÇÃO DE BASE - Saída de mercadoria usada cuja entrada não foi onerada pelo ICMS",
  "GO821002":"REDUÇÃO DE BASE - Saída interna de leite pasteurizado tipo especial",
  "GO821003":"REDUÇÃO DE BASE - Saída tributada interna de GLP",
  "GO821005":"REDUÇÃO DE BASE - Saída interna para comercialização, produção ou industrialização",
  "GO821007":"REDUÇÃO DE BASE - Fornecimento de refeições por bares, restaurantes e similares",
  "GO821008":"REDUÇÃO DE BASE - Produto de informática, telecomunicação ou automação (saída interna)",
  "GO821010":"REDUÇÃO DE BASE - Arroz e feijão industrializados em GO",
  "GO821011":"REDUÇÃO DE BASE - Areia natural/artificial, saibro, material britado (operação interna)",
  "GO821017":"REDUÇÃO DE BASE - Bem para ativo imobilizado de estabelecimento industrial ou agropecuário",
  "GO821019":"REDUÇÃO DE BASE - Mercadorias da cesta básica (operação interna)",
  "GO821025":"REDUÇÃO DE BASE - Saída interestadual de carnes e comestíveis de abate bovino/suíno",
  "SEM CBENEF":"Item sem benefício fiscal (CST/situação exige informação do cBenef)",
};

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════════════════════

const PERFIS_EMPRESA_LABEL: Record<PerfilEmpresa, string> = {
  geral:"Empresa geral", supermercado:"Supermercado",
  restaurante:"Bar / Restaurante", construcao:"Construção civil",
};

const CLASSIFICACAO_LABEL: Record<NonNullable<ClassificacaoManual>, string> = {
  revenda:"Revenda", insumo:"Insumo", uso_consumo:"Uso e Consumo", imobilizado:"Imobilizado",
  combustivel:"Combustível", desconhece:"Desconhece NF",
  nao_recebido:"Não recebido no mês", servico:"Serviço",
};

const CLASSIFICACAO_COR: Record<NonNullable<ClassificacaoManual>, string> = {
  revenda:"#34d399", insumo:"var(--af-success)", uso_consumo:"var(--af-warning)", imobilizado:"#a78bfa",
  combustivel:"#f472b6", desconhece:"var(--af-danger)", nao_recebido:"#facc15", servico:"#60a5fa",
};

const NCM_UC = ["1006","0713","1701","1507","1511","1512","1517","2201","2202","2203","2204","2205","2206","2207","2208","0901","0902","1905","2101","2106","3003","3004","3005","3303","3304","3305","3306","3307","3401","3402","3808","3924","4818","4823","9603","9608",
  // Cama, mesa e banho (têxteis domésticos)
  "6301","6302","6304",
  // Artigos de vidro para mesa/cozinha (copos, taças, jarras)
  "7013",
  // Artigos de ferro/aço inox de uso doméstico (panelas, formas, utensílios)
  "7323",
  // Cutelaria e talheres (facas, garfos, colheres, conchas)
  "8211","8215",
  // Louças e porcelana (pratos, xícaras)
  "6911","6912",
  // Artigos de plástico para banheiro/cozinha (bacias, baldes, escorredores)
  "3922",
];
const NCM_IMOB = ["7321","8210","8414","8415","8418","8421","8422","8428","8436","8450","8467","8470","8471","8472","8479","8508","8509","8516","8517","8518","8528","8539","8709","8716","9018","9403","9405"];
const NCM_COMB = ["2710","2711","220710","220720","382600"];

// ══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════════════════

function gid() { return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
function ntx(v: unknown) { return v==null?"":String(v).trim(); }
function ncfop(v: unknown) { return ntx(v).replace(/\D/g,"").slice(0,4); }
// Para valores do SPED (formato pt-BR: ponto=milhar, vírgula=decimal)
function nnum(v: unknown): number {
  if (v==null||v==="") return 0;
  if (typeof v==="number") return Number.isFinite(v)?v:0;
  const n=Number(String(v).trim().replace(/R\$/gi,"").replace(/\s/g,"").replace(/\./g,"").replace(/,/g,"."));
  return Number.isFinite(n)?n:0;
}
// Para valores do XML NF-e (formato XML/americano: ponto=decimal, sem separador de milhar)
function nnumXml(v: unknown): number {
  if (v==null||v==="") return 0;
  if (typeof v==="number") return Number.isFinite(v)?v:0;
  // XML da NF-e sempre usa ponto como decimal (ex: "1234.56", "310592.72")
  // Não tem separador de milhar, então só limpa espaços e símbolos
  const s=String(v).trim().replace(/R\$/gi,"").replace(/\s/g,"");
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}
function fmoe(v: number) { return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0); }
function fperc(v: number) { return `${(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`; }
function fc(p: string[], i: number) { return ntx(p[i]??""); }
function fdata(v: string) {
  const l=ntx(v).replace(/\D/g,"");
  if (l.length!==8) return ntx(v);
  return `${l.slice(0,2)}/${l.slice(2,4)}/${l.slice(4,8)}`;
}
function fcnpj(v: string) {
  const l=ntx(v).replace(/\D/g,"");
  if (l.length!==14) return v;
  return `${l.slice(0,2)}.${l.slice(2,5)}.${l.slice(5,8)}/${l.slice(8,12)}-${l.slice(12,14)}`;
}
function ncm2(ncm: string, lst: string[]) {
  const l=ntx(ncm).replace(/\D/g,"");
  return l?(lst.find(p=>l.startsWith(p))||null):null;
}

// Helper: pega o texto do primeiro elemento filho com esse localName dentro do nó
function tagTxt(node: Element|null|undefined, tagName: string): string {
  if (!node) return "";
  // Busca direta sem namespace (funciona com e sem namespace no DOMParser)
  const found = node.getElementsByTagName(tagName)[0];
  return found?.textContent?.trim()||"";
}

// ══════════════════════════════════════════════════════════════════════════════
// CFOP
// ══════════════════════════════════════════════════════════════════════════════

// Descrição resumida do CFOP para exibição no resumo
const DESC_CFOP: Record<string,string> = {
  // ── 1xxx — Entradas / Aquisições internas ─────────────────────────────────
  "1101":"Compra p/ industrialização ou produção rural",
  "1102":"Compra p/ comercialização",
  "1111":"Compra p/ industrialização de produto sob encomenda",
  "1113":"Compra p/ industrialização — ativo imobilizado",
  "1116":"Compra p/ uso e consumo",
  "1117":"Compra p/ ativo imobilizado",
  "1118":"Compra de embalagem",
  "1120":"Compra p/ industrialização em zona franca",
  "1121":"Compra p/ industrialização em zona franca — recebido de terceiro",
  "1122":"Compra p/ comercialização em zona franca",
  "1124":"Industrialização por encomenda — produto retornado",
  "1125":"Industrialização por encomenda — insumo retornado",
  "1126":"Compra p/ utilização na prestação de serviço sujeito ao ICMS",
  "1151":"Transferência p/ industrialização",
  "1152":"Transferência p/ comercialização",
  "1153":"Transferência de energia elétrica p/ distribuição",
  "1154":"Transferência p/ utilização na prestação de serviço",
  "1201":"Devolução de venda de produto industrializado",
  "1202":"Devolução de venda de mercadoria",
  "1203":"Devolução de venda de produto de extração mineral",
  "1204":"Devolução de venda de bem do ativo imobilizado",
  "1205":"Anulação de prestação de serviço de comunicação",
  "1206":"Anulação de prestação de serviço de transporte",
  "1207":"Anulação de venda de energia elétrica",
  "1208":"Devolução de venda — simples nacional (excedente)",
  "1209":"Devolução de venda — ST (excedente)",
  "1210":"Devolução de venda — simples nacional",
  "1250":"Compra de energia elétrica p/ distribuição",
  "1251":"Compra de energia elétrica p/ consumo próprio",
  "1252":"Compra de energia elétrica p/ estab. industrial",
  "1253":"Compra de energia elétrica p/ estab. comercial",
  "1256":"Compra de energia elétrica p/ produtor rural",
  "1257":"Compra de energia elétrica p/ uso e consumo",
  "1301":"Aquis. de serviço de comunicação p/ execução de serviço da mesma natureza",
  "1302":"Aquis. de serviço de comunicação p/ execução de radiodifusão sonora",
  "1303":"Aquis. de serviço de comunicação p/ estab. industrial",
  "1304":"Aquis. de serviço de comunicação p/ estab. comercial",
  "1307":"Aquis. de serviço de comunicação p/ uso e consumo",
  "1351":"Aquis. de serviço de transporte p/ execução de serviço da mesma natureza",
  "1352":"Aquis. de serviço de transporte p/ estab. industrial",
  "1353":"Aquis. de serviço de transporte p/ estab. comercial",
  "1354":"Aquis. de serviço de transporte p/ prestador de serviço de comunicação",
  "1355":"Aquis. de serviço de transporte p/ uso e consumo",
  "1356":"Aquis. de serviço de transporte p/ produtor rural",
  "1401":"Compra de combustível p/ industrialização",
  "1403":"Compra de combustível p/ comercialização",
  "1406":"Compra de combustível p/ ativo imobilizado",
  "1407":"Compra de combustível p/ uso e consumo",
  "1501":"Entrada de mercadoria recebida com fim específico de exportação",
  "1503":"Entrada de mercadoria de estab. que destina ao exterior",
  "1551":"Compra de bem p/ ativo imobilizado",
  "1552":"Transferência de bem do ativo imobilizado",
  "1553":"Devolução de venda de bem do ativo imobilizado",
  "1554":"Retorno de bem do ativo imobilizado p/ conserto",
  "1555":"Entrada de bem do ativo imobilizado de terceiro",
  "1556":"Compra de material de uso e consumo",
  "1557":"Transferência de material de uso e consumo",
  "1603":"Importação de combustível",
  "1651":"Compra de combustível — ST",
  "1652":"Compra de combustível — contribuinte substituto",
  "1653":"Compra de combustível — sem ST (exceto volume morto)",
  "1901":"Entrada p/ industrialização por encomenda",
  "1902":"Retorno de mercadoria remetida p/ industrialização por encomenda",
  "1910":"Entrada de bonificação em mercadoria",
  "1911":"Entrada de amostra grátis",
  "1912":"Entrada de mercadoria em doação",
  "1913":"Entrada de brinde",
  "1914":"Entrada de mercadoria p/ demonstração",
  "1915":"Retorno de mercadoria remetida p/ demonstração",
  "1916":"Entrada de produto recebido de armazém-geral",
  "1919":"Retorno de produto enviado a armazém-geral",
  "1924":"Retorno de remessa p/ industrialização por encomenda",
  "1949":"Outra entrada de mercadoria ou prestação de serviço não especificada",
  // ── 2xxx — Entradas / Aquisições interestaduais ───────────────────────────
  "2101":"Compra p/ industrialização ou produção rural (interestadual)",
  "2102":"Compra p/ comercialização (interestadual)",
  "2111":"Compra p/ industrialização de produto sob encomenda (interestadual)",
  "2113":"Compra p/ industrialização — ativo imobilizado (interestadual)",
  "2116":"Compra p/ uso e consumo (interestadual)",
  "2117":"Compra p/ ativo imobilizado (interestadual)",
  "2118":"Compra de embalagem (interestadual)",
  "2120":"Compra p/ industrialização em zona franca (interestadual)",
  "2122":"Compra p/ comercialização em zona franca (interestadual)",
  "2124":"Industrialização por encomenda — produto retornado (interestadual)",
  "2125":"Industrialização por encomenda — insumo retornado (interestadual)",
  "2126":"Compra p/ utilização na prestação de serviço sujeito ao ICMS (interestadual)",
  "2151":"Transferência p/ industrialização (interestadual)",
  "2152":"Transferência p/ comercialização (interestadual)",
  "2153":"Transferência de energia elétrica p/ distribuição (interestadual)",
  "2154":"Transferência p/ utilização na prestação de serviço (interestadual)",
  "2201":"Devolução de venda de produto industrializado (interestadual)",
  "2202":"Devolução de venda de mercadoria (interestadual)",
  "2203":"Devolução de venda de produto de extração mineral (interestadual)",
  "2204":"Devolução de venda de bem do ativo imobilizado (interestadual)",
  "2205":"Anulação de prestação de serviço de comunicação (interestadual)",
  "2206":"Anulação de prestação de serviço de transporte (interestadual)",
  "2207":"Anulação de venda de energia elétrica (interestadual)",
  "2208":"Devolução de venda — simples nacional (interestadual)",
  "2250":"Compra de energia elétrica p/ distribuição (interestadual)",
  "2251":"Compra de energia elétrica p/ consumo próprio (interestadual)",
  "2252":"Compra de energia elétrica p/ estab. industrial (interestadual)",
  "2253":"Compra de energia elétrica p/ estab. comercial (interestadual)",
  "2256":"Compra de energia elétrica p/ produtor rural (interestadual)",
  "2257":"Compra de energia elétrica p/ uso e consumo (interestadual)",
  "2301":"Aquis. de serviço de comunicação p/ execução de serviço da mesma natureza (interestadual)",
  "2302":"Aquis. de serviço de comunicação p/ radiodifusão sonora (interestadual)",
  "2303":"Aquis. de serviço de comunicação p/ estab. industrial (interestadual)",
  "2304":"Aquis. de serviço de comunicação p/ estab. comercial (interestadual)",
  "2307":"Aquis. de serviço de comunicação p/ uso e consumo (interestadual)",
  "2351":"Aquis. de serviço de transporte p/ execução de serviço da mesma natureza (interestadual)",
  "2352":"Aquis. de serviço de transporte p/ estab. industrial (interestadual)",
  "2353":"Aquis. de serviço de transporte p/ estab. comercial (interestadual)",
  "2355":"Aquis. de serviço de transporte p/ uso e consumo (interestadual)",
  "2401":"Compra de combustível p/ industrialização (interestadual)",
  "2403":"Compra de combustível p/ comercialização (interestadual)",
  "2406":"Compra de combustível p/ ativo imobilizado (interestadual)",
  "2407":"Compra de combustível p/ uso e consumo (interestadual)",
  "2501":"Entrada de mercadoria recebida com fim específico de exportação (interestadual)",
  "2551":"Compra de bem p/ ativo imobilizado (interestadual)",
  "2552":"Transferência de bem do ativo imobilizado (interestadual)",
  "2553":"Devolução de venda de bem do ativo imobilizado (interestadual)",
  "2555":"Entrada de bem do ativo imobilizado de terceiro (interestadual)",
  "2556":"Compra de material de uso e consumo (interestadual)",
  "2557":"Transferência de material de uso e consumo (interestadual)",
  "2603":"Importação de combustível (interestadual)",
  "2651":"Compra de combustível — ST (interestadual)",
  "2910":"Entrada de bonificação em mercadoria (interestadual)",
  "2911":"Entrada de amostra grátis (interestadual)",
  "2912":"Entrada de mercadoria em doação (interestadual)",
  "2914":"Entrada de mercadoria p/ demonstração (interestadual)",
  "2916":"Entrada de produto recebido de armazém-geral (interestadual)",
  "2949":"Outra entrada de mercadoria ou prestação de serviço não especificada (interestadual)",
  // ── 3xxx — Entradas / Aquisições do exterior ──────────────────────────────
  "3101":"Compra p/ industrialização ou produção rural — importação",
  "3102":"Compra p/ comercialização — importação",
  "3126":"Compra p/ utilização na prestação de serviço — importação",
  "3127":"Compra p/ industrialização — ativo imobilizado — importação",
  "3201":"Devolução de venda p/ o exterior",
  "3211":"Devolução de venda de bem do ativo imobilizado p/ o exterior",
  "3251":"Compra de bem p/ ativo imobilizado — importação",
  "3301":"Aquis. de serviço de comunicação p/ execução de serviço da mesma natureza — importação",
  "3351":"Aquis. de serviço de transporte p/ execução de serviço da mesma natureza — importação",
  "3352":"Aquis. de serviço de transporte p/ estab. industrial — importação",
  "3353":"Aquis. de serviço de transporte p/ estab. comercial — importação",
  "3356":"Aquis. de serviço de transporte p/ uso e consumo — importação",
  "3503":"Devolução de mercadoria exportada com fim específico de exportação",
  "3551":"Compra de bem p/ ativo imobilizado — importação",
  "3553":"Devolução de venda de bem do ativo imobilizado — importação",
  "3556":"Compra de material de uso e consumo — importação",
  "3651":"Importação de combustível",
  "3949":"Outra entrada de mercadoria — importação",
  // ── 5xxx — Saídas / Prestações internas ──────────────────────────────────
  "5101":"Venda de produto industrializado",
  "5102":"Venda de mercadoria adquirida p/ comercialização",
  "5103":"Venda de produto industrializado — produção própria p/ encomendante",
  "5104":"Venda de mercadoria utilizada no processo produtivo",
  "5105":"Venda de produto industrializado — mão de obra de terceiros",
  "5106":"Venda de produto industrializado — ativo imobilizado",
  "5109":"Venda de produto industrializado utilizado como insumo — zona franca",
  "5110":"Venda de produto industrializado — transferência de crédito",
  "5111":"Venda de produto industrializado — zona franca",
  "5112":"Venda de produto — encomenda (insumos do encomendante)",
  "5113":"Venda de produto — zona franca — mão de obra de terceiros",
  "5114":"Venda de produto — encomenda — insumos próprios",
  "5115":"Venda de insumo importado com suspensão do IPI",
  "5116":"Venda de produto industrializado originada de encomenda",
  "5117":"Venda de mercadoria adquirida originada de encomenda",
  "5118":"Venda de produto de ativo imobilizado",
  "5119":"Venda de produto industrializado — falta de mercadoria",
  "5120":"Venda de produto industrializado p/ zona franca",
  "5122":"Venda de produto — zona franca — recebido de terceiro",
  "5123":"Venda de produto — zona franca — equiparado ao exportador",
  "5124":"Industrialização efetuada p/ outras empresas",
  "5125":"Industrialização efetuada p/ outras empresas — insumos de terceiros",
  "5151":"Transferência p/ industrialização",
  "5152":"Transferência p/ comercialização",
  "5153":"Transferência de energia elétrica",
  "5154":"Transferência p/ utilização na prestação de serviço",
  "5155":"Transferência de produção do estabelecimento",
  "5156":"Transferência de mercadoria adquirida p/ comércio",
  "5201":"Devolução de compra p/ industrialização",
  "5202":"Devolução de compra p/ comercialização",
  "5203":"Devolução de compra de produto mineral",
  "5204":"Devolução de compra p/ formação de lote exportação",
  "5205":"Anulação de valor relativo a serviço de comunicação",
  "5206":"Anulação de valor relativo a serviço de transporte",
  "5207":"Anulação de valor relativo a energia elétrica",
  "5208":"Devolução de compra — simples nacional",
  "5209":"Devolução de compra — ST",
  "5210":"Devolução de compra de energia elétrica",
  "5251":"Venda de energia elétrica p/ distribuição",
  "5252":"Venda de energia elétrica p/ estab. industrial",
  "5253":"Venda de energia elétrica p/ estab. comercial",
  "5254":"Venda de energia elétrica p/ estab. prestador de serviços de transporte",
  "5255":"Venda de energia elétrica p/ estab. prestador de serviços de comunicação",
  "5256":"Venda de energia elétrica p/ estab. de produtor rural",
  "5257":"Venda de energia elétrica p/ uso e consumo",
  "5258":"Venda de energia elétrica p/ consumidor final",
  "5301":"Prest. de serviço de comunicação p/ execução de serviço da mesma natureza",
  "5302":"Prest. de serviço de comunicação p/ estab. industrial",
  "5303":"Prest. de serviço de comunicação p/ estab. comercial",
  "5304":"Prest. de serviço de comunicação p/ estab. de produtor rural",
  "5305":"Prest. de serviço de comunicação p/ estab. prestador de serviços de comunicação",
  "5306":"Prest. de serviço de comunicação p/ estab. prestador de serviços de transporte",
  "5307":"Prest. de serviço de comunicação p/ não contribuinte",
  "5351":"Prest. de serviço de transporte p/ execução de serviço da mesma natureza",
  "5352":"Prest. de serviço de transporte p/ estab. industrial",
  "5353":"Prest. de serviço de transporte p/ estab. comercial",
  "5354":"Prest. de serviço de transporte p/ estab. prestador de serviços de comunicação",
  "5355":"Prest. de serviço de transporte p/ estab. de produtor rural",
  "5356":"Prest. de serviço de transporte p/ estab. prestador de serviços de transporte",
  "5357":"Prest. de serviço de transporte p/ não contribuinte",
  "5360":"Prest. de serviço de transporte a contribuinte substituto",
  "5401":"Venda de combustível — substituição tributária",
  "5402":"Venda de combustível — sem ST (exceto para industrialização)",
  "5403":"Venda de combustível — diferimento",
  "5404":"Venda de combustível — contribuinte substituto",
  "5405":"Venda de combustível — contribuinte substituído",
  "5408":"Venda de combustível — ajuste de diferencial de alíquota",
  "5409":"Venda de combustível — imune ou não tributada",
  "5451":"Venda de animal",
  "5501":"Remessa p/ industrialização por encomenda",
  "5502":"Retorno de mercadoria remetida p/ industrialização",
  "5503":"Retorno de mercadoria remetida p/ industrialização — parcial",
  "5504":"Remessa p/ industrialização — mercadoria de terceiro",
  "5505":"Retorno de mercadoria — terceiro — p/ industrialização",
  "5551":"Venda de bem do ativo imobilizado",
  "5552":"Transferência de bem do ativo imobilizado",
  "5553":"Devolução de compra de bem do ativo imobilizado",
  "5554":"Remessa de bem do ativo imobilizado p/ uso fora do estab.",
  "5555":"Remessa de bem do ativo imobilizado p/ conserto",
  "5556":"Retorno de bem do ativo imobilizado recebido p/ conserto",
  "5557":"Transferência de material de uso e consumo",
  "5601":"Transferência de ativo imobilizado",
  "5602":"Transferência de saldo devedor ICMS",
  "5605":"Transferência de saldo credor ICMS",
  "5651":"Venda de combustível — ST — produtor rural",
  "5652":"Venda de combustível — ST — indústria e comércio",
  "5901":"Remessa p/ industrialização por encomenda",
  "5902":"Retorno de mercadoria utilizada na industrialização por encomenda",
  "5903":"Retorno de mercadoria recebida p/ industrialização sem aplicação",
  "5904":"Remessa p/ venda fora do estab.",
  "5905":"Remessa p/ depósito fechado ou armazém-geral",
  "5906":"Retorno de mercadoria depositada em armazém-geral",
  "5907":"Retorno de mercadoria mandada depositar em armazém-geral",
  "5908":"Remessa de bem por conta de contrato de comodato",
  "5909":"Retorno de bem recebido por conta de contrato de comodato",
  "5910":"Remessa de produto p/ empréstimo entre estabs.",
  "5911":"Retorno de produto recebido em empréstimo",
  "5912":"Remessa de mercadoria ou bem p/ demonstração",
  "5913":"Retorno de mercadoria ou bem recebido p/ demonstração",
  "5914":"Remessa de mercadoria ou bem p/ exposição ou feira",
  "5915":"Remessa de mercadoria ou bem p/ consumidor final — saída eventual",
  "5916":"Remessa em bonificação, doação ou brinde",
  "5917":"Remessa de amostras grátis",
  "5918":"Remessa de produto p/ conserto",
  "5919":"Retorno de produto recebido p/ conserto",
  "5920":"Remessa de vasilhame ou sacaria",
  "5921":"Devolução de vasilhame ou sacaria",
  "5922":"Lançamento efetuado a título de simples faturamento — sem trânsito da mercadoria",
  "5923":"Remessa de mercadoria p/ industrialização — sem trânsito pela empresa",
  "5924":"Remessa p/ industrialização p/ terceiros — sem trânsito pelo depositante",
  "5925":"Retorno de mercadoria p/ industrialização — sem trânsito pela empresa",
  "5926":"Lançamento efetuado p/ registrar a devolução de mercadoria — estabelecimento produtor rural",
  "5927":"Lançamento efetuado p/ registrar venda de prod. rural sem trânsito",
  "5928":"Lançamento efetuado p/ registrar saída de mercadoria depositada em armazém-geral — sem trânsito",
  "5929":"Remessa de animal — criação",
  "5930":"Lançamento efetuado a título de baixa de estoque",
  "5931":"Lançamento efetuado p/ ajuste de valores",
  "5932":"Transferência p/ armazém-geral ou depósito fechado do depositante",
  "5933":"Transferência de mercadoria — sistema de emissão em contingência",
  "5934":"Remessa simbólica de mercadoria depositada em armazém-geral — exportação",
  "5935":"Remessa p/ entidade beneficente de assistência social",
  "5936":"Remessa de material de embalagem recebido de terceiros",
  "5937":"Remessa de material de embalagem recebido de terceiros — zona franca",
  "5949":"Outra saída de mercadoria ou prestação de serviço não especificada",
  // ── 6xxx — Saídas / Prestações interestaduais ─────────────────────────────
  "6101":"Venda de produto industrializado (interestadual)",
  "6102":"Venda de mercadoria adquirida p/ comercialização (interestadual)",
  "6104":"Venda de mercadoria utilizada no processo produtivo (interestadual)",
  "6107":"Venda de produto industrializado — ativo imobilizado (interestadual)",
  "6108":"Venda de mercadoria adquirida — ST (interestadual)",
  "6109":"Venda de produto industrializado — zona franca (interestadual)",
  "6110":"Venda de produto industrializado — zona franca — transferência de crédito (interestadual)",
  "6115":"Venda de insumo importado com suspensão do IPI (interestadual)",
  "6116":"Venda de produto industrializado originada de encomenda (interestadual)",
  "6117":"Venda de mercadoria adquirida originada de encomenda (interestadual)",
  "6118":"Venda de produto de ativo imobilizado (interestadual)",
  "6120":"Venda de produto industrializado p/ zona franca (interestadual)",
  "6122":"Venda de produto — zona franca — recebido de terceiro (interestadual)",
  "6123":"Venda de produto — zona franca — equiparado ao exportador (interestadual)",
  "6124":"Industrialização efetuada p/ outras empresas (interestadual)",
  "6125":"Industrialização efetuada p/ outras empresas — insumos de terceiros (interestadual)",
  "6151":"Transferência p/ industrialização (interestadual)",
  "6152":"Transferência p/ comercialização (interestadual)",
  "6153":"Transferência de energia elétrica (interestadual)",
  "6154":"Transferência p/ utilização na prestação de serviço (interestadual)",
  "6201":"Devolução de compra p/ industrialização (interestadual)",
  "6202":"Devolução de compra p/ comercialização (interestadual)",
  "6205":"Anulação de prestação de serviço de comunicação (interestadual)",
  "6206":"Anulação de prestação de serviço de transporte (interestadual)",
  "6207":"Anulação de venda de energia elétrica (interestadual)",
  "6208":"Devolução de compra — simples nacional (interestadual)",
  "6209":"Devolução de compra — ST (interestadual)",
  "6251":"Venda de energia elétrica p/ distribuição (interestadual)",
  "6252":"Venda de energia elétrica p/ estab. industrial (interestadual)",
  "6253":"Venda de energia elétrica p/ estab. comercial (interestadual)",
  "6258":"Venda de energia elétrica p/ consumidor final (interestadual)",
  "6301":"Prest. de serviço de comunicação p/ execução de serviço da mesma natureza (interestadual)",
  "6302":"Prest. de serviço de comunicação p/ estab. industrial (interestadual)",
  "6303":"Prest. de serviço de comunicação p/ estab. comercial (interestadual)",
  "6351":"Prest. de serviço de transporte p/ execução de serviço da mesma natureza (interestadual)",
  "6352":"Prest. de serviço de transporte p/ estab. industrial (interestadual)",
  "6353":"Prest. de serviço de transporte p/ estab. comercial (interestadual)",
  "6354":"Prest. de serviço de transporte p/ estab. prestador de serv. de comunicação (interestadual)",
  "6356":"Prest. de serviço de transporte p/ estab. prestador de serv. de transporte (interestadual)",
  "6357":"Prest. de serviço de transporte p/ não contribuinte (interestadual)",
  "6401":"Venda de combustível — ST (interestadual)",
  "6402":"Venda de combustível — sem ST (interestadual)",
  "6403":"Venda de combustível — diferimento (interestadual)",
  "6404":"Venda de combustível — contribuinte substituto (interestadual)",
  "6405":"Venda de combustível — contribuinte substituído (interestadual)",
  "6501":"Remessa p/ industrialização por encomenda (interestadual)",
  "6502":"Retorno de mercadoria utilizada na industrialização por encomenda (interestadual)",
  "6551":"Venda de bem do ativo imobilizado (interestadual)",
  "6552":"Transferência de bem do ativo imobilizado (interestadual)",
  "6553":"Devolução de compra de bem do ativo imobilizado (interestadual)",
  "6556":"Remessa de bem do ativo imobilizado p/ uso fora do estab. (interestadual)",
  "6557":"Transferência de material de uso e consumo (interestadual)",
  "6603":"Ressarcimento de ICMS — ST",
  "6651":"Venda de combustível — ST — produtor rural (interestadual)",
  "6652":"Venda de combustível — ST — indústria e comércio (interestadual)",
  "6901":"Remessa p/ industrialização por encomenda (interestadual)",
  "6902":"Retorno de mercadoria — industrialização por encomenda — sem aplicação (interestadual)",
  "6903":"Retorno de mercadoria — industrialização por encomenda — sem aplicação (interestadual)",
  "6904":"Remessa p/ venda fora do estab. (interestadual)",
  "6905":"Remessa p/ depósito fechado ou armazém-geral (interestadual)",
  "6906":"Retorno de mercadoria depositada em armazém-geral (interestadual)",
  "6907":"Retorno de mercadoria mandada depositar em armazém-geral (interestadual)",
  "6908":"Remessa de bem por conta de contrato de comodato (interestadual)",
  "6910":"Remessa de produto p/ empréstimo entre estabs. (interestadual)",
  "6911":"Retorno de produto recebido em empréstimo (interestadual)",
  "6912":"Remessa de mercadoria ou bem p/ demonstração (interestadual)",
  "6913":"Retorno de mercadoria ou bem recebido p/ demonstração (interestadual)",
  "6914":"Remessa de mercadoria ou bem p/ exposição ou feira (interestadual)",
  "6915":"Remessa de mercadoria ou bem p/ consumidor final — saída eventual (interestadual)",
  "6916":"Remessa em bonificação, doação ou brinde (interestadual)",
  "6917":"Remessa de amostras grátis (interestadual)",
  "6918":"Remessa de produto p/ conserto (interestadual)",
  "6919":"Retorno de produto recebido p/ conserto (interestadual)",
  "6920":"Remessa de vasilhame ou sacaria (interestadual)",
  "6921":"Devolução de vasilhame ou sacaria (interestadual)",
  "6922":"Lançamento — simples faturamento — sem trânsito da mercadoria (interestadual)",
  "6923":"Remessa p/ industrialização — sem trânsito pela empresa (interestadual)",
  "6949":"Outra saída de mercadoria ou prestação de serviço não especificada (interestadual)",
  // ── 7xxx — Exportações ────────────────────────────────────────────────────
  "7101":"Venda de produto industrializado — exportação",
  "7102":"Venda de mercadoria adquirida p/ comercialização — exportação",
  "7105":"Venda de produto industrializado p/ encomendante — exportação",
  "7127":"Venda de produto industrializado — drawback — exportação",
  "7129":"Venda de produto industrializado — admissão temporária — exportação",
  "7201":"Devolução de compra — exportação",
  "7202":"Devolução de compra p/ comercialização — exportação",
  "7205":"Anulação de serviço de comunicação — exportação",
  "7206":"Anulação de serviço de transporte — exportação",
  "7207":"Anulação de venda de energia elétrica — exportação",
  "7210":"Devolução de compra de energia elétrica — exportação",
  "7211":"Venda de energia elétrica p/ consumidor final — exportação",
  "7251":"Venda de bem do ativo imobilizado — exportação",
  "7301":"Prest. de serviço de comunicação p/ execução de serviço da mesma natureza — exportação",
  "7358":"Prest. de serviço de transporte — exportação",
  "7501":"Exportação de mercadoria recebida com fim específico de exportação",
  "7551":"Venda de bem do ativo imobilizado — exportação",
  "7553":"Devolução de compra de bem do ativo imobilizado — exportação",
  "7556":"Remessa de material de uso e consumo — exportação",
  "7651":"Venda de combustível — exportação",
  "7930":"Lançamento efetuado a título de baixa de estoque — exportação",
  "7949":"Outra saída de mercadoria ou prestação de serviço não especificada — exportação",
};
function descCFOP(cfop:string):string { return DESC_CFOP[cfop]||`CFOP ${cfop}`; }

function famCFOP(cfop: string): "revenda"|"industrializacao"|"uso_consumo"|"imobilizado"|"outro" {
  const f=ncfop(cfop).slice(2);
  if (["55","56"].includes(f)) return "uso_consumo";
  if (["51"].includes(f)) return "imobilizado";
  if (["01"].includes(f)) return "industrializacao";
  if (["02"].includes(f)) return "revenda";
  return "outro";
}
const cfopUC=(c:string)=>famCFOP(c)==="uso_consumo";
const cfopImob=(c:string)=>famCFOP(c)==="imobilizado";
const cfopComb=(c:string)=>["53","54","56","59","60","61","62","63","64","65","66","67"].includes(ncfop(c).slice(2));
const cfopSaida=(c:string)=>{ const p=ncfop(c)[0]; return p==="5"||p==="6"||p==="7"; };

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE PRODUTO
// ══════════════════════════════════════════════════════════════════════════════

function analisarProduto(desc: string, perfil: PerfilEmpresa, ncm: string): AnaliseSugestao {
  const t=desc.toLowerCase();
  const nc=ncm2(ncm,NCM_COMB); if(nc) return {tipo:"combustivel",motivo:`NCM compatível com combustível (prefixo ${nc})`,confianca:"alta"};
  const nu=ncm2(ncm,NCM_UC);
  if(nu){
    // Supermercados podem revender alimentos, bebidas, higiene E artigos domésticos (louças, copos, talheres, têxteis)
    // Restaurantes compram artigos de mesa como uso e consumo — não entram na lista de bloqueio
    const bl=(perfil==="supermercado"&&["1006","0713","1701","1507","1511","1512","1517","2201","2202","0901","1905","2106","3401","3402","4818","3303","3304","3305","3306","3307","6301","6302","6304","7013","7323","8211","8215","6911","6912","3922","3924"].includes(nu))||(perfil==="restaurante"&&["1006","0713","1701","1507","1511","1512","1517","2201","2202","2203","2204","2205","2206","2208","0901","1905","2101","2106"].includes(nu));
    if(!bl) return {tipo:"uso_consumo",motivo:`NCM compatível com uso e consumo (prefixo ${nu})`,confianca:"alta"};
  }
  const ni=ncm2(ncm,NCM_IMOB); if(ni) return {tipo:"imobilizado",motivo:`NCM compatível com máquina/equipamento (prefixo ${ni})`,confianca:"alta"};
  const pc=["gasolina","diesel","etanol","alcool","álcool","gnv","gás","oleo diesel","óleo diesel","combustivel","combustível","lubrificante"];
  const fcc=pc.find(p=>t.includes(p)); if(fcc) return {tipo:"combustivel",motivo:`descrição contém "${fcc}"`,confianca:"media"};
  const pi=["máquina","maquina","equipamento","compressor","freezer","geladeira","balança","balanca","empilhadeira","motor","forno","coifa","exaustor","notebook","computador","impressora","servidor","monitor","scanner","leitor","betoneira","andaime","furadeira","parafusadeira","serra","cortadora","misturador","microondas","liquidificador","batedeira","fogão","fogao","ar condicionado","inversor","nobreak","estabilizador"];
  const fi=pi.find(p=>t.includes(p)); if(fi) return {tipo:"imobilizado",motivo:`descrição contém "${fi}"`,confianca:"media"};
  const pu=["arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua","refrigerante","suco","cerveja","vinho","whisky","vodka","gin","leite","biscoito","guardanapo","detergente","sabão","sabao","desinfetante","papel higiênico","papel higienico","copo descartável","copo descartavel","papel sulfite","caneta","lapis","lápis","borracha","grampeador","clips","vassoura","rodo","saco de lixo","água sanitária","agua sanitaria","produto de limpeza","material de limpeza","medicamento","remedio","remédio","shampoo","condicionador","sabonete","creme dental","pasta de dente","escova de dente","absorvente","fralda","papel toalha","alcool em gel","álcool em gel","protetor solar","hidratante","desodorante","algodão","algodao","curativo","gaze","esparadrapo",
    // Cama, mesa e banho
    "toalha","lençol","fronha","colcha","cobertor","edredom","travesseiro","guardanapo de tecido",
    // Louças, copos e talheres
    "prato","xícara","xcara","caneca","talher","talheres","garfo","colher de","concha de servir","espátula de cozinha",
    // Utensílios domésticos
    "utensílio","utensilio","panela","frigideira","assadeira","forma de","bacia","balde","escorredor",
  ];
  const fu=pu.find(p=>t.includes(p)); if(!fu) return {tipo:null,motivo:"",confianca:null};
  // Supermercados podem revender artigos de cama/mesa/banho, louças e talheres → excluir UC
  const eS=["arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua","refrigerante","suco","cerveja","vinho","leite","biscoito","detergente","sabão","sabao","desinfetante","papel higienico","papel higiênico","shampoo","condicionador","sabonete","creme dental","pasta de dente","desodorante","absorvente","fralda","papel toalha","protetor solar","hidratante","toalha","lençol","fronha","colcha","cobertor","prato","xícara","xcara","caneca","talher","talheres","garfo","colher de","panela","frigideira"];
  if(perfil==="supermercado"&&eS.some(p=>t.includes(p))) return {tipo:null,motivo:"",confianca:null};
  // Restaurantes usam prato/copo/talheres como UC — não excluir; apenas alimentos e bebidas para venda
  const eR=["arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua","refrigerante","suco","cerveja","vinho","whisky","vodka","gin","leite","guardanapo","embalagem","descartável","descartavel"];
  if(perfil==="restaurante"&&eR.some(p=>t.includes(p))) return {tipo:null,motivo:"",confianca:null};
  return {tipo:"uso_consumo",motivo:`descrição contém "${fu}"`,confianca:"media"};
}

// ══════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO — ALERTAS INTELIGENTES
// ══════════════════════════════════════════════════════════════════════════════

function temCreditoPossivel(cst: string, base: number, valor: number): boolean {
  return ["00","10","20","51","70","90"].includes(cst.replace(/\D/g,"")) && (base>0||valor>0);
}

function validarItem(item: Omit<LinhaEntrada,"status"|"avisos">, ehIndustrial=false): {status:StatusValidacao;avisos:string[]} {
  const alertas: string[] = [];
  const avisos_info: string[] = []; // informativos sem gerar ALERTA
  const cfop=ncfop(item.cfop), fam=famCFOP(cfop), sug=item.sugestao.tipo;
  const cred=temCreditoPossivel(item.cst_icms,item.base_icms,item.valor_icms);

  // ── Regras para itens com sugestão automática ────────────────────────────
  // UC ↔ Imobilizado: linha tênue — CFOP de um aceita o outro SEM alerta
  // Regra: só gera alerta se o CFOP é claramente incompatível com qualquer
  //        das naturezas possíveis, OU se há crédito indevido.

  if (sug==="combustivel") {
    const cfopOk = cfopComb(cfop) || cfopUC(cfop);
    if (!cfopOk) {
      alertas.push(`Possível combustível (${item.sugestao.motivo}). CFOP ${cfop} incompatível — verificar CFOP de combustível/lubrificante.`);
    } else {
      avisos_info.push(`Possível combustível: ${item.sugestao.motivo}.`);
    }
    if (cred) alertas.push("Combustível com crédito de ICMS. Verificar se crédito é permitido para este combustível e atividade.");
  }

  if (sug==="imobilizado") {
    const cfopOk = cfopImob(cfop) || cfopUC(cfop); // UC aceito (linha tênue)
    if (!cfopOk) {
      alertas.push(`Possível imobilizado (${item.sugestao.motivo}). CFOP ${cfop} incompatível — verificar 1551/2551 (imobilizado).`);
    } else {
      avisos_info.push(`Possível imobilizado: ${item.sugestao.motivo}.`);
    }
    // Crédito de ICMS em imobilizado: só alerta se houver crédito efetivo
    if (cred) alertas.push("Imobilizado com crédito de ICMS. Verificar aproveitamento via CIAP (1/48 por mês).");
  }

  if (sug==="uso_consumo") {
    const cfopOk = cfopUC(cfop) || cfopImob(cfop); // imob aceito (linha tênue)
    if (!cfopOk) {
      alertas.push(`Possível uso e consumo (${item.sugestao.motivo}). CFOP ${cfop} incompatível — verificar 1556/2556 (UC).`);
    } else {
      avisos_info.push(`Possível uso e consumo: ${item.sugestao.motivo}.`);
    }
    // Crédito de ICMS em UC: alerta pois a regra geral veda (LC 87/96)
    if (cred) alertas.push("UC com crédito de ICMS. Regra geral não permite aproveitamento (LC 87/96). Verificar exceção aplicável.");
  }

  // ── Sem sugestão automática: verifica o CFOP diretamente ────────────────
  if (!sug) {
    if (fam==="uso_consumo" && cred) alertas.push(`CFOP ${cfop} é de uso e consumo com crédito de ICMS. Verificar aproveitamento.`);
    if (fam==="imobilizado" && cred) alertas.push(`CFOP ${cfop} é de imobilizado com crédito de ICMS. Verificar via CIAP.`);
    if (cfopComb(cfop) && cred)      alertas.push(`CFOP ${cfop} é de combustível com crédito de ICMS. Verificar se crédito é permitido.`);
  }

  // ── CFOP de industrialização em empresa não-industrial ───────────────────
  if (!ehIndustrial && fam==="industrializacao") {
    alertas.push(`CFOP ${cfop} é de industrialização, mas a empresa não é industrial (IND_ATIV≠0 no SPED). Verificar se o lançamento está correto.`);
  }

  // Se há só informativos e nenhum alerta real → OK com aviso informativo
  if (alertas.length > 0) return {status:"ALERTA", avisos:[...alertas, ...avisos_info]};
  if (avisos_info.length > 0) return {status:"OK", avisos:avisos_info};
  return {status:"OK", avisos:["Sem inconsistências."]};
}

// Mapeamento explícito: CFOP de saída → opções de CFOP de entrada por destinação
const MAPA_CFOP: Record<string, { revenda: string; insumo: string; imobilizado: string; uso_consumo: string }> = {
  "5101": { revenda: "1102", insumo: "1101", imobilizado: "1551", uso_consumo: "1556" },
  "5102": { revenda: "1102", insumo: "1101", imobilizado: "1551", uso_consumo: "1556" },
  "5401": { revenda: "1403", insumo: "1407", imobilizado: "1406", uso_consumo: "1407" },
  "5403": { revenda: "1403", insumo: "1407", imobilizado: "1406", uso_consumo: "1407" },
  "6101": { revenda: "2102", insumo: "2101", imobilizado: "2551", uso_consumo: "2556" },
  "6102": { revenda: "2102", insumo: "2101", imobilizado: "2551", uso_consumo: "2556" },
  "6401": { revenda: "2403", insumo: "2407", imobilizado: "2406", uso_consumo: "2407" },
  "6403": { revenda: "2403", insumo: "2407", imobilizado: "2406", uso_consumo: "2407" },
  "5115": { revenda: "1102", insumo: "1101", imobilizado: "1551", uso_consumo: "1556" },
  "6115": { revenda: "2102", insumo: "2101", imobilizado: "2551", uso_consumo: "2556" },
  "5124": { revenda: "1124", insumo: "1124", imobilizado: "1551", uso_consumo: "1556" },
  "6124": { revenda: "2124", insumo: "2124", imobilizado: "2551", uso_consumo: "2556" },
  "5922": { revenda: "1949", insumo: "1949", imobilizado: "1551", uso_consumo: "1556" },
  "6916": { revenda: "2916", insumo: "2916", imobilizado: "2551", uso_consumo: "2556" },
  "5910": { revenda: "1910", insumo: "1910", imobilizado: "1551", uso_consumo: "1556" },
  "6910": { revenda: "2910", insumo: "2910", imobilizado: "2551", uso_consumo: "2556" },
  "5949": { revenda: "1949", insumo: "1949", imobilizado: "1551", uso_consumo: "1556" },
  "6949": { revenda: "2949", insumo: "2949", imobilizado: "2551", uso_consumo: "2556" },
};

// Sugere o CFOP de entrada principal com base no mapeamento e na natureza do produto
function sugerirCfopEntrada(cfopFornecedor: string, natureza: AnaliseSugestao["tipo"], ehIndustrial: boolean): string {
  const base = cfopFornecedor.replace(/\D/g, "");
  const mapa = MAPA_CFOP[base];
  const p = base.startsWith("6") ? "2" : "1";
  if (mapa) {
    switch (natureza) {
      case "uso_consumo": return mapa.uso_consumo;
      case "imobilizado": return mapa.imobilizado;
      case "combustivel": return `${p}653`;
      default:            return ehIndustrial ? mapa.insumo : mapa.revenda;
    }
  }
  // Regra geral: troca o primeiro dígito (5→1, 6→2, 7→3)
  switch (natureza) {
    case "uso_consumo": return `${p}556`;
    case "imobilizado": return `${p}551`;
    case "combustivel": return `${p}653`;
    default: {
      const fallback = p + base.slice(1);
      // Retorna "" se o CFOP gerado não existe na tabela oficial — sinaliza necessidade de seleção manual
      return fallback in DESC_CFOP ? fallback : "";
    }
  }
}

// Retorna todas as opções possíveis de CFOP de entrada para exibir no dropdown
function getOpcoesEntrada(cfopFornecedor: string, natureza: AnaliseSugestao["tipo"], ehIndustrial: boolean): { cfop: string; tipo: string; descricao: string }[] {
  const base = cfopFornecedor.replace(/\D/g, "");
  const mapa = MAPA_CFOP[base];
  const p = base.startsWith("6") ? "2" : "1";
  const visto = new Set<string>();
  const opcoes: { cfop: string; tipo: string; descricao: string }[] = [];
  const add = (cfop: string, tipo: string) => {
    if (!visto.has(cfop)) { visto.add(cfop); opcoes.push({ cfop, tipo, descricao: descCFOP(cfop) }); }
  };
  if (mapa) {
    if (natureza === "uso_consumo") {
      add(mapa.uso_consumo, "Uso e Consumo"); add(mapa.insumo, ehIndustrial ? "Insumo/Produção" : "Revenda");
      add(mapa.revenda, "Revenda"); add(mapa.imobilizado, "Imobilizado");
    } else if (natureza === "imobilizado") {
      add(mapa.imobilizado, "Imobilizado"); add(mapa.uso_consumo, "Uso e Consumo");
      add(mapa.insumo, ehIndustrial ? "Insumo/Produção" : "Revenda"); add(mapa.revenda, "Revenda");
    } else if (ehIndustrial) {
      add(mapa.insumo, "Insumo/Produção"); add(mapa.revenda, "Revenda");
      add(mapa.uso_consumo, "Uso e Consumo"); add(mapa.imobilizado, "Imobilizado");
    } else {
      add(mapa.revenda, "Revenda"); add(mapa.insumo, "Insumo");
      add(mapa.uso_consumo, "Uso e Consumo"); add(mapa.imobilizado, "Imobilizado");
    }
    if (natureza === "combustivel") add(`${p}653`, "Combustível");
  } else {
    // Só inclui o fallback genérico se o CFOP resultante existir na tabela oficial
    const fallback = p + base.slice(1);
    if (fallback in DESC_CFOP) add(fallback, "Geral");
    if (natureza === "combustivel") add(`${p}653`, "Combustível");
    else { add(`${p}556`, "Uso e Consumo"); add(`${p}551`, "Imobilizado"); }
    // Sempre garante opções comuns para o usuário escolher
    add(`${p}102`, "Compra p/ comercialização");
    add(`${p}101`, "Compra p/ industrialização");
    add(`${p}949`, "Outras entradas");
  }
  return opcoes;
}

function sugerirClass(l: Omit<LinhaEntrada,"status"|"avisos">, ehIndustrial=false): ClassificacaoManual {
  if (l.sugestao.tipo==="uso_consumo") return "uso_consumo";
  if (l.sugestao.tipo==="imobilizado") return "imobilizado";
  if (l.sugestao.tipo==="combustivel") return "combustivel";
  const f=famCFOP(l.cfop);
  if (f==="industrializacao") return ehIndustrial?"insumo":"revenda";
  if (f==="revenda") return "revenda";
  if (f==="uso_consumo") return "uso_consumo";
  if (f==="imobilizado") return "imobilizado";
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSER SPED
// ══════════════════════════════════════════════════════════════════════════════

function parseSped(txt: string): {itens:LinhaEntrada[];empresa:DadosEmpresa|null} {
  const lines=txt.split(/\r?\n/).filter(Boolean);
  const cad=new Map<string,Item0200>(), part=new Map<string,Participante0150>();
  let emp: DadosEmpresa|null=null;
  let ehInd = false; // será definido quando 0000 for lido

  type RC190={cfop:string;cst_icms:string;aliquota_icms:number;valor_contabil:number;base_icms:number;valor_icms:number};
  type NA={
    numero_nota:string; fornecedor:string; data:string; temC170:boolean; c190:RC190[];
    // Totais do C100 para rateio proporcional entre itens
    vl_nf:number;    // VL_DOC    — valor total da nota fiscal (inclui IPI pago)
    vl_merc:number;  // VL_MERC   — valor das mercadorias (soma dos VL_ITEM antes do IPI/frete)
    vl_desc:number;  // VL_DESC   — desconto total da nota
    vl_abat:number;  // VL_ABAT_NT— abatimento
    vl_frete:number; // VL_FRT    — frete total
    vl_seg:number;   // VL_SEG    — seguro
    vl_desp:number;  // VL_OUT_DA — outras despesas acessórias
    vl_ipi:number;   // VL_IPI    — IPI destacado no campo próprio (0 quando IPI não aproveitável)
    itensC170: Array<{id:string; vl_item:number; vl_desc_item:number; vl_ipi_item:number}>;
  };
  let na: NA|null=null;
  const itens: LinhaEntrada[]=[];

  /**
   * Rateio de frete, despesas, desconto e IPI implícito entre os itens C170.
   *
   * Problema tratado — IPI não aproveitável como crédito:
   *   Quando o IPI não pode ser creditado (UC, imobilizado, etc.), o contribuinte
   *   lança VL_IPI=0 no C170 e no campo VL_IPI do C100, mas o VL_DOC inclui o IPI
   *   que foi efetivamente pago. Resultado: VL_DOC > VL_MERC + outros encargos.
   *   A diferença é exatamente o IPI pago mas não creditado.
   *
   * IPI implícito = VL_DOC - VL_MERC - VL_FRT - VL_SEG - VL_OUT_DA
   *                        + VL_DESC + VL_ABAT_NT - VL_IPI_explicito
   *
   * Fórmula final por item:
   *   valor_contabil = VL_ITEM
   *                  + frete_rateado
   *                  + seguro_rateado
   *                  + despesas_rateadas
   *                  + IPI_item_C170          (IPI lançado no item, pode ser 0)
   *                  + IPI_implicito_rateado   (IPI pago sem crédito, rateado por VL_ITEM)
   *                  - desconto_item           (VL_DESC do C170)
   *                  - desconto_nota_extra_rateado (excedente do VL_DESC C100)
   */
  function ratearItensNota(): void {
    if (!na || !na.itensC170.length) return;

    // Base de rateio: soma dos VL_ITEM (mercadoria bruta de cada produto)
    const totalVlItem = na.itensC170.reduce((s, i) => s + i.vl_item, 0);
    if (totalVlItem <= 0) return;

    // ── IPI implícito ──────────────────────────────────────────────────────────
    // VL_MERC = soma dos VL_ITEM menos descontos por item.
    // IPI implícito = diferença entre o VL_DOC e tudo que já é explicado pelos
    // outros campos. Quando positivo, há IPI pago que não foi creditado.
    const ipiImplicito = Math.max(0, Math.round((
      na.vl_nf
      - na.vl_merc   // mercadoria (= soma VL_ITEM dos C170 já com desconto por item)
      - na.vl_frete
      - na.vl_seg
      - na.vl_desp
      + na.vl_desc   // desconto reduz o valor total (sinal positivo aqui pois foi subtraído do total)
      + na.vl_abat
      - na.vl_ipi    // IPI já explicado no campo próprio (geralmente 0 neste cenário)
      - na.itensC170.reduce((s, i) => s + i.vl_ipi_item, 0) // IPI lançado nos itens
    ) * 100) / 100);

    // ── Desconto extra da nota (parte não coberta pelos descontos por item) ────
    const descPorItemTotal = na.itensC170.reduce((s, i) => s + i.vl_desc_item, 0);
    const descNotaExtra = Math.max(0, Math.round((na.vl_desc - descPorItemTotal) * 100) / 100);

    const freteTotal = na.vl_frete;
    const segTotal   = na.vl_seg;
    const despTotal  = na.vl_desp;

    for (const regI of na.itensC170) {
      const idx = itens.findIndex(i => i.id === regI.id);
      if (idx < 0) continue;
      const item = itens[idx];

      const prop = regI.vl_item / totalVlItem;

      const freteRat     = Math.round(freteTotal    * prop * 100) / 100;
      const segRat       = Math.round(segTotal      * prop * 100) / 100;
      const despRat      = Math.round(despTotal      * prop * 100) / 100;
      const descExtra    = Math.round(descNotaExtra  * prop * 100) / 100;
      const ipiImplRat   = Math.round(ipiImplicito   * prop * 100) / 100;

      // Desconto total do item = desconto próprio (C170 p[8]) + parcela extra da nota
      const descTotal = (item.valor_desconto || 0) + descExtra;

      // IPI total do item = IPI do C170 + IPI implícito rateado
      const ipiTotal = (item.valor_ipi_item || 0) + ipiImplRat;

      itens[idx] = {
        ...item,
        valor_frete:      freteRat + segRat, // seguro agrupado no frete por simplicidade
        valor_despesas:   despRat,
        valor_desconto:   descTotal,
        valor_ipi_item:   ipiTotal,           // IPI real = lançado + implícito
        valor_total_nota: na!.vl_nf,
        // valor_contabil final = produto + encargos + IPI real - descontos
        valor_contabil: Math.round(
          (item.valor_produto + freteRat + segRat + despRat + ipiTotal - descTotal) * 100
        ) / 100,
      };
    }
  }

  function flush(): void {
    // Aplica rateio nos itens C170 da nota que está sendo fechada
    if (na && na.itensC170.length > 0) ratearItensNota();

    // Se a nota não tinha C170, usa os registros C190 (resumo por CFOP)
    if (!na || na.temC170 || !na.c190.length) return;
    for (const r of na.c190) {
      const b = {
        id:gid(), numero_nota:na.numero_nota, fornecedor:na.fornecedor, data:na.data,
        codigo_produto:"", cst_icms:r.cst_icms, ncm:"",
        descricao:`CFOP ${r.cfop} (resumo por CFOP – sem itens detalhados)`,
        cfop:r.cfop,
        valor_produto:r.valor_contabil, valor_desconto:0, valor_frete:0,
        valor_despesas:0, valor_ipi_item:0, valor_total_nota:na.vl_nf,
        valor_contabil:r.valor_contabil,
        base_icms:r.base_icms, aliquota_icms:r.aliquota_icms, valor_icms:r.valor_icms,
        sugestao:{tipo:null,motivo:"",confianca:null} as AnaliseSugestao,
        classificacao:null as ClassificacaoManual, fonte:"c190" as const,
      };
      const res=validarItem(b as Omit<LinhaEntrada,"status"|"avisos">,ehInd); itens.push({...b,...res});
    }
  }

  for (const l of lines) {
    const p=l.split("|"), r=p[1]; if(!r) continue;

    if (r==="0000") {
      ehInd = fc(p,15)==="0";
      emp={nome:fc(p,6),cnpj:fc(p,7),ie:fc(p,10),uf:fc(p,9),periodoInicial:fdata(fc(p,4)),periodoFinal:fdata(fc(p,5)),
        ehIndustrial:ehInd}; // IND_ATIV=0 → industrial/equiparado
      continue;
    }
    if (r==="0150") { const c=fc(p,2); if(c) part.set(c,{nome:fc(p,3)}); continue; }
    if (r==="0200") { const c=fc(p,2); if(c) cad.set(c,{descricao:fc(p,3),ncm:fc(p,8)}); continue; }

    if (r==="C100") {
      flush(); // fecha a nota anterior antes de abrir a nova
      const io=fc(p,2), cp=fc(p,4);
      const nd=fc(p,8)||fc(p,7);
      const dd=fdata(fc(p,10)||fc(p,11));
      // Só processa notas de ENTRADA (IND_OPER=0)
      na = io==="0" ? {
        numero_nota : nd||"Sem número",
        fornecedor  : part.get(cp)?.nome||cp||"Fornecedor não localizado",
        data        : dd,
        temC170     : false,
        c190        : [],
        // ── Campos do C100 para rateio ──────────────────────────────────
        // Layout: |C100|IND_OPER(2)|IND_EMIT(3)|COD_PART(4)|COD_MOD(5)|COD_SIT(6)|
        //         SER(7)|NUM_DOC(8)|CHV_NFE(9)|DT_DOC(10)|DT_E_S(11)|VL_DOC(12)|
        //         IND_PGTO(13)|VL_DESC(14)|VL_ABAT_NT(15)|VL_MERC(16)|IND_FRT(17)|
        //         VL_FRT(18)|VL_SEG(19)|VL_OUT_DA(20)|VL_BC_ICMS(21)|VL_ICMS(22)|
        //         VL_BC_ICMS_ST(23)|VL_ICMS_ST(24)|VL_IPI(25)|VL_PIS(26)|VL_COFINS(27)
        vl_nf    : nnum(p[12]), // VL_DOC
        vl_merc  : nnum(p[16]), // VL_MERC
        vl_desc  : nnum(p[14]), // VL_DESC
        vl_abat  : nnum(p[15]), // VL_ABAT_NT
        vl_frete : nnum(p[18]), // VL_FRT
        vl_seg   : nnum(p[19]), // VL_SEG
        vl_desp  : nnum(p[20]), // VL_OUT_DA
        vl_ipi   : nnum(p[25]), // VL_IPI explícito (0 quando IPI não aproveitável como crédito)
        itensC170: [],
      } : null;
      continue;
    }

    if (r==="C170" && na) {
      na.temC170 = true;
      // Layout: |C170|NUM_ITEM(2)|COD_ITEM(3)|DESCR_COMPL(4)|QTD(5)|UNID(6)|
      //         VL_ITEM(7)|VL_DESC(8)|IND_MOV(9)|CST_ICMS(10)|CFOP(11)|COD_NAT(12)|
      //         VL_BC_ICMS(13)|ALIQ_ICMS(14)|VL_ICMS(15)|VL_BC_ICMS_ST(16)|ALIQ_ST(17)|
      //         VL_ICMS_ST(18)|IND_APUR(19)|CST_IPI(20)|COD_ENQ(21)|VL_BC_IPI(22)|
      //         ALIQ_IPI(23)|VL_IPI(24)|CST_PIS(25)|...
      const codItem   = fc(p,3);
      const descComp  = fc(p,4); // DESCR_COMPL (complemento de descrição)
      const cstIcms   = fc(p,10);
      const cfop      = ncfop(p[11]);
      const i0        = cad.get(codItem);

      const vlItem    = nnum(p[7]);  // VL_ITEM   — valor bruto do produto
      const vlDescIt  = nnum(p[8]);  // VL_DESC   — desconto do item
      const vlIpiIt   = nnum(p[24]); // VL_IPI    — IPI do item
      const vBcIcms   = nnum(p[13]);
      const aliqIcms  = nnum(p[14]);
      const vlIcms    = nnum(p[15]);

      const itemId = gid();
      na.itensC170.push({id:itemId, vl_item:vlItem, vl_desc_item:vlDescIt, vl_ipi_item:vlIpiIt});

      // Descrição: usa o cadastro 0200 quando disponível
      const descFinal = i0?.descricao
        || (descComp||codItem||"Descrição não localizada");

      // valor_contabil provisório (será recalculado em ratearItensNota com frete/despesas)
      const vcProv = Math.round((vlItem - vlDescIt + vlIpiIt) * 100) / 100;

      const b: Omit<LinhaEntrada,"status"|"avisos"> = {
        id:itemId, numero_nota:na.numero_nota, fornecedor:na.fornecedor, data:na.data,
        codigo_produto:codItem, cst_icms:cstIcms, ncm:i0?.ncm||"",
        descricao:descFinal, cfop,
        valor_produto:vlItem, valor_desconto:vlDescIt, valor_frete:0,
        valor_despesas:0, valor_ipi_item:vlIpiIt, valor_total_nota:na.vl_nf,
        valor_contabil:vcProv,
        base_icms:vBcIcms, aliquota_icms:aliqIcms, valor_icms:vlIcms,
        sugestao:{tipo:null,motivo:"",confianca:null} as AnaliseSugestao,
        classificacao:null as ClassificacaoManual, fonte:"sped" as const,
      };
      const cl2=sugerirClass(b,ehInd), res=validarItem(b,ehInd);
      itens.push({...b,...res,classificacao:cl2});
      continue;
    }

    if (r==="C190" && na) {
      // C190: resumo por CFOP — só usado se não houver C170
      // Layout: |C190|CST_ICMS(2)|CFOP(3)|ALIQ_ICMS(4)|VL_OPR(5)|VL_BC_ICMS(6)|VL_ICMS(7)|...
      const cfop=ncfop(p[3]);
      if (cfop) na.c190.push({
        cfop, cst_icms:fc(p,2), aliquota_icms:nnum(p[4]),
        valor_contabil:nnum(p[5]), base_icms:nnum(p[6]), valor_icms:nnum(p[7]),
      });
    }
  }

  flush(); // processa a última nota
  return {itens, empresa:emp};
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSER XML NF-e — CORRIGIDO
// Usa getElementsByTagName com escopo no nó do det/imposto para evitar
// captura de valores de elementos filhos aninhados incorretos.
// ══════════════════════════════════════════════════════════════════════════════

function parseDataXml(s: string): string {
  if(!s) return "";
  try{const d=new Date(s);if(!isNaN(d.getTime()))return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;}catch{}
  return s.slice(0,10).split("-").reverse().join("/");
}

// Lê o primeiro elemento com localName=tag dentro de um nó, ignorando namespace
function gtxt(node: Element|null|undefined, tag: string): string {
  if (!node) return "";
  const els = node.getElementsByTagName(tag);
  if (els.length > 0) return els[0].textContent?.trim()||"";
  // fallback: tenta sem namespace
  const all = Array.from(node.getElementsByTagName("*"));
  const found = all.find(el => el.localName === tag);
  return found?.textContent?.trim()||"";
}

// Lê o nó filho imediato do grupo ICMS (ex: <ICMS00>, <ICMS10>, <ICMSSN500>, etc.)
function getIcmsNode(imposto: Element|null): Element|null {
  if (!imposto) return null;
  const icmsGrupo = imposto.getElementsByTagName("ICMS")[0];
  if (!icmsGrupo) return null;
  // O primeiro elemento filho é o grupo real (ICMS00, ICMS10, ICMS20, etc.)
  return icmsGrupo.firstElementChild as Element|null;
}

// Lê o nó filho do grupo PIS/COFINS
function getPisCofinsNode(imposto: Element|null, grupo: "PIS"|"COFINS"): Element|null {
  if (!imposto) return null;
  const grp = imposto.getElementsByTagName(grupo)[0];
  if (!grp) return null;
  return grp.firstElementChild as Element|null;
}

// Detecta se um XML é um evento de cancelamento e retorna a chave NF-e cancelada
// Eventos de cancelamento: tpEvento="110111" (cancNFe) ou arquivo cancNFe
function detectarCancelamento(txt: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    if (doc.querySelector("parsererror")) return null;

    // Formato 1: procEventoNFe / eventoCancNFe
    const tpEvento = doc.getElementsByTagName("tpEvento")[0]?.textContent?.trim();
    if (tpEvento === "110111") {
      // chave está em chNFe dentro do evento
      const chNFe = doc.getElementsByTagName("chNFe")[0]?.textContent?.trim()
        || doc.getElementsByTagName("chave")[0]?.textContent?.trim();
      return chNFe || null;
    }

    // Formato 2: cancNFe direto (arquivo de cancelamento antigo)
    const cancNFe = doc.getElementsByTagName("cancNFe")[0];
    if (cancNFe) {
      const chNFe = gtxt(cancNFe, "chNFe") || gtxt(cancNFe, "chave");
      return chNFe || null;
    }

    // Formato 3: retCancNFe
    const retCanc = doc.getElementsByTagName("retCancNFe")[0];
    if (retCanc) {
      const chNFe = gtxt(retCanc, "chNFe");
      return chNFe || null;
    }

    return null;
  } catch {
    return null;
  }
}

// Extrai a chave NF-e do XML de NF-e (infNFe Id ou chNFe no protNFe)
function extrairChaveNFe(txt: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    // infNFe Id="NFe..." — a chave é o Id sem o prefixo "NFe"
    const infNFe = doc.getElementsByTagName("infNFe")[0];
    if (infNFe) {
      const id = infNFe.getAttribute("Id") || "";
      if (id.startsWith("NFe")) return id.slice(3);
      if (id.length === 44) return id;
    }
    // protNFe > chNFe
    const chNFe = doc.getElementsByTagName("chNFe")[0]?.textContent?.trim();
    if (chNFe && chNFe.length === 44) return chNFe;
    return null;
  } catch { return null; }
}

type XmlMetadata = {
  chave_nfe: string | null;
  numero_nf: string;
  data_emissao: string | null; // ISO date
  emitente_cnpj: string;
  emitente_nome: string;
  destinatario_cnpj: string;
  destinatario_nome: string;
  tipo_operacao: "entrada" | "saida" | null;
  valor_total: number;
  ref_nfe?: string; // chave da NF referenciada (NFref > refNFe) — devoluções e complementares
};

function extrairMetadataXml(txt: string): XmlMetadata | null {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    const ide = doc.getElementsByTagName("ide")[0];
    const emit = doc.getElementsByTagName("emit")[0];
    const dest = doc.getElementsByTagName("dest")[0];
    if (!ide) return null;

    const nNF = gtxt(ide, "nNF") || "";
    const dhEmi = gtxt(ide, "dhEmi") || gtxt(ide, "dEmi") || "";
    const tpNF = gtxt(ide, "tpNF");
    const totalNode = doc.getElementsByTagName("ICMSTot")[0] || null;
    const vNF = nnumXml(gtxt(totalNode, "vNF"));

    let dataEmissao: string | null = null;
    if (dhEmi.length >= 10) {
      const d = dhEmi.slice(0, 10).replace(/\//g, "-");
      dataEmissao = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    }

    const emitCnpj = (gtxt(emit, "CNPJ") || gtxt(emit, "CPF") || "").replace(/\D/g, "");
    const emitNome = gtxt(emit, "xNome") || "";
    const destCnpj = (gtxt(dest, "CNPJ") || gtxt(dest, "CPF") || "").replace(/\D/g, "");
    const destNome = gtxt(dest, "xNome") || "";

    const chave = extrairChaveNFe(txt);

    // Chave da NF referenciada (presente em devoluções e complementares)
    const nfRefEl = ide.getElementsByTagName("NFref")[0] ?? null;
    const refNFe = nfRefEl ? (gtxt(nfRefEl as Element, "refNFe") || undefined) : undefined;

    return {
      chave_nfe: chave,
      numero_nf: nNF,
      data_emissao: dataEmissao,
      emitente_cnpj: emitCnpj,
      emitente_nome: emitNome,
      destinatario_cnpj: destCnpj,
      destinatario_nome: destNome,
      tipo_operacao: tpNF === "0" ? "entrada" : tpNF === "1" ? "saida" : null,
      valor_total: vNF,
      ref_nfe: refNFe,
    };
  } catch { return null; }
}

type XmlResult={itensEntrada:LinhaEntrada[];itensSaida:LinhaSaida[]; chaveNFe?: string};

function parseXml(txt: string, perfil: PerfilEmpresa, forceEntrada = false): XmlResult {
  const entradas: LinhaEntrada[]=[], saidas: LinhaSaida[]=[];
  try{
    const doc=new DOMParser().parseFromString(txt,"text/xml");

    // Detecta erro de parse
    if (doc.querySelector("parsererror")) return {itensEntrada:[],itensSaida:[]};

    const ide=doc.getElementsByTagName("ide")[0];
    const emit=doc.getElementsByTagName("emit")[0];
    const dest=doc.getElementsByTagName("dest")[0];

    const nNF=gtxt(ide,"nNF")||"Sem número";
    const dhEmi=gtxt(ide,"dhEmi")||gtxt(ide,"dEmi")||"";
    const data=parseDataXml(dhEmi);
    const tpNF=gtxt(ide,"tpNF"); // "0"=entrada, "1"=saída
    const xEmit=gtxt(emit,"xNome")||"Emitente";
    const xDest=gtxt(dest,"xNome")||"Destinatário";

    // Totais da nota para rateio proporcional
    const totalNode=doc.getElementsByTagName("ICMSTot")[0]||null;
    const vNFtotal=nnumXml(gtxt(totalNode,"vNF"));         // valor total da nota
    const vDescNota=nnumXml(gtxt(totalNode,"vDesc"));      // desconto total da nota
    const vFreteNota=nnumXml(gtxt(totalNode,"vFrete"));    // frete total da nota
    const vOutroNota=nnumXml(gtxt(totalNode,"vOutro"));    // outras despesas total
    const vIPINota=nnumXml(gtxt(totalNode,"vIPI"));        // IPI total da nota
    // Soma dos vProd de todos os itens (para calcular proporção no rateio)
    let somaProd=0;
    const detListPre=doc.getElementsByTagName("det");
    for(let pi=0;pi<detListPre.length;pi++) somaProd+=nnumXml(gtxt(detListPre[pi].getElementsByTagName("prod")[0],"vProd"));

    // Pré-scan: desconto já coberto por itens com vDesc próprio vs. restante a distribuir.
    // Evita alocar o vDescNota total a itens que não têm desconto próprio quando
    // esse total já está 100% coberto pelos itens que têm vDesc individual.
    let somaDescItensNota=0, somaProdSemDescNota=0;
    for(let pi=0;pi<detListPre.length;pi++){
      const p2=detListPre[pi].getElementsByTagName("prod")[0];
      if(!p2) continue;
      const d=nnumXml(gtxt(p2,"vDesc"));
      somaDescItensNota+=d;
      if(d===0) somaProdSemDescNota+=nnumXml(gtxt(p2,"vProd"));
    }
    const vDescRestante=Math.max(0, vDescNota - somaDescItensNota);

    const detList=doc.getElementsByTagName("det");
    for(let di=0;di<detList.length;di++){
      const det=detList[di];
      const prod=det.getElementsByTagName("prod")[0];
      const imp=det.getElementsByTagName("imposto")[0];
      if(!prod) continue;

      const codProd=gtxt(prod,"cProd");
      const xProd=gtxt(prod,"xProd");
      const ncm=gtxt(prod,"NCM");
      const cfop=gtxt(prod,"CFOP").slice(0,4);
      const vProd=nnumXml(gtxt(prod,"vProd"));
      // Campos de composição do valor por item (quando emitidos na NF-e)
      const vDescItem=nnumXml(gtxt(prod,"vDesc"));    // desconto do item
      const vFreteItem=nnumXml(gtxt(prod,"vFrete"));  // frete do item
      const vOutroItem=nnumXml(gtxt(prod,"vOutro"));  // outras despesas do item
      const vIPIItem=nnumXml(gtxt(det.getElementsByTagName("IPI")[0]||null,"vIPI")); // IPI do item
      const cbenef=gtxt(prod,"cBenef");
      const cbenefDesc=cbenef?(CBENEF_GO[cbenef]||`Código ${cbenef} — consultar tabela CBenef da UF`):"";

      // ICMS — lê o nó filho do grupo ICMS (ICMS00, ICMS20, ICMSSN500, etc.)
      const icmsNode=getIcmsNode(imp||null);
      const cst=gtxt(icmsNode,"CST")||gtxt(icmsNode,"CSOSN");
      const vBC=nnumXml(gtxt(icmsNode,"vBC"));
      const pICMS=nnumXml(gtxt(icmsNode,"pICMS"));
      const vICMS=nnumXml(gtxt(icmsNode,"vICMS"));
      // ST: vBCST e vICMSST ficam no mesmo nó ICMS10/ICMS70/ICMS90
      const vBCST=nnumXml(gtxt(icmsNode,"vBCST"));
      const vST=nnumXml(gtxt(icmsNode,"vICMSST"));

      // IPI — o grupo IPI tem seu próprio elemento
      const ipiGrp=imp?.getElementsByTagName("IPI")[0]||null;
      const vIPI=nnumXml(gtxt(ipiGrp,"vIPI"));

      // PIS
      const pisNode=getPisCofinsNode(imp||null,"PIS");
      const cstPis=gtxt(pisNode,"CST");
      const vBCPis=nnumXml(gtxt(pisNode,"vBC"));
      const pPIS=nnumXml(gtxt(pisNode,"pPIS"));
      const vPIS=nnumXml(gtxt(pisNode,"vPIS")||gtxt(pisNode,"vPISAliq")||gtxt(pisNode,"vPISQtde"));

      // COFINS
      const cofNode=getPisCofinsNode(imp||null,"COFINS");
      const cstCof=gtxt(cofNode,"CST");
      const vBCCof=nnumXml(gtxt(cofNode,"vBC"));
      const pCOF=nnumXml(gtxt(cofNode,"pCOFINS"));
      const vCOF=nnumXml(gtxt(cofNode,"vCOFINS")||gtxt(cofNode,"vCOFINSAliq")||gtxt(cofNode,"vCOFINSQtde"));

      // IBS / CBS (Reforma Tributária)
      const ibsGrp=imp?.getElementsByTagName("IBS")[0]||null;
      const cbsGrp=imp?.getElementsByTagName("CBS")[0]||null;
      const ibsCbsGrp=imp?.getElementsByTagName("ibsCbs")[0]||null;
      const vIBS=nnumXml(gtxt(ibsGrp,"vIBS")||gtxt(ibsCbsGrp,"vIBS"));
      const vCBS=nnumXml(gtxt(cbsGrp,"vCBS")||gtxt(ibsCbsGrp,"vCBS"));

      // Determina se é saída — quando forceEntrada=true (importação de terceiros), tudo vira entrada
      const ehSaida=forceEntrada?false:(tpNF==="1"||cfopSaida(cfop));

      if(ehSaida){
        const alertas: string[]=[];
        if(vICMS>0&&vBC===0) alertas.push("ICMS destacado sem base de cálculo.");
        if(cst==="00"&&pICMS===0) alertas.push("CST 00 com alíquota zero — verificar.");
        if(cbenef&&cbenef!=="SEM CBENEF"&&!CBENEF_GO[cbenef]) alertas.push(`CBenef ${cbenef} não localizado na tabela GO — verificar se é de outro estado.`);
        if(cst==="90"&&!cbenef) alertas.push("CST 90 sem CBenef — verificar benefício fiscal aplicável.");
        // Rateio proporcional para itens de saída
        const propSaida = somaProd > 0 ? vProd / somaProd : 0;
        const frRatSaida = vFreteItem > 0 ? vFreteItem : Math.round(vFreteNota * propSaida * 100) / 100;
        const despRatSaida = vOutroItem > 0 ? vOutroItem : Math.round(vOutroNota * propSaida * 100) / 100;
        // Desconto: se o item tem vDesc próprio usa-o; senão distribui apenas o restante
        // não coberto pelos itens com desconto individual (algoritmo idêntico ao parseNfe.ts).
        const propSemDescSaida = somaProdSemDescNota > 0 ? vProd / somaProdSemDescNota : 0;
        const descRatSaida = vDescItem > 0 ? vDescItem : Math.round(vDescRestante * propSemDescSaida * 100) / 100;
        const ipiSaida = vIPIItem > 0 ? vIPIItem : vIPI; // usa o já lido do grupo IPI
        const vContabilSaida = vProd + frRatSaida + despRatSaida + ipiSaida - descRatSaida;

        saidas.push({
          id:gid(),numero_nota:nNF,destinatario:xDest,data,
          codigo_produto:codProd,descricao:xProd,ncm,cfop,
          cst_icms:cst,cst_pis:cstPis,cst_cofins:cstCof,
          valor_contabil:vContabilSaida,
          valor_produto:vProd, valor_desconto:descRatSaida, valor_frete:frRatSaida,
          valor_despesas:despRatSaida, valor_ipi_item:ipiSaida,
          valor_total_nota:vNFtotal,
          base_icms:vBC,aliquota_icms:pICMS,valor_icms:vICMS,
          base_st:vBCST,valor_st:vST,valor_ipi:vIPI,
          base_pis:vBCPis,aliquota_pis:pPIS,valor_pis:vPIS,
          base_cofins:vBCCof,aliquota_cofins:pCOF,valor_cofins:vCOF,
          valor_ibs:vIBS,valor_cbs:vCBS,
          cbenef,cbenef_descricao:cbenefDesc,
          alertas_saida:alertas,
          status:alertas.length?"ALERTA":"OK",
        });
      } else {
        // Rateio proporcional para itens de entrada
        const propEntr = somaProd > 0 ? vProd / somaProd : 0;
        const frRatEntr = vFreteItem > 0 ? vFreteItem : Math.round(vFreteNota * propEntr * 100) / 100;
        const despRatEntr = vOutroItem > 0 ? vOutroItem : Math.round(vOutroNota * propEntr * 100) / 100;
        const propSemDescEntr = somaProdSemDescNota > 0 ? vProd / somaProdSemDescNota : 0;
        const descRatEntr = vDescItem > 0 ? vDescItem : Math.round(vDescRestante * propSemDescEntr * 100) / 100;
        const ipiEntr = vIPIItem;
        const vContabilEntr = vProd + frRatEntr + despRatEntr + ipiEntr - descRatEntr;
        // forceEntrada=true (nota de terceiro): fornecedor sempre é o emitente
        const fornecedor=forceEntrada?xEmit:(tpNF==="0"?xEmit:xDest);
        const sugestao=analisarProduto(xProd,perfil,ncm);
        const b={id:gid(),numero_nota:nNF,fornecedor,data,codigo_produto:codProd,cst_icms:cst,ncm,descricao:xProd,cfop,
          valor_contabil:vContabilEntr,
          valor_produto:vProd, valor_desconto:descRatEntr, valor_frete:frRatEntr,
          valor_despesas:despRatEntr, valor_ipi_item:ipiEntr,
          valor_total_nota:vNFtotal,
          base_icms:vBC,aliquota_icms:pICMS,valor_icms:vICMS,
          sugestao,classificacao:null as ClassificacaoManual,fonte:"xml" as const};
        const bTyped=b as Omit<LinhaEntrada,"status"|"avisos">;
        const cl=sugerirClass(bTyped), res=validarItem(bTyped);
        entradas.push({...b,...res,classificacao:cl,classificacaoManual:false});
      }
    }
  }catch(e){console.error("Erro parseXml:",e);}
  // Tenta extrair a chave NF-e para cruzamento com cancelamentos
  const chaveNFe = extrairChaveNFe(txt) || undefined;
  return {itensEntrada:entradas,itensSaida:saidas,chaveNFe};
}

// ══════════════════════════════════════════════════════════════════════════════
// REGRAS DE NEGÓCIO — ENTRADAS
// ══════════════════════════════════════════════════════════════════════════════

function vinculoUC(linhas: LinhaEntrada[]): LinhaEntrada[] {
  const s=new Set(linhas.filter(l=>l.sugestao.tipo==="uso_consumo").map(l=>l.numero_nota));
  return linhas.map(l=>{
    if(!s.has(l.numero_nota)) return l;
    const av=[...l.avisos];
    if(l.sugestao.tipo!=="uso_consumo"){
      const lp=av.filter(a=>a!=="Sem inconsistências.");
      if(!lp.includes("Provável UC por vínculo com a nota.")) lp.unshift("Provável UC por vínculo com a nota.");
      return {...l,sugestao:{tipo:"uso_consumo",motivo:"outro item da mesma nota identificado como possível UC",confianca:"baixa"},status:"ALERTA",avisos:lp};
    }
    const lp=av.filter(a=>a!=="Sem inconsistências.");
    if(!lp.includes("Nota contém outros itens com indício de UC.")) lp.unshift("Nota contém outros itens com indício de UC.");
    return {...l,avisos:lp};
  });
}

function reproc(linhas: LinhaEntrada[], perfil: PerfilEmpresa, ehInd=false): LinhaEntrada[] {
  const p=linhas.map(l=>{
    const sug=l.fonte==="c190"?l.sugestao:analisarProduto(l.descricao,perfil,l.ncm);
    const u={...l,sugestao:sug};
    // Preserva classificação manual do usuário; recalcula se for sugestão automática
    const cl=l.classificacaoManual?l.classificacao:sugerirClass(u,ehInd), res=validarItem(u,ehInd);
    // Recalcula o CFOP de entrada quando o perfil muda; preserva seleção do modal se a regra geral não tiver mapeamento
    const newCfop=l.tipo_nfe==="terceiro"?sugerirCfopEntrada(l.cfop,sug.tipo,ehInd):l.cfop_entrada_sugerido;
    const cfopSug=newCfop||l.cfop_entrada_sugerido;
    return {...u,...res,classificacao:cl,classificacaoManual:l.classificacaoManual,cfop_entrada_sugerido:cfopSug};
  });
  return vinculoUC(p);
}

function agruparEntradas(linhas: LinhaEntrada[]): NotaEntrada[] {
  const m=new Map<string,NotaEntrada>();
  for(const l of linhas){
    const c=`${l.numero_nota}__${l.fornecedor}`;
    if(!m.has(c)) m.set(c,{chave:c,numero_nota:l.numero_nota,fornecedor:l.fornecedor,data:l.data,total_itens:0,total_contabil:0,total_base_icms:0,total_valor_icms:0,status:"OK",itens:[],sugestoes:[],avisos:[],classificacaoPredominante:null});
    const g=m.get(c)!;
    g.total_itens++;g.total_contabil+=l.valor_contabil;g.total_base_icms+=l.base_icms;g.total_valor_icms+=l.valor_icms;g.itens.push(l);
    if(l.status==="ALERTA") g.status="ALERTA";
    if(l.sugestao.tipo){const t=l.sugestao.tipo==="uso_consumo"?"Possível UC":l.sugestao.tipo==="imobilizado"?"Possível Imobilizado":"Possível Combustível";if(!g.sugestoes.includes(t))g.sugestoes.push(t);}
    const a0=l.avisos[0]||"";if(a0&&a0!=="Sem inconsistências."&&!g.avisos.includes(a0))g.avisos.push(a0);
  }
  for(const n of m.values()){
    const cnt: Record<string,number>={};
    for(const i of n.itens) if(i.classificacao) cnt[i.classificacao]=(cnt[i.classificacao]||0)+1;
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
    n.classificacaoPredominante=(top?.[0] as ClassificacaoManual)||null;
  }
  return Array.from(m.values());
}

// Agrupa notas de SAÍDA por nota fiscal
function agruparSaidas(saidas: LinhaSaida[]): NotaSaida[] {
  const m=new Map<string,NotaSaida>();
  for(const s of saidas){
    const c=`${s.numero_nota}__${s.destinatario}`;
    if(!m.has(c)) m.set(c,{chave:c,numero_nota:s.numero_nota,destinatario:s.destinatario,data:s.data,total_itens:0,total_contabil:0,total_icms:0,total_pis:0,total_cofins:0,total_ibs:0,total_cbs:0,status:"OK",itens:[],tem_cbenef:false,alertas:[]});
    const g=m.get(c)!;
    g.total_itens++;g.total_contabil+=s.valor_contabil;g.total_icms+=s.valor_icms;g.total_pis+=s.valor_pis;g.total_cofins+=s.valor_cofins;g.total_ibs+=s.valor_ibs;g.total_cbs+=s.valor_cbs;
    g.itens.push(s);
    if(s.status==="ALERTA") g.status="ALERTA";
    if(s.cbenef&&s.cbenef!=="SEM CBENEF") g.tem_cbenef=true;
    for(const a of s.alertas_saida) if(!g.alertas.includes(a)) g.alertas.push(a);
  }
  return Array.from(m.values());
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO EXCEL
// ══════════════════════════════════════════════════════════════════════════════

function exportExcel(notas: NotaEntrada[], saidas: LinhaSaida[], emp: DadosEmpresa|null) {
  const wb=XLSX.utils.book_new();
  const CC="FF0D3340",CB="FFFFFFFF",CA="FFFFF3CD",CO="FFD4EDDA";
  const CCl: Record<string,string>={revenda:"FFD4EDDA",uso_consumo:"FFFDE8D8",imobilizado:"FFE8E0FA",combustivel:"FFFCE4EF",desconhece:"FFFAD7D7",nao_recebido:"FFFFF9D4",servico:"FFD8EBFD"};
  const h=(v:string):XLSX.CellObject=>({v,t:"s",s:{font:{bold:true,color:{rgb:CB},sz:11,name:"Calibri"},fill:{fgColor:{rgb:CC}},alignment:{horizontal:"center",vertical:"center",wrapText:true},border:{bottom:{style:"medium",color:{rgb:"FF27C7D8"}}}}});
  const c=(v:unknown,b=false,bg?:string,z?:string):XLSX.CellObject=>({v:v as string|number,t:typeof v==="number"?"n":"s",z,s:{font:{bold:b,sz:10,name:"Calibri"},fill:bg?{fgColor:{rgb:bg}}:undefined,alignment:{vertical:"center"},border:{bottom:{style:"thin",color:{rgb:"FFE0EAED"}},right:{style:"thin",color:{rgb:"FFE0EAED"}}}}});
  const wr=(ws:XLSX.WorkSheet,rows:XLSX.CellObject[][])=>rows.forEach((row,r)=>row.forEach((cl,col)=>{ws[XLSX.utils.encode_cell({r,c:col})]=cl;}));

  // Notas Entradas — uma linha por nota+CFOP para mostrar breakdown por CFOP
  const hE=["Nº Nota","Data","Fornecedor","Itens","CFOP","Descrição CFOP","Valor (CFOP)","Base ICMS (CFOP)","ICMS (CFOP)","Valor Total Nota","Classificação","Alertas","Status"];
  const rE:XLSX.CellObject[][]=[hE.map(h)];
  for(const n of notas){
    // Agrupa itens por CFOP dentro da nota
    const cfopMap=new Map<string,{valor:number;base:number;icms:number}>();
    for(const i of n.itens){
      if(!cfopMap.has(i.cfop)) cfopMap.set(i.cfop,{valor:0,base:0,icms:0});
      const g=cfopMap.get(i.cfop)!; g.valor+=i.valor_contabil; g.base+=i.base_icms; g.icms+=i.valor_icms;
    }
    const cfopList=Array.from(cfopMap.entries());
    const cl=n.classificacaoPredominante;
    cfopList.forEach(([cfop,vals],idx)=>{
      rE.push([
        c(idx===0?n.numero_nota:"",idx===0),
        c(idx===0?n.data:""),
        c(idx===0?n.fornecedor:""),
        c(idx===0?n.total_itens:"",false,undefined,"0"),
        c(cfop,true,undefined),
        c(DESC_CFOP[cfop]||`CFOP ${cfop}`),
        c(vals.valor,false,undefined,"#,##0.00"),
        c(vals.base,false,undefined,"#,##0.00"),
        c(vals.icms,false,undefined,"#,##0.00"),
        c(idx===0?n.total_contabil:"",false,undefined,"#,##0.00"),
        c(idx===0?(cl?CLASSIFICACAO_LABEL[cl]:"A classificar"):"",false,idx===0&&cl?CCl[cl]:undefined),
        c(idx===0?n.avisos.filter(a=>a!=="Sem inconsistências.").join(" | "):""),
        c(idx===0?n.status:"",true,idx===0?(n.status==="ALERTA"?CA:CO):undefined),
      ]);
    });
  }
  const wsE=XLSX.utils.aoa_to_sheet(rE.map(r=>r.map(x=>x.v)));wr(wsE,rE);wsE["!cols"]=[{wch:14},{wch:12},{wch:36},{wch:8},{wch:8},{wch:38},{wch:16},{wch:16},{wch:16},{wch:16},{wch:20},{wch:55},{wch:10}];
  XLSX.utils.book_append_sheet(wb,wsE,"Notas Entradas");

  const hI=["Nº Nota","Data","Fornecedor","Cód.","Descrição","NCM","CFOP Forn.","CFOP Entrada","CST","Valor Produto","Frete Rateado","Despesas Rateadas","IPI Item","Desconto Rateado","Valor Contábil Total","Base ICMS","Alíq. ICMS","ICMS","Classificação","Sugestão","Confiança","Alertas","Status","Fonte"];
  const rI:XLSX.CellObject[][]=[hI.map(h)];
  for(const n of notas)for(const i of n.itens){const cl=i.classificacao;const st=i.sugestao.tipo?`${i.sugestao.tipo==="uso_consumo"?"UC":i.sugestao.tipo==="imobilizado"?"Imobilizado":"Combustível"} – ${i.sugestao.motivo}`:"";const fl=i.fonte==="xml"?"XML NF-e":i.fonte==="c190"?"C190 (resumo)":"SPED C170";rI.push([c(n.numero_nota,true),c(i.data),c(n.fornecedor),c(i.codigo_produto),c(i.descricao),c(i.ncm),c(i.cfop),c(i.tipo_nfe==="terceiro"?i.cfop_entrada_sugerido||"":"—"),c(i.cst_icms),c(i.valor_produto||i.valor_contabil,false,undefined,"#,##0.00"),c(i.valor_frete||0,false,undefined,"#,##0.00"),c(i.valor_despesas||0,false,undefined,"#,##0.00"),c(i.valor_ipi_item||0,false,undefined,"#,##0.00"),c(i.valor_desconto||0,false,undefined,"#,##0.00"),c(i.valor_contabil,false,undefined,"#,##0.00"),c(i.base_icms,false,undefined,"#,##0.00"),c(i.aliquota_icms,false,undefined,'0.00"%"'),c(i.valor_icms,false,undefined,"#,##0.00"),c(cl?CLASSIFICACAO_LABEL[cl]:"A classificar",false,cl?CCl[cl]:undefined),c(st),c(i.sugestao.confianca||""),c(i.avisos.filter(a=>a!=="Sem inconsistências.").join(" | ")),c(i.status,true,i.status==="ALERTA"?CA:CO),c(fl)]);}
  const wsI=XLSX.utils.aoa_to_sheet(rI.map(r=>r.map(x=>x.v)));wr(wsI,rI);wsI["!cols"]=[{wch:12},{wch:12},{wch:36},{wch:12},{wch:44},{wch:12},{wch:8},{wch:8},{wch:8},{wch:14},{wch:14},{wch:12},{wch:14},{wch:22},{wch:45},{wch:10},{wch:55},{wch:10},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsI,"Itens Entradas");

  if(saidas.length>0){
    // Resumo Notas Saídas — uma linha por nota + CFOP
    const hNS=["Nº Nota","Data","Destinatário","CFOP","Descrição CFOP","Valor (CFOP)","Base ICMS (CFOP)","ICMS (CFOP)","Valor Total Nota","ICMS Total Nota","PIS Total","COFINS Total","Alertas","Status"];
    const rNS:XLSX.CellObject[][]=[hNS.map(h)];
    const notasSaidasAgrup=agruparSaidas(saidas);
    for(const n of notasSaidasAgrup){
      const cfopMapS=new Map<string,{valor:number;base:number;icms:number}>();
      for(const i of n.itens){if(!cfopMapS.has(i.cfop))cfopMapS.set(i.cfop,{valor:0,base:0,icms:0});const g=cfopMapS.get(i.cfop)!;g.valor+=i.valor_contabil;g.base+=i.base_icms;g.icms+=i.valor_icms;}
      const cfopListS=Array.from(cfopMapS.entries());
      cfopListS.forEach(([cfop,vals],idx)=>{
        rNS.push([
          c(idx===0?n.numero_nota:"",idx===0),
          c(idx===0?n.data:""),
          c(idx===0?n.destinatario:""),
          c(cfop,true),
          c(DESC_CFOP[cfop]||`CFOP ${cfop}`),
          c(vals.valor,false,undefined,"#,##0.00"),
          c(vals.base,false,undefined,"#,##0.00"),
          c(vals.icms,false,undefined,"#,##0.00"),
          c(idx===0?n.total_contabil:"",false,undefined,"#,##0.00"),
          c(idx===0?n.total_icms:"",false,undefined,"#,##0.00"),
          c(idx===0?n.total_pis:"",false,undefined,"#,##0.00"),
          c(idx===0?n.total_cofins:"",false,undefined,"#,##0.00"),
          c(idx===0?n.alertas.join(" | "):""),
          c(idx===0?n.status:"",true,idx===0?(n.status==="ALERTA"?CA:CO):undefined),
        ]);
      });
    }
    const wsNS=XLSX.utils.aoa_to_sheet(rNS.map(r=>r.map(x=>x.v)));wr(wsNS,rNS);wsNS["!cols"]=[{wch:12},{wch:12},{wch:36},{wch:8},{wch:38},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:14},{wch:14},{wch:50},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsNS,"Resumo Saídas");

    const hS=["Nº Nota","Data","Destinatário","Cód.","Descrição","NCM","CFOP","CST ICMS","CST PIS","CST COFINS","Valor Produto","Frete Rateado","Despesas Rateadas","IPI Item","Desconto Rateado","Valor Contábil Total","Base ICMS","Alíq. ICMS","ICMS","ICMS-ST","IPI","PIS","COFINS","IBS","CBS","CBenef","Benefício Fiscal","Alertas","Status"];
    const rS:XLSX.CellObject[][]=[hS.map(h)];
    for(const s of saidas){rS.push([c(s.numero_nota,true),c(s.data),c(s.destinatario),c(s.codigo_produto),c(s.descricao),c(s.ncm),c(s.cfop),c(s.cst_icms),c(s.cst_pis),c(s.cst_cofins),c(s.valor_produto||s.valor_contabil,false,undefined,"#,##0.00"),c(s.valor_frete||0,false,undefined,"#,##0.00"),c(s.valor_despesas||0,false,undefined,"#,##0.00"),c(s.valor_ipi_item||0,false,undefined,"#,##0.00"),c(s.valor_desconto||0,false,undefined,"#,##0.00"),c(s.valor_contabil,false,undefined,"#,##0.00"),c(s.base_icms,false,undefined,"#,##0.00"),c(s.aliquota_icms,false,undefined,'0.00"%"'),c(s.valor_icms,false,undefined,"#,##0.00"),c(s.valor_st,false,undefined,"#,##0.00"),c(s.valor_ipi,false,undefined,"#,##0.00"),c(s.valor_pis,false,undefined,"#,##0.00"),c(s.valor_cofins,false,undefined,"#,##0.00"),c(s.valor_ibs,false,undefined,"#,##0.00"),c(s.valor_cbs,false,undefined,"#,##0.00"),c(s.cbenef,false,s.cbenef?"FFE8E0FA":undefined),c(s.cbenef_descricao),c(s.alertas_saida.join(" | ")),c(s.status,true,s.status==="ALERTA"?CA:CO)]);}
    const wsS=XLSX.utils.aoa_to_sheet(rS.map(r=>r.map(x=>x.v)));wr(wsS,rS);wsS["!cols"]=[{wch:12},{wch:12},{wch:38},{wch:12},{wch:42},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:14},{wch:14},{wch:12},{wch:14},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:14},{wch:55},{wch:55},{wch:10}];
    XLSX.utils.book_append_sheet(wb,wsS,"Notas Saídas");
  }

  // Aba Resumo por CFOP
  const hCE=["CFOP","Descrição","Qtd. Notas","Qtd. Itens","Valor Contábil","Base ICMS","ICMS"];
  const rCE:XLSX.CellObject[][]=[hCE.map(h)];
  const cfopEfXls=(i:LinhaEntrada)=>i.tipo_nfe==="terceiro"?(i.cfop_entrada_sugerido||i.cfop):i.cfop;
  const rcfopE=new Map<string,{qtd_notas:Set<string>;qtd_itens:number;valor:number;base:number;icms:number}>();
  for(const n of notas)for(const i of n.itens){const ck=cfopEfXls(i);if(!rcfopE.has(ck))rcfopE.set(ck,{qtd_notas:new Set(),qtd_itens:0,valor:0,base:0,icms:0});const g=rcfopE.get(ck)!;g.qtd_notas.add(n.numero_nota);g.qtd_itens++;g.valor+=i.valor_contabil;g.base+=i.base_icms;g.icms+=i.valor_icms;}
  Array.from(rcfopE.entries()).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([cfop,g])=>{rCE.push([c(cfop,true),c(DESC_CFOP[cfop]||`CFOP ${cfop}`),c(g.qtd_notas.size,false,undefined,"0"),c(g.qtd_itens,false,undefined,"0"),c(g.valor,false,undefined,"#,##0.00"),c(g.base,false,undefined,"#,##0.00"),c(g.icms,false,undefined,"#,##0.00")]);});
  const wsCE=XLSX.utils.aoa_to_sheet(rCE.map(r=>r.map(x=>x.v)));wr(wsCE,rCE);wsCE["!cols"]=[{wch:8},{wch:50},{wch:12},{wch:12},{wch:18},{wch:18},{wch:18}];
  XLSX.utils.book_append_sheet(wb,wsCE,"Resumo CFOP Entradas");
  const hCS=["CFOP","Descrição","Qtd. Notas","Qtd. Itens","Valor Contábil","Base ICMS","ICMS"];
  const rCS:XLSX.CellObject[][]=[hCS.map(h)];
  const rcfopS=new Map<string,{qtd_notas:Set<string>;qtd_itens:number;valor:number;base:number;icms:number}>();
  for(const s of saidas){if(!rcfopS.has(s.cfop))rcfopS.set(s.cfop,{qtd_notas:new Set(),qtd_itens:0,valor:0,base:0,icms:0});const g=rcfopS.get(s.cfop)!;g.qtd_notas.add(s.numero_nota);g.qtd_itens++;g.valor+=s.valor_contabil;g.base+=s.base_icms;g.icms+=s.valor_icms;}
  Array.from(rcfopS.entries()).sort((a,b)=>b[1].valor-a[1].valor).forEach(([cfop,g])=>{rCS.push([c(cfop,true),c(DESC_CFOP[cfop]||`CFOP ${cfop}`),c(g.qtd_notas.size,false,undefined,"0"),c(g.qtd_itens,false,undefined,"0"),c(g.valor,false,undefined,"#,##0.00"),c(g.base,false,undefined,"#,##0.00"),c(g.icms,false,undefined,"#,##0.00")]);});
  const wsCS=XLSX.utils.aoa_to_sheet(rCS.map(r=>r.map(x=>x.v)));wr(wsCS,rCS);wsCS["!cols"]=[{wch:8},{wch:50},{wch:12},{wch:12},{wch:18},{wch:18},{wch:18}];
  XLSX.utils.book_append_sheet(wb,wsCS,"Resumo CFOP Saídas");

  const totN=notas.length,totI=notas.reduce((a,n)=>a+n.total_itens,0),totV=notas.reduce((a,n)=>a+n.total_contabil,0),totIcms=notas.reduce((a,n)=>a+n.total_valor_icms,0);
  const cntCl: Record<string,{qtd:number;valor:number}>={};
  for(const n of notas)for(const i of n.itens){const lb=i.classificacao?CLASSIFICACAO_LABEL[i.classificacao]:"A classificar";if(!cntCl[lb])cntCl[lb]={qtd:0,valor:0};cntCl[lb].qtd++;cntCl[lb].valor+=i.valor_contabil;}
  const rd=[["RELATÓRIO DE VALIDAÇÃO FISCAL — ENFOKUS CONTABILIDADE E FINANÇAS CORPORATIVAS"],[""],["Empresa:",emp?.nome||""],["CNPJ:",emp?.cnpj?fcnpj(emp.cnpj):""],["IE:",emp?.ie||""],["UF:",emp?.uf||""],["Período:",`${emp?.periodoInicial||""} até ${emp?.periodoFinal||""}`],["Gerado em:",new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})],[""],["ENTRADAS"],["Total Notas:",totN],["Total Itens:",totI],["Valor Total (R$):",totV],["ICMS Total (R$):",totIcms],["Notas com Alerta:",notas.filter(n=>n.status==="ALERTA").length],[""],["SAÍDAS"],["Total Itens Saída:",saidas.length],["Valor Total Saída (R$):",saidas.reduce((a,i)=>a+i.valor_contabil,0)],[""],["CLASSIFICAÇÃO DOS ITENS DE ENTRADA"],["Classificação","Qtd. Itens","Valor Total (R$)"],...Object.entries(cntCl).map(([lb,d])=>[lb,d.qtd,d.valor])];
  const wsR=XLSX.utils.aoa_to_sheet(rd);wsR["!cols"]=[{wch:38},{wch:42},{wch:20}];
  if(wsR["A1"])wsR["A1"].s={font:{bold:true,sz:14,color:{rgb:"FF1A6B7A"},name:"Calibri"}};
  XLSX.utils.book_append_sheet(wb,wsR,"Resumo Executivo");

  const per=emp?`_${emp.periodoInicial?.replace(/\//g,"-")}_${emp.periodoFinal?.replace(/\//g,"-")}`:"";
  const ne=emp?.nome?`_${emp.nome.slice(0,20).replace(/[^a-zA-Z0-9]/g,"_")}`:"";
  XLSX.writeFile(wb,`Enfokus_Validacao${ne}${per}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════════════════════

type EmpresaSelecionada = { id: string; razao_social: string; cnpj: string; cnae_principal?: string };

export default function ValidadorPage() {
  const [linhas,setLinhas]=useState<LinhaEntrada[]>([]);
  const [saidas,setSaidas]=useState<LinhaSaida[]>([]);
  const [erro,setErro]=useState("");
  const [perfil,setPerfil]=useState<PerfilEmpresa>("geral");
  const [expandidas,setExpandidas]=useState<Set<string>>(new Set());
  const [expandidasS,setExpandidasS]=useState<Set<string>>(new Set());
  const [expandidasI,setExpandidasI]=useState<Set<string>>(new Set());
  const [filtros,setFiltros]=useState<Filtros>({somenteAlertas:false,cfop:"",ncm:"",busca:"",classificacao:""});
  const [modulo,setModulo]=useState<"entradas"|"saidas"|"cfop">("entradas");
  const [abaE,setAbaE]=useState<"notas"|"itens">("notas");
  const [buscaS,setBuscaS]=useState("");
  const [soAlerS,setSoAlerS]=useState(false);
  const [infoCanc,setInfoCanc]=useState("");
  const [ehIndustrial,setEhIndustrial]=useState(false);
  const router = useRouter();
  const [tema,setTema]=useState<"escuro"|"claro">("claro");
  // ─── Empresa em análise (global via hook) ─────────────────────
  const { empresaAtiva: empresa, definirEmpresaAtiva } = useEmpresaAtiva();
  const [listaEmpresas,setListaEmpresas]=useState<EmpresaSelecionada[]>([]);
  const [carregandoEmpresas,setCarregandoEmpresas]=useState(false);
  const [mostrarSeletorEmpresa,setMostrarSeletorEmpresa]=useState(false);
  // ─── Sessão vinculada ao banco ────────────────────────────────
  const [sessaoAtual,setSessaoAtual]=useState<DadosSessao|null>(null);
  const [modalAberto,setModalAberto]=useState(false);
  const [xmlsPendentes,setXmlsPendentes]=useState<{chaveNfe:string;numeroNf:string;dataEmissao:string|null;emitenteCnpj:string;emitenteNome:string;destinatarioCnpj:string;destinatarioNome:string;tipoOperacao:string;valorTotal:number}[]>([]);
  const [competenciaXml,setCompetenciaXml]=useState("");
  const [erroSalvar,setErroSalvar]=useState("");
  const [salvouComSucesso,setSalvouComSucesso]=useState(false);
  const [limpandoDb,setLimpandoDb]=useState(false);
  // ─── Sessões anteriores (reload) ────────────────────────────────
  type SessaoSalva = { id: string; competencia: string; created_at: string; xmls?: { count: number }[] };
  const [sessoesSalvas,setSessoesSalvas]=useState<SessaoSalva[]>([]);
  const [carregandoSessoes,setCarregandoSessoes]=useState(false);
  const [sessaoExpandida,setSessaoExpandida]=useState(false);
  // ─── Modal de mapeamento CFOP (antes do ModalSessao) ─────────
  type CfopMapeamentoItem = { nota: string; fornecedor: string; cfopForn: string; cfopSel: string; opcoes: { cfop: string; tipo: string; descricao: string }[]; produtos: string[] };
  const [modalCfopAberto,setModalCfopAberto]=useState(false);
  const [cfopMapeamento,setCfopMapeamento]=useState<CfopMapeamentoItem[]>([]);
  const pendingNe=useRef<LinhaEntrada[]>([]);
  const pendingNs=useRef<LinhaSaida[]>([]);
  const pendingQtdCanc=useRef(0);
  const pendingMeta=useRef<XmlMetadata[]>([]);
  const pendingDevRefs=useRef<Set<string>>(new Set());
  const D=tema==="escuro";
  const refXmlTerceiros=useRef<HTMLInputElement|null>(null);
  const refXmlProprio=useRef<HTMLInputElement|null>(null);

  useEffect(()=>{
    const salvo = (window.localStorage.getItem("af-theme") as "escuro"|"claro"|null) || "claro";
    setTema(salvo);
    const onThemeChange = (event: Event) => {
      const proximo = (event as CustomEvent<"escuro"|"claro">).detail;
      if (proximo === "escuro" || proximo === "claro") setTema(proximo);
    };
    window.addEventListener("af-theme-change", onThemeChange as EventListener);
    return ()=>window.removeEventListener("af-theme-change", onThemeChange as EventListener);
  },[]);

  // Carrega lista de empresas ao montar (para o seletor inline)
  useEffect(()=>{
    setCarregandoEmpresas(true);
    fetch("/api/empresas").then(r=>r.json()).then((lista: EmpresaSelecionada[])=>{
      setListaEmpresas(lista);
    }).finally(()=>setCarregandoEmpresas(false));
  },[]);

  // Define se empresa é industrial pelo CNAE (divisões 10-33 = manufatura)
  useEffect(()=>{
    if(!empresa?.cnae_principal) { setEhIndustrial(false); return; }
    const cnae=empresa.cnae_principal.replace(/\D/g,"");
    const div=parseInt(cnae.slice(0,2),10);
    setEhIndustrial(div>=10&&div<=33);
  },[empresa]);

  // Carrega sessões salvas ao trocar de empresa
  useEffect(()=>{
    if(!empresa) { setSessoesSalvas([]); return; }
    setCarregandoSessoes(true);
    fetch(`/api/sessoes?empresa_id=${empresa.id}`)
      .then(r=>r.json())
      .then((lista: SessaoSalva[])=>{ if(Array.isArray(lista)) setSessoesSalvas(lista); })
      .catch(()=>{})
      .finally(()=>setCarregandoSessoes(false));
  },[empresa]);

  async function carregarSessaoAnterior(sessao: SessaoSalva) {
    setSessaoExpandida(false);
    try {
      const res = await fetch(`/api/arquivos-xml?sessao_id=${sessao.id}&incluir_dados=true`);
      if(!res.ok){ setErro("Erro ao carregar sessão."); return; }
      const registros: {chave_nfe?: string | null; id: string; parsed_data: {itens_entrada?: LinhaEntrada[]; itens_saida?: LinhaSaida[]} | null}[] = await res.json();
      if(!Array.isArray(registros)){ setErro("Resposta inválida ao carregar sessão."); return; }

      // Deduplica por chave_nfe — o mesmo XML pode ter sido salvo mais de uma vez
      const seenChaves = new Set<string>()
      const novasLinhas: LinhaEntrada[] = [];
      const novasSaidas: LinhaSaida[] = [];
      for(const reg of registros){
        const key = reg.chave_nfe || reg.id
        if(seenChaves.has(key)) continue
        seenChaves.add(key)
        if(!reg.parsed_data) continue;
        if(Array.isArray(reg.parsed_data.itens_entrada)) novasLinhas.push(...reg.parsed_data.itens_entrada);
        if(Array.isArray(reg.parsed_data.itens_saida)) novasSaidas.push(...reg.parsed_data.itens_saida);
      }

      // Sempre restaura sessão e competência, mesmo sem itens
      setCompetenciaXml(sessao.competencia);
      setSessaoAtual({ sessaoId: sessao.id, empresaId: empresa!.id, empresaNome: empresa!.razao_social, competencia: sessao.competencia });
      setErro("");

      if(novasLinhas.length > 0 || novasSaidas.length > 0){
        setLinhas(novasLinhas);
        setSaidas(novasSaidas);
        setInfoCanc(`Sessão ${sessao.competencia} recarregada — ${novasLinhas.length} it. entrada / ${novasSaidas.length} it. saída`);
      } else if(registros.length > 0){
        // Tentar carregar itens de fa_documentos_itens (salvo pela aba Apuração do Sistema)
        try {
          const resDb = await fetch(
            `/api/documentos-fiscais?empresa_id=${empresa!.id}&competencia=${encodeURIComponent(sessao.competencia)}&incluir_itens=true`
          );
          if(resDb.ok){
            const docsDb: Array<{
              id: string; numero?: string; emitente_nome?: string; emitente_cnpj?: string;
              destinatario_nome?: string; destinatario_cnpj?: string; data_emissao?: string;
              tipo_movimento?: string;
              fa_documentos_itens?: Array<{
                id: string; codigo_produto?: string; descricao?: string; ncm?: string; cfop?: string;
                quantidade: number; valor_unitario: number; valor_total: number;
                valor_desconto: number; valor_frete: number; valor_ipi: number;
                cst_icms?: string; csosn?: string; valor_bc_icms: number; aliquota_icms: number; valor_icms: number;
                valor_bc_st: number; valor_st: number;
                cst_pis?: string; valor_bc_pis: number; aliquota_pis: number; valor_pis: number;
                cst_cofins?: string; valor_bc_cofins: number; aliquota_cofins: number; valor_cofins: number;
              }>;
            }> = await resDb.json();

            const mappedEntradas: LinhaEntrada[] = [];
            const mappedSaidas: LinhaSaida[] = [];

            for(const doc of docsDb){
              const itens = doc.fa_documentos_itens ?? [];
              for(const item of itens){
                const cfopStr = item.cfop ?? '';
                const isSaida = doc.tipo_movimento === 'saida' || cfopStr.startsWith('5') || cfopStr.startsWith('6');
                if(isSaida){
                  mappedSaidas.push({
                    id: item.id,
                    numero_nota: doc.numero ?? '—',
                    destinatario: doc.destinatario_nome ?? doc.destinatario_cnpj ?? '—',
                    data: doc.data_emissao ?? '',
                    codigo_produto: item.codigo_produto ?? '',
                    descricao: item.descricao ?? '',
                    ncm: item.ncm ?? '',
                    cfop: cfopStr,
                    cst_icms: item.cst_icms ?? item.csosn ?? '',
                    cst_pis: item.cst_pis ?? '',
                    cst_cofins: item.cst_cofins ?? '',
                    valor_contabil: item.valor_total,
                    valor_produto: item.valor_total,
                    valor_desconto: item.valor_desconto ?? 0,
                    valor_frete: item.valor_frete ?? 0,
                    valor_despesas: 0,
                    valor_ipi_item: item.valor_ipi ?? 0,
                    base_icms: item.valor_bc_icms, aliquota_icms: item.aliquota_icms, valor_icms: item.valor_icms,
                    base_st: item.valor_bc_st, valor_st: item.valor_st, valor_ipi: item.valor_ipi ?? 0,
                    base_pis: item.valor_bc_pis, aliquota_pis: item.aliquota_pis, valor_pis: item.valor_pis,
                    base_cofins: item.valor_bc_cofins, aliquota_cofins: item.aliquota_cofins, valor_cofins: item.valor_cofins,
                    valor_ibs: 0, valor_cbs: 0,
                    cbenef: '', cbenef_descricao: '',
                    alertas_saida: [], status: 'OK',
                  });
                } else {
                  mappedEntradas.push({
                    id: item.id,
                    numero_nota: doc.numero ?? '—',
                    fornecedor: doc.emitente_nome ?? doc.emitente_cnpj ?? '—',
                    data: doc.data_emissao ?? '',
                    codigo_produto: item.codigo_produto ?? '',
                    cst_icms: item.cst_icms ?? item.csosn ?? '',
                    ncm: item.ncm ?? '',
                    descricao: item.descricao ?? '',
                    cfop: cfopStr,
                    valor_contabil: item.valor_total,
                    base_icms: item.valor_bc_icms, aliquota_icms: item.aliquota_icms, valor_icms: item.valor_icms,
                    valor_produto: item.valor_total,
                    valor_desconto: item.valor_desconto ?? 0,
                    valor_frete: item.valor_frete ?? 0,
                    valor_despesas: 0,
                    valor_ipi_item: item.valor_ipi ?? 0,
                    status: 'OK', avisos: [],
                    sugestao: { tipo: null, motivo: '', confianca: null },
                    classificacao: null,
                    fonte: 'xml',
                    tipo_nfe: 'terceiro',
                  });
                }
              }
            }

            if(mappedEntradas.length > 0 || mappedSaidas.length > 0){
              setLinhas(mappedEntradas);
              setSaidas(mappedSaidas);
              setInfoCanc(`Sessão ${sessao.competencia} recarregada — ${mappedEntradas.length} it. entrada / ${mappedSaidas.length} it. saída (via banco)`);
            } else {
              setInfoCanc(`Sessão ${sessao.competencia} recarregada — ${registros.length} XML(s) importados (itens pendentes de reimportação)`);
            }
          } else {
            setInfoCanc(`Sessão ${sessao.competencia} recarregada — ${registros.length} XML(s) importados (itens pendentes de reimportação)`);
          }
        } catch {
          setInfoCanc(`Sessão ${sessao.competencia} recarregada — ${registros.length} XML(s) importados (itens pendentes de reimportação)`);
        }
      } else {
        setInfoCanc(`Sessão ${sessao.competencia} restaurada — nenhum XML salvo ainda.`);
      }
    } catch {
      setErro("Erro inesperado ao carregar sessão anterior.");
    }
  }

  async function processarXmls(files: FileList, forceTipo: "terceiro" | "proprio") {
    // ── PASSO 1: ler textos e separar cancelamentos ──────────────────────────
    const txts: {nome:string;txt:string}[] = [];
    for(const f of Array.from(files)) txts.push({nome:f.name,txt:await f.text()});

    const chavesCanceladas = new Set<string>();
    for(const {txt} of txts){
      const chCanc = detectarCancelamento(txt);
      if(chCanc) chavesCanceladas.add(chCanc);
    }

    // ── PASSO 1.5: pré-scan — coletar identificadores de devoluções (tpNF=0) ────
    // O set armazena tanto nomes de fornecedores (match amplo, sempre disponível)
    // quanto números de NF extraídos do refNFe (match preciso, quando disponível).
    const devolucaoRefs = new Set<string>();
    if(forceTipo === "terceiro"){
      for(const {txt} of txts){
        if(detectarCancelamento(txt)) continue;
        const m = extrairMetadataXml(txt);
        if(m?.tipo_operacao === "entrada"){
          // Fallback: fornecedor da nota de devolução é o mesmo da nota de venda
          if(m.emitente_nome) devolucaoRefs.add(m.emitente_nome);
          // Match preciso via chave referenciada no refNFe (quando disponível)
          if(m.ref_nfe && m.ref_nfe.length === 44){
            const num = String(parseInt(m.ref_nfe.slice(25, 34), 10));
            if(num && num !== "NaN") devolucaoRefs.add(num);
          }
        }
      }
    }

    // ── PASSO 2: processar NF-e normais com validação de CNPJ ───────────────
    const ne: LinhaEntrada[]=[], ns: LinhaSaida[]=[];
    let qtdCanc = 0;
    const rejeitadosCnpj: string[] = [];
    const avisosDevolucao: string[] = [];
    const empresaCnpj = empresa?.cnpj?.replace(/\D/g,"") ?? "";

    for(const {nome, txt} of txts){
      if(detectarCancelamento(txt)) continue;

      // ── Validação de CNPJ + aviso de nota de entrada importada como terceiro ─
      const meta = extrairMetadataXml(txt);
      if(meta){
        if(empresaCnpj){
          const emitCnpj = (meta.emitente_cnpj ?? "").replace(/\D/g,"");
          const destCnpj = (meta.destinatario_cnpj ?? "").replace(/\D/g,"");
          if(forceTipo === "terceiro" && destCnpj && destCnpj !== empresaCnpj){
            rejeitadosCnpj.push(`${nome}: destinatário ${destCnpj} ≠ empresa em análise`);
            continue;
          }
          if(forceTipo === "proprio" && emitCnpj && emitCnpj !== empresaCnpj){
            rejeitadosCnpj.push(`${nome}: emitente ${emitCnpj} ≠ empresa em análise`);
            continue;
          }
        }
        // Nota de entrada do fornecedor (tpNF=0): NÃO importar como entrada da empresa.
        // Tentar vincular ao NF de saída própria referenciada (devolução).
        if(forceTipo === "terceiro" && meta.tipo_operacao === "entrada"){
          const forn = meta.emitente_nome || fcnpj(meta.emitente_cnpj || "");
          const nf = meta.numero_nf || "s/n";
          const refChave = meta.ref_nfe;
          let msg: string;
          if(refChave && refChave.length === 44){
            const nfRefNum = String(parseInt(refChave.slice(25, 34), 10));
            const vinculada = saidas.find(s => s.numero_nota === nfRefNum)
              || ns.find(s => s.numero_nota === nfRefNum);
            if(vinculada){
              msg = `NF ${nf} — ${forn}: nota de entrada do fornecedor (devolução). Vinculada à sua NF de saída nº ${nfRefNum}.`;
            } else {
              msg = `NF ${nf} — ${forn}: nota de entrada do fornecedor (possível devolução). Referencia NF nº ${nfRefNum} — importe os XMLs próprios para confirmar o vínculo.`;
            }
          } else {
            msg = `NF ${nf} — ${forn}: nota de entrada do fornecedor. Não importada — verifique se é uma devolução ou se o arquivo está correto.`;
          }
          avisosDevolucao.push(msg);
          continue; // não importar esta nota
        }
      }

      // forceEntrada=true faz o parseXml tratar tudo como entrada (para terceiros)
      const {itensEntrada,itensSaida,chaveNFe}=parseXml(txt, perfil, forceTipo === "terceiro");
      const ehCancelada = !!chaveNFe && chavesCanceladas.has(chaveNFe);
      if(ehCancelada) qtdCanc++;

      if(ehCancelada){
        if(forceTipo === "terceiro"){
          ne.push(...itensEntrada.map(i=>({
            ...i,
            valor_contabil:0, valor_produto:0, valor_desconto:0, valor_frete:0,
            valor_despesas:0, valor_ipi_item:0,
            base_icms:0, aliquota_icms:0, valor_icms:0,
            tipo_nfe:"terceiro" as TipoNFe,
            status:"ALERTA" as StatusValidacao,
            avisos:["⚠ NOTA CANCELADA — evento de cancelamento localizado na pasta."],
            cancelada:true,
            classificacao:"nao_recebido" as ClassificacaoManual,
          })));
        } else {
          ns.push(...itensSaida.map(i=>({
            ...i,
            valor_contabil:0, valor_produto:0, valor_desconto:0, valor_frete:0,
            valor_despesas:0, valor_ipi_item:0,
            base_icms:0, valor_icms:0, valor_st:0, valor_ipi:0,
            valor_pis:0, valor_cofins:0, valor_ibs:0, valor_cbs:0,
            alertas_saida:["⚠ NOTA CANCELADA — evento de cancelamento localizado na pasta."],
            status:"ALERTA" as StatusValidacao,
            cancelada:true,
          })));
        }
      } else {
        if(forceTipo === "terceiro"){
          // itensEntrada agora contém TODOS os itens (forceEntrada=true no parseXml)
          const AVISO_DEV = "⚠ Há uma nota de entrada do fornecedor referenciando esta NF. Verifique se a operação realmente aconteceu ou se foi cancelada/devolvida.";
          ne.push(...itensEntrada.map(item => {
            const temDev = devolucaoRefs.has(item.numero_nota) || devolucaoRefs.has(item.fornecedor);
            return {
              ...item,
              tipo_nfe:"terceiro" as TipoNFe,
              cfop_entrada_sugerido: sugerirCfopEntrada(item.cfop, item.sugestao.tipo, ehIndustrial),
              ...(temDev ? {
                status: "ALERTA" as StatusValidacao,
                avisos: [...item.avisos.filter(a => a !== "Sem inconsistências."), AVISO_DEV],
              } : {}),
            };
          }));
        } else {
          // Emissão própria: itens de saída vão para a aba Saídas
          ns.push(...itensSaida.map(i => ({ ...i })));
        }
      }
    }

    if(rejeitadosCnpj.length > 0){
      setErro(`${rejeitadosCnpj.length} arquivo(s) rejeitado(s) — CNPJ não corresponde à empresa em análise:\n${rejeitadosCnpj.join("\n")}`);
    }
    if(avisosDevolucao.length > 0){
      setInfoCanc(prev=>{
        const msg=`⚠ ${avisosDevolucao.length} nota(s) de entrada do fornecedor não importada(s):\n${avisosDevolucao.join("\n")}`;
        return prev?`${prev}\n${msg}`:msg;
      });
    }

    // ── PASSO 3: coletar metadados e verificar CFOPs sem mapeamento ─────────
    const metadados = txts
      .filter(({txt}) => !detectarCancelamento(txt))
      .map(({txt}) => extrairMetadataXml(txt))
      .filter((m): m is XmlMetadata => m !== null);

    if(!ne.length&&!ns.length){
      setErro("Nenhum item encontrado nos XMLs. Verifique se são NF-e válidas.");
      return;
    }

    setErro("");
    if(qtdCanc>0) setInfoCanc(`${qtdCanc} nota(s) cancelada(s) detectada(s) e marcada(s) com valores zerados.`);

    // Detectar terceiros com CFOP sem equivalente — agrupar por (nota, cfopForn) para mostrar contexto no modal
    const semMapa = new Map<string, CfopMapeamentoItem>();
    for(const item of ne){
      if(item.tipo_nfe==="terceiro" && (item.cfop_entrada_sugerido??"") === ""){
        const key = `${item.numero_nota}__${item.cfop}`;
        if(!semMapa.has(key)){
          const opcoes = getOpcoesEntrada(item.cfop, item.sugestao.tipo, ehIndustrial);
          semMapa.set(key, { nota: item.numero_nota, fornecedor: item.fornecedor, cfopForn: item.cfop, cfopSel: opcoes[0]?.cfop ?? "", opcoes, produtos: [] });
        }
        const entry = semMapa.get(key)!;
        if(item.descricao && entry.produtos.length < 4 && !entry.produtos.includes(item.descricao)){
          entry.produtos.push(item.descricao);
        }
      }
    }

    if(semMapa.size > 0){
      // Salvar dados pendentes e abrir modal de seleção de CFOP
      pendingNe.current = ne;
      pendingNs.current = ns;
      pendingQtdCanc.current = qtdCanc;
      pendingMeta.current = metadados;
      pendingDevRefs.current = devolucaoRefs;
      setCfopMapeamento(Array.from(semMapa.values()));
      setModalCfopAberto(true);
    } else {
      finalizarImportacao(ne, ns, metadados, devolucaoRefs);
    }
  }

  function finalizarImportacao(ne: LinhaEntrada[], ns: LinhaSaida[], metadados: XmlMetadata[], devRefs: Set<string> = new Set()) {
    if(ne.length>0){
      const AVISO_DEV = "⚠ Há uma nota de entrada do fornecedor referenciando esta NF. Verifique se a operação realmente aconteceu ou se foi cancelada/devolvida.";
      setLinhas(prev=>{
        const numXml=new Set(ne.map(n=>n.numero_nota));
        const fil=prev.filter(l=>!(l.fonte==="c190"&&numXml.has(l.numero_nota)));
        // Aplicar aviso de devolução em notas já importadas que foram referenciadas
        const filAtual = devRefs.size > 0
          ? fil.map(l => (devRefs.has(l.numero_nota) || devRefs.has(l.fornecedor)) && !l.avisos.includes(AVISO_DEV)
              ? {...l, status:"ALERTA" as StatusValidacao, avisos:[...l.avisos.filter(a=>a!=="Sem inconsistências."), AVISO_DEV]}
              : l)
          : fil;
        const numSped=new Set(prev.filter(l=>l.fonte==="sped").map(l=>l.numero_nota));
        const add=ne.filter(n=>!numSped.has(n.numero_nota));
        return vinculoUC([...filAtual,...add]);
      });
    }
    if(ns.length>0){
      setSaidas(prev=>{const ex=new Set(prev.map(i=>`${i.numero_nota}__${i.codigo_produto}`));return [...prev,...ns.filter(i=>!ex.has(`${i.numero_nota}__${i.codigo_produto}`))]});
    }
    if(metadados.length > 0){
      const primeira = metadados[0];
      if(primeira.data_emissao){
        const [ano, mes] = primeira.data_emissao.split("-");
        setCompetenciaXml(`${mes}/${ano}`);
      }
      const cnpjDest = empresa?.cnpj?.replace(/\D/g,"")
        || metadados.find(m => m.tipo_operacao === "entrada")?.destinatario_cnpj
        || metadados[0].destinatario_cnpj;
      void cnpjDest;
      setXmlsPendentes(metadados.map(m => ({
        chaveNfe: m.chave_nfe ?? "",
        numeroNf: m.numero_nf,
        dataEmissao: m.data_emissao,
        emitenteCnpj: m.emitente_cnpj,
        emitenteNome: m.emitente_nome,
        destinatarioCnpj: m.destinatario_cnpj,
        destinatarioNome: m.destinatario_nome,
        tipoOperacao: m.tipo_operacao ?? "",
        valorTotal: m.valor_total,
      })));
      setModalAberto(true);
    }
  }

  function onConfirmarCfopModal() {
    // Aplicar CFOPs selecionados aos itens pendentes
    const mapa = new Map(cfopMapeamento.map(m=>[`${m.nota}__${m.cfopForn}`, m.cfopSel]));
    const neAtualizado = pendingNe.current.map(item=>{
      if(item.tipo_nfe==="terceiro" && (item.cfop_entrada_sugerido??"") === ""){
        return {...item, cfop_entrada_sugerido: mapa.get(`${item.numero_nota}__${item.cfop}`) ?? item.cfop_entrada_sugerido};
      }
      return item;
    });
    setModalCfopAberto(false);
    finalizarImportacao(neAtualizado, pendingNs.current, pendingMeta.current, pendingDevRefs.current);
  }

  async function onXmlTerceiros(e: React.ChangeEvent<HTMLInputElement>) {
    const files=e.target.files; if(!files||files.length===0)return;
    await processarXmls(files, "terceiro");
  }

  async function onXmlProprio(e: React.ChangeEvent<HTMLInputElement>) {
    const files=e.target.files; if(!files||files.length===0)return;
    await processarXmls(files, "proprio");
  }

  async function onConfirmarSessaoXml(dados: DadosSessao) {
    setSessaoAtual(dados);
    setErroSalvar("");
    setSalvouComSucesso(false);
    try {
      const res = await fetch("/api/arquivos-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessao_id: dados.sessaoId,
          empresa_id: dados.empresaId,
          competencia: dados.competencia,
          xmls: xmlsPendentes.map(x => {
            const itensEntrada = linhas.filter(l => l.numero_nota === x.numeroNf && (l.fonte === "xml" || l.fonte === "xml_proprio"));
            const itensSaida = saidas.filter(s => s.numero_nota === x.numeroNf);
            return {
              chave_nfe: x.chaveNfe || null,
              numero_nf: x.numeroNf,
              data_emissao: x.dataEmissao,
              emitente_cnpj: x.emitenteCnpj,
              emitente_nome: x.emitenteNome,
              destinatario_cnpj: x.destinatarioCnpj,
              destinatario_nome: x.destinatarioNome,
              tipo_operacao: x.tipoOperacao || null,
              valor_total: x.valorTotal,
              parsed_data: (itensEntrada.length > 0 || itensSaida.length > 0)
                ? {
                    ...(itensEntrada.length > 0 ? { itens_entrada: itensEntrada } : {}),
                    ...(itensSaida.length > 0 ? { itens_saida: itensSaida } : {}),
                  }
                : null,
            };
          }),
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar XMLs.");
      setSalvouComSucesso(true);
    } catch {
      setErroSalvar("XMLs não foram salvos no banco. Os dados estão disponíveis localmente.");
    }

    // Também populamos fa_documentos_fiscais (base fiscal central) para alimentar
    // o módulo Simples Nacional (confronto + apuração) sem necessidade de reimportar
    try {
      const documentos = xmlsPendentes.map(x => ({
        tipo_documento: "nfe",
        origem: "xml_nfe",
        chave_acesso: x.chaveNfe || null,
        numero: x.numeroNf,
        serie: null,
        modelo: "55",
        data_emissao: x.dataEmissao,
        data_competencia: dados.competencia,
        emitente_cnpj: x.emitenteCnpj,
        emitente_nome: x.emitenteNome,
        destinatario_cnpj: x.destinatarioCnpj,
        destinatario_nome: x.destinatarioNome,
        valor_total: x.valorTotal,
        valor_produtos: 0,
        tipo_movimento: x.tipoOperacao === "saida" ? "saida" : "entrada",
        impacto_receita: x.tipoOperacao === "saida" ? "soma_receita" : "sem_impacto",
        origem_devolucao: "nao_aplicavel",
        status: "ok",
      }));
      const itensMap: Record<string, unknown[]> = {};
      for (const x of xmlsPendentes) {
        const chave = x.chaveNfe || x.numeroNf;
        if (x.tipoOperacao === "saida") {
          itensMap[chave] = saidas
            .filter(s => s.numero_nota === x.numeroNf && !s.cancelada)
            .map((s, i) => ({
              item_numero: i + 1,
              codigo_produto: s.codigo_produto,
              descricao: s.descricao,
              ncm: s.ncm,
              cfop: s.cfop,
              valor_total: s.valor_contabil,
              valor_desconto: s.valor_desconto,
              valor_frete: s.valor_frete,
              cst_icms: s.cst_icms,
              valor_bc_icms: s.base_icms,
              aliquota_icms: s.aliquota_icms,
              valor_icms: s.valor_icms,
              valor_bc_st: s.base_st,
              valor_st: s.valor_st,
              cst_pis: s.cst_pis,
              valor_bc_pis: s.base_pis,
              aliquota_pis: s.aliquota_pis,
              valor_pis: s.valor_pis,
              cst_cofins: s.cst_cofins,
              valor_bc_cofins: s.base_cofins,
              aliquota_cofins: s.aliquota_cofins,
              valor_cofins: s.valor_cofins,
              valor_ipi: s.valor_ipi,
              tipo_movimento: "saida",
              impacto_receita: "soma_receita",
              natureza_receita_simples: "pendente",
              classificacao: "outros",
              classificacao_manual: false,
            }));
        } else {
          itensMap[chave] = linhas
            .filter(l => l.numero_nota === x.numeroNf && (l.fonte === "xml" || l.fonte === "xml_proprio") && !l.cancelada)
            .map((l, i) => ({
              item_numero: i + 1,
              codigo_produto: l.codigo_produto,
              descricao: l.descricao,
              ncm: l.ncm,
              cfop: l.cfop,
              valor_total: l.valor_contabil,
              valor_desconto: l.valor_desconto,
              valor_frete: l.valor_frete,
              cst_icms: l.cst_icms,
              valor_bc_icms: l.base_icms,
              aliquota_icms: l.aliquota_icms,
              valor_icms: l.valor_icms,
              valor_ipi: l.valor_ipi_item,
              tipo_movimento: "entrada",
              impacto_receita: "sem_impacto",
              natureza_receita_simples: "pendente",
              classificacao: l.classificacao || "outros",
              classificacao_manual: l.classificacaoManual || false,
            }));
        }
      }
      if (documentos.length > 0) {
        await fetch("/api/documentos-fiscais/importar-nfe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresa_id: dados.empresaId, documentos, itens: itensMap }),
        });
      }
    } catch {
      // Silencioso — não bloqueia o fluxo principal do validador
    }

    setXmlsPendentes([]);
    setModalAberto(false);
  }

  function setClass(id:string,cl:ClassificacaoManual){setLinhas(p=>p.map(l=>l.id===id?{...l,classificacao:cl,classificacaoManual:true}:l));}
  function setClassNota(chave:string,cl:ClassificacaoManual){const[n,...rf]=chave.split("__");const forn=rf.join("__");setLinhas(p=>p.map(l=>l.numero_nota===n&&l.fornecedor===forn?{...l,classificacao:cl,classificacaoManual:true}:l));}
  function setCfopEntrada(id:string,cfop:string){setLinhas(p=>p.map(l=>l.id===id?{...l,cfop_entrada_sugerido:cfop}:l));}
  function limpar(){setLinhas([]);setSaidas([]);setErro("");setInfoCanc("");setPerfil("geral");setExpandidas(new Set());setExpandidasS(new Set());setFiltros({somenteAlertas:false,cfop:"",ncm:"",busca:"",classificacao:""});if(refXmlTerceiros.current)refXmlTerceiros.current.value="";if(refXmlProprio.current)refXmlProprio.current.value="";setSalvouComSucesso(false);}
  async function limparCompetenciaDb(){
    if(!sessaoAtual||!empresa) return;
    const msg=`Isso apagará todos os XMLs e documentos fiscais de ${sessaoAtual.competencia} do banco de dados. Esta ação não pode ser desfeita. Continuar?`;
    if(!window.confirm(msg)) return;
    setLimpandoDb(true);
    try{
      await fetch(`/api/fiscal/limpar-competencia?empresa_id=${empresa.id}&competencia=${encodeURIComponent(sessaoAtual.competencia)}`,{method:'DELETE'});
      setSessaoAtual(null);
      limpar();
    }catch{ /* silencioso */ }
    finally{setLimpandoDb(false);}
  }
  function changePerfil(p:PerfilEmpresa){setPerfil(p);setLinhas(prev=>reproc(prev,p,ehIndustrial));}
  function toggleE(c:string){setExpandidas(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});}
  function toggleS(c:string){setExpandidasS(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});}
  function toggleI(id:string){setExpandidasI(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});}

  // Filtro especial: "nao_classificado" = classificacao === null
  const lf=useMemo(()=>linhas.filter(l=>{
    if(filtros.somenteAlertas&&l.status!=="ALERTA")return false;
    if(filtros.cfop&&!l.cfop.includes(filtros.cfop.replace(/\D/g,"")))return false;
    if(filtros.ncm&&!l.ncm.toLowerCase().includes(filtros.ncm.toLowerCase()))return false;
    // "nao_classificado" é o valor especial para itens sem classificação
    if(filtros.classificacao==="nao_classificado"&&l.classificacao!==null)return false;
    else if(filtros.classificacao&&filtros.classificacao!=="nao_classificado"&&l.classificacao!==filtros.classificacao)return false;
    if(filtros.busca){const t=`${l.numero_nota} ${l.fornecedor} ${l.descricao} ${l.ncm} ${l.cfop} ${l.codigo_produto}`.toLowerCase();if(!t.includes(filtros.busca.toLowerCase()))return false;}
    return true;
  }),[linhas,filtros]);

  const res=useMemo(()=>({
    totalNotas:new Set(linhas.map(l=>`${l.numero_nota}__${l.fornecedor}`)).size,
    notasAlerta:new Set(linhas.filter(l=>l.status==="ALERTA").map(l=>`${l.numero_nota}__${l.fornecedor}`)).size,
    totalValor:linhas.reduce((a,l)=>a+l.valor_contabil,0),
    totalIcms:linhas.reduce((a,l)=>a+l.valor_icms,0),
    totalItens:linhas.length,
    naoClassificados:linhas.filter(l=>l.classificacao===null).length,
  }),[linhas]);

  const nf=useMemo(()=>{const n=agruparEntradas(lf);return filtros.somenteAlertas?n.filter(n=>n.status==="ALERTA"):n;},[lf,filtros.somenteAlertas]);

  // Resumo por CFOP — entradas
  // Para itens de terceiros usa cfop_entrada_sugerido (CFOP real de lançamento);
  // para SPED e próprios usa o cfop original do item.
  const resumoCfopEntradas=useMemo(()=>{
    const cfopEfetivo=(l:LinhaEntrada)=>l.tipo_nfe==="terceiro"?(l.cfop_entrada_sugerido||l.cfop):l.cfop;
    const m=new Map<string,{cfop:string;descricao:string;qtd_notas:number;qtd_itens:number;valor_contabil:number;base_icms:number;valor_icms:number}>();
    for(const l of linhas){
      const k=cfopEfetivo(l);
      if(!m.has(k)) m.set(k,{cfop:k,descricao:descCFOP(k),qtd_notas:0,qtd_itens:0,valor_contabil:0,base_icms:0,valor_icms:0});
      const g=m.get(k)!;
      g.qtd_itens++; g.valor_contabil+=l.valor_contabil; g.base_icms+=l.base_icms; g.valor_icms+=l.valor_icms;
    }
    // contar notas únicas por CFOP efetivo
    const notasPorCfop=new Map<string,Set<string>>();
    for(const l of linhas){const k=cfopEfetivo(l);if(!notasPorCfop.has(k))notasPorCfop.set(k,new Set());notasPorCfop.get(k)!.add(l.numero_nota);}
    for(const [cfop,g] of m.entries()) g.qtd_notas=notasPorCfop.get(cfop)?.size||0;
    return Array.from(m.values()).sort((a,b)=>a.cfop.localeCompare(b.cfop));
  },[linhas]);

  // Resumo por CFOP — saídas
  const resumoCfopSaidas=useMemo(()=>{
    const m=new Map<string,{cfop:string;descricao:string;qtd_notas:number;qtd_itens:number;valor_contabil:number;base_icms:number;valor_icms:number}>();
    for(const s of saidas){
      if(!m.has(s.cfop)) m.set(s.cfop,{cfop:s.cfop,descricao:descCFOP(s.cfop),qtd_notas:0,qtd_itens:0,valor_contabil:0,base_icms:0,valor_icms:0});
      const g=m.get(s.cfop)!;
      g.qtd_itens++; g.valor_contabil+=s.valor_contabil; g.base_icms+=s.base_icms; g.valor_icms+=s.valor_icms;
    }
    const notasPorCfop=new Map<string,Set<string>>();
    for(const s of saidas){if(!notasPorCfop.has(s.cfop))notasPorCfop.set(s.cfop,new Set());notasPorCfop.get(s.cfop)!.add(s.numero_nota);}
    for(const [cfop,g] of m.entries()) g.qtd_notas=notasPorCfop.get(cfop)?.size||0;
    return Array.from(m.values()).sort((a,b)=>b.valor_contabil-a.valor_contabil);
  },[saidas]);
  // Total de saídas usando vNF por nota (fonte verdade) em vez de soma de valor_contabil por item.
  // Garante consistência com o Simples Nacional que usa fa_arquivos_xml.valor_total = vNF.
  const totalSaidasVnf=useMemo(()=>{
    const notaVnf=new Map<string,number>();
    for(const s of saidas){ if(!notaVnf.has(s.numero_nota)) notaVnf.set(s.numero_nota, s.valor_total_nota??0); }
    const sv=Array.from(notaVnf.values()).reduce((a,b)=>a+b,0);
    return sv>0 ? sv : saidas.reduce((a,i)=>a+i.valor_contabil,0);
  },[saidas]);

  const ifs=useMemo(()=>filtros.somenteAlertas?lf.filter(l=>l.status==="ALERTA"):lf,[lf,filtros.somenteAlertas]);

  // Saídas filtradas e agrupadas
  const saidasFiltradas=useMemo(()=>saidas.filter(i=>{if(soAlerS&&i.status!=="ALERTA")return false;if(buscaS){const t=`${i.numero_nota} ${i.destinatario} ${i.descricao} ${i.ncm} ${i.cfop} ${i.cbenef}`.toLowerCase();if(!t.includes(buscaS.toLowerCase()))return false;}return true;}),[saidas,soAlerS,buscaS]);
  const notasSaida=useMemo(()=>agruparSaidas(saidasFiltradas),[saidasFiltradas]);

  // ── TOKENS DE TEMA ────────────────────────────────────────────────────────
  const T = D ? {
    // ── ESCURO ──────────────────────────────────────────────────────────────
    pageBg:   "radial-gradient(circle at top left,rgba(39,199,216,0.09),transparent 28%),radial-gradient(circle at bottom right,rgba(26,107,122,0.08),transparent 28%),linear-gradient(180deg,#020e17 0%,#031623 60%,#020e17 100%)",
    pageClr:  "var(--af-text)",
    cardBg:   "linear-gradient(160deg,rgba(9,30,46,0.95) 0%,rgba(5,18,28,0.98) 100%)",
    cardBrd:  "1px solid rgba(127,221,228,0.10)",
    cardShd:  "0 20px 48px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.025)",
    inpBg:    "rgba(255,255,255,0.055)",
    inpBrd:   "1px solid rgba(127,221,228,0.16)",
    inpClr:   "var(--af-text)",
    accent:   "var(--af-primary)",
    accentDim:"var(--af-muted)",
    thBg:     "rgba(5,18,28,0.9)",
    thClr:    "var(--af-primary)",
    thBrd:    "1px solid var(--af-border)",
    tdBrd:    "1px solid rgba(127,221,228,0.055)",
    tdSubBrd: "1px solid rgba(127,221,228,0.05)",
    subThClr: "var(--af-muted)",
    bGbg:     "rgba(255,255,255,0.05)",
    bGbrd:    "1px solid rgba(127,221,228,0.16)",
    bGclr:    "var(--af-primary)",
    statBg:   "rgba(255,255,255,0.03)",
    statBrd:  "1px solid rgba(127,221,228,0.08)",
    statDim:  "var(--af-muted)",
    ttBg:     "rgba(5,18,28,0.98)",
    ttBrd:    "1px solid rgba(127,221,228,0.2)",
  } : {
    // ── CLARO — contraste elevado e leitura corporativa ──────────────────────
    pageBg:   "linear-gradient(180deg,var(--af-surface-2) 0%,var(--af-border) 100%)",
    pageClr:  "var(--af-text)",
    cardBg:   "var(--af-surface)",
    cardBrd:  "1px solid #cbd5e1",
    cardShd:  "0 10px 28px rgba(15,23,42,0.08)",
    inpBg:    "var(--af-surface)",
    inpBrd:   "1px solid var(--af-muted)",
    inpClr:   "var(--af-text)",
    accent:   "var(--af-primary)",
    accentDim:"#475569",
    thBg:     "var(--af-border)",
    thClr:    "var(--af-text)",
    thBrd:    "1px solid #cbd5e1",
    tdBrd:    "1px solid var(--af-border)",
    tdSubBrd: "1px solid #e5e7eb",
    subThClr: "var(--af-text-soft)",
    bGbg:     "var(--af-surface)",
    bGbrd:    "1px solid var(--af-muted)",
    bGclr:    "var(--af-primary-hover)",
    statBg:   "var(--af-surface-2)",
    statBrd:  "1px solid #cbd5e1",
    statDim:  "#475569",
    ttBg:     "var(--af-surface)",
    ttBrd:    "1px solid #cbd5e1",
  };

  // ── ESTILOS ────────────────────────────────────────────────────────────────
  const S={
    page:{minHeight:"100vh",background:T.pageBg,color:T.pageClr,padding:"28px 20px 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"} as React.CSSProperties,
    inner:{position:"relative" as const,maxWidth:1440,margin:"0 auto"},
    card:{borderRadius:20,background:T.cardBg,border:T.cardBrd,boxShadow:T.cardShd} as React.CSSProperties,
    inp:{background:T.inpBg,border:T.inpBrd,borderRadius:10,color:T.inpClr,padding:"8px 12px",fontSize:13,outline:"none",width:"100%"} as React.CSSProperties,
    bP:{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:D?"linear-gradient(135deg,var(--af-primary),#1a8fa0)":"linear-gradient(135deg,var(--af-primary),#2563eb)",color:"var(--af-surface)",fontWeight:700,fontSize:13,padding:"10px 18px",border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(39,199,216,0.25)"} as React.CSSProperties,
    bG:{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:T.bGbg,border:T.bGbrd,color:T.bGclr,fontWeight:600,fontSize:13,padding:"10px 18px",cursor:"pointer"} as React.CSSProperties,
    bD:{display:"inline-flex",alignItems:"center",gap:7,borderRadius:12,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.18)",color:D?"var(--af-danger)":"#b91c1c",fontWeight:600,fontSize:13,padding:"10px 18px",cursor:"pointer"} as React.CSSProperties,
    th:{padding:"10px 14px",fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const,color:T.thClr,whiteSpace:"nowrap" as const,background:T.thBg,borderBottom:T.thBrd},
    td:{padding:"10px 14px",fontSize:12,verticalAlign:"middle" as const,borderTop:T.tdBrd,color:T.pageClr},
    thSub:{padding:"7px 10px",fontWeight:700,color:T.subThClr,textAlign:"left" as const,whiteSpace:"nowrap" as const,fontSize:10,textTransform:"uppercase" as const},
    tdSub:{padding:"7px 10px",fontSize:11,verticalAlign:"top" as const,borderTop:T.tdSubBrd,color:T.pageClr},
  };

  function SelCl({val,onChange,mini=false}:{val:ClassificacaoManual;onChange:(v:ClassificacaoManual)=>void;mini?:boolean}) {
    const cor=val?CLASSIFICACAO_COR[val]:T.accentDim;
    const optBg=D?"#031623":"var(--af-surface)";
    return <select value={val||""} onChange={e=>onChange((e.target.value as ClassificacaoManual)||null)} style={{background:val?`${cor}18`:T.inpBg,border:`1px solid ${val?cor+"55":D?"var(--af-border)":"rgba(39,199,216,0.22)"}`,borderRadius:8,color:cor,padding:mini?"3px 8px":"5px 10px",fontSize:mini?10:11,fontWeight:600,cursor:"pointer",outline:"none",minWidth:mini?120:150}}>
      <option value="" style={{background:optBg,color:T.accent}}>A classificar</option>
      {Object.entries(CLASSIFICACAO_LABEL).map(([v,lb])=><option key={v} value={v} style={{background:optBg,color:T.pageClr}}>{lb}</option>)}
    </select>;
  }

  function SelCfopEntrada({item}:{item:LinhaEntrada}) {
    if(item.tipo_nfe!=="terceiro") return <span style={{color:T.accentDim}}>—</span>;
    const opcoes = getOpcoesEntrada(item.cfop, item.sugestao.tipo, ehIndustrial);
    const valor = item.cfop_entrada_sugerido || opcoes[0]?.cfop || "";
    const optBg = D?"#031623":"var(--af-surface)";
    return (
      <div style={{display:"flex",flexDirection:"column" as const,gap:2,minWidth:110}}>
        <span style={{fontSize:9,color:T.accentDim,letterSpacing:"0.04em",textTransform:"uppercase" as const}}>
          {item.cfop} <span style={{color:"rgba(39,199,216,0.5)"}}>→</span>
        </span>
        <select value={valor} onChange={e=>setCfopEntrada(item.id,e.target.value)}
          style={{background:T.inpBg,border:`1px solid rgba(39,199,216,0.35)`,borderRadius:7,color:"var(--af-primary)",padding:"3px 6px",fontSize:11,fontWeight:700,cursor:"pointer",outline:"none"}}>
          {opcoes.map(o=>(
            <option key={o.cfop} value={o.cfop} style={{background:optBg,color:D?"var(--af-text)":"var(--af-text)"}}>
              {o.cfop} — {o.tipo}
            </option>
          ))}
          {!opcoes.length&&<option value={valor}>{valor||"—"}</option>}
        </select>
        {valor&&<span style={{fontSize:9,color:T.accentDim,lineHeight:1.3,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{descCFOP(valor)}</span>}
      </div>
    );
  }

  function Tg({st,cancelada}:{st:StatusValidacao;cancelada?:boolean}) {
    if(cancelada) return <span style={{display:"inline-flex",alignItems:"center",gap:4,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.3)",color:"#c4b5fd",whiteSpace:"nowrap" as const}}>🚫 CANCELADA</span>;
    const ok=st==="OK";
    return <span style={{display:"inline-flex",alignItems:"center",gap:4,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,background:ok?"rgba(34,197,94,0.10)":"rgba(251,191,36,0.10)",border:ok?"1px solid rgba(34,197,94,0.25)":"1px solid rgba(251,191,36,0.25)",color:ok?"#86efac":"var(--af-warning)",whiteSpace:"nowrap" as const}}>{ok?<CheckCircle2 size={10}/>:<AlertTriangle size={10}/>}{st}</span>;
  }

  const vazio=linhas.length===0&&saidas.length===0;

  // Tooltip de composição do valor contábil
  function ComposicaoValor({item}:{item:{valor_produto:number;valor_desconto:number;valor_frete:number;valor_despesas:number;valor_ipi_item:number;valor_contabil:number}}) {
    const temRateio = item.valor_frete>0 || item.valor_despesas>0 || item.valor_desconto>0 || item.valor_ipi_item>0;
    if (!temRateio) return <span>{fmoe(item.valor_contabil)}</span>;
    return (
      <div style={{position:"relative" as const}} className="comp-valor">
        <span style={{borderBottom:"1px dashed var(--af-muted)",cursor:"help",color:"var(--af-primary)"}}>
          {fmoe(item.valor_contabil)}
        </span>
        <div style={{position:"absolute" as const,bottom:"100%",left:0,zIndex:100,background:T.ttBg,border:T.ttBrd,borderRadius:10,padding:"10px 14px",minWidth:240,boxShadow:"0 8px 24px rgba(0,0,0,0.5)",pointerEvents:"none" as const,display:"none"}} className="comp-tooltip">
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6,opacity:0.75}}>Composição do valor</div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:3,fontSize:11}}>
            <div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:T.accentDim}}>Valor produto</span><span style={{color:T.pageClr}}>{fmoe(item.valor_produto)}</span></div>
            {item.valor_frete>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>+ Frete rateado</span><span style={{color:"#34d399"}}>+{fmoe(item.valor_frete)}</span></div>}
            {item.valor_despesas>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>+ Despesas rateadas</span><span style={{color:"#60a5fa"}}>+{fmoe(item.valor_despesas)}</span></div>}
            {item.valor_ipi_item>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>+ IPI</span><span style={{color:"#a78bfa"}}>+{fmoe(item.valor_ipi_item)}</span></div>}
            {item.valor_desconto>0&&<div style={{display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:"rgba(238,246,251,0.7)"}}>− Desconto rateado</span><span style={{color:"var(--af-warning)"}}>-{fmoe(item.valor_desconto)}</span></div>}
            <div style={{borderTop:T.thBrd,paddingTop:4,marginTop:2,display:"flex",justifyContent:"space-between" as const,gap:16}}><span style={{color:T.accent,fontWeight:700}}>Total contábil</span><span style={{color:T.pageClr,fontWeight:700}}>{fmoe(item.valor_contabil)}</span></div>
          </div>
        </div>
        <style>{".comp-valor:hover .comp-tooltip{display:block!important}"}</style>
      </div>
    );
  }

  // Agrupa XMLs pendentes por competência para o sumário do modal
  const xmlsAgrupados = (() => {
    const grupos = new Map<string, number>();
    xmlsPendentes.forEach(x => {
      if (x.dataEmissao) {
        const [ano, mes] = x.dataEmissao.split("-");
        grupos.set(`${mes}/${ano}`, (grupos.get(`${mes}/${ano}`) || 0) + 1);
      } else {
        grupos.set("Sem data", (grupos.get("Sem data") || 0) + 1);
      }
    });
    return Array.from(grupos.entries()).map(([comp, qtd]) => ({
      nome: `${qtd} NF-e${qtd > 1 ? "s" : ""}`,
      competencia: comp !== "Sem data" ? comp : undefined,
      qtdNotas: qtd,
    }));
  })();

  // CNPJ e nome da empresa analisada: prefere empresa já selecionada
  const cnpjEmpresaXml = empresa?.cnpj?.replace(/\D/g,"") || xmlsPendentes.find(x => x.tipoOperacao === "entrada")?.destinatarioCnpj || "";
  const nomeEmpresaXml = empresa?.razao_social || xmlsPendentes.find(x => x.tipoOperacao === "entrada")?.destinatarioNome || "";

  return (
    <main style={S.page}><div style={S.inner}>

      {/* Modal: seleção de CFOP de entrada — por nota, com contexto de fornecedor e produtos */}
      {modalCfopAberto && (
        <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.55)"}}>
          <div style={{background:D?"#0d1829":"#fff",border:D?"1px solid rgba(39,199,216,0.22)":"1px solid #e2e8f0",borderRadius:14,padding:"28px 32px",maxWidth:620,width:"calc(100% - 32px)",boxShadow:"0 24px 64px rgba(0,0,0,0.35)",display:"flex",flexDirection:"column" as const,maxHeight:"80vh"}}>
            <div style={{fontWeight:700,fontSize:16,color:D?"var(--af-text)":"#0f172a",marginBottom:4,flexShrink:0}}>Selecionar CFOP de Entrada</div>
            <p style={{fontSize:13,color:"var(--af-muted)",margin:"0 0 16px",lineHeight:1.5,flexShrink:0}}>
              Algumas notas têm CFOPs sem equivalente de entrada na tabela oficial. Selecione o CFOP de lançamento mais adequado para cada nota.
            </p>
            <div style={{display:"flex",flexDirection:"column" as const,gap:10,overflowY:"auto" as const,flex:1,paddingRight:4}}>
              {cfopMapeamento.map((item,idx)=>(
                <div key={`${item.nota}__${item.cfopForn}`} style={{background:D?"rgba(255,255,255,0.04)":"#f8fafc",border:D?"1px solid rgba(255,255,255,0.08)":"1px solid #e2e8f0",borderRadius:8,padding:"11px 14px"}}>
                  {/* Linha 1: Nota + Fornecedor */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" as const}}>
                    <span style={{fontWeight:700,fontSize:13,color:D?"var(--af-primary)":"var(--af-primary)"}}>NF {item.nota}</span>
                    <span style={{fontSize:12,color:D?"var(--af-text)":"#334155",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,maxWidth:260}}>{item.fornecedor}</span>
                  </div>
                  {/* Linha 2: CFOP do fornecedor */}
                  <div style={{fontSize:11,color:"var(--af-muted)",marginBottom:5}}>
                    CFOP fornecedor: <span style={{fontFamily:"monospace",fontWeight:600,color:D?"#f97316":"#c2410c"}}>{item.cfopForn}</span> — {descCFOP(item.cfopForn)}
                  </div>
                  {/* Linha 3: Produtos (até 3) */}
                  {item.produtos.length>0&&(
                    <div style={{fontSize:11,color:"var(--af-muted)",marginBottom:8,lineHeight:1.4}}>
                      {item.produtos.slice(0,3).join(" · ")}{item.produtos.length>3?" ...":""}
                    </div>
                  )}
                  {/* Dropdown seleção CFOP entrada */}
                  <div style={{marginTop:4}}>
                    <div style={{fontSize:11,color:"var(--af-muted)",marginBottom:4}}>→ CFOP de entrada:</div>
                    <select
                      value={item.cfopSel}
                      onChange={e=>{const v=e.target.value;setCfopMapeamento(prev=>prev.map((m,i)=>i===idx?{...m,cfopSel:v}:m));}}
                      style={{width:"100%",boxSizing:"border-box" as const,background:D?"#0a1020":"#fff",border:D?"1px solid rgba(39,199,216,0.25)":"1px solid #cbd5e1",borderRadius:6,color:D?"var(--af-text)":"#0f172a",fontSize:12,padding:"6px 8px",outline:"none"}}
                    >
                      {item.opcoes.map(o=>(
                        <option key={o.cfop} value={o.cfop}>{o.cfop} — {o.tipo} · {o.descricao.slice(0,50)}{o.descricao.length>50?"…":""}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end",flexShrink:0}}>
              <button onClick={()=>{setModalCfopAberto(false);pendingNe.current=[];pendingNs.current=[];pendingMeta.current=[];}} style={{background:"none",border:D?"1px solid rgba(255,255,255,0.12)":"1px solid #cbd5e1",borderRadius:7,color:"var(--af-muted)",fontSize:13,fontWeight:600,padding:"8px 18px",cursor:"pointer"}}>Cancelar</button>
              <button onClick={onConfirmarCfopModal} style={{background:"var(--af-primary)",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:700,padding:"8px 22px",cursor:"pointer"}}>Confirmar e continuar</button>
            </div>
          </div>
        </div>
      )}

      <ModalSessao
        aberto={modalAberto}
        cnpjEmpresa={cnpjEmpresaXml || undefined}
        nomeEmpresa={nomeEmpresaXml || undefined}
        competenciaArquivo={competenciaXml || undefined}
        arquivosDetectados={xmlsAgrupados}
        onConfirmar={onConfirmarSessaoXml}
        onCancelar={() => { setXmlsPendentes([]); setModalAberto(false); }}
      />

      {/* HEADER */}
      <div style={{...S.card,padding:"24px 28px",marginBottom:16}}>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:20,alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <a href="/" style={{fontSize:11,color:D?"var(--af-muted)":"#475569",textDecoration:"none",marginRight:4}}>← Início</a>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase" as const,color:D?"var(--af-primary)":"var(--af-primary)"}}>Validador Fiscal</div>
                <span style={{fontSize:10,fontWeight:700,background:D?"linear-gradient(135deg,var(--af-primary),#1a8fa0)":"linear-gradient(135deg,var(--af-primary),#2563eb)",color:"var(--af-surface)",borderRadius:20,padding:"2px 8px",letterSpacing:"0.04em"}}>v2.0</span>
                {sessaoAtual && (
                  <span style={{fontSize:10,fontWeight:700,background:D?"var(--af-primary-soft)":"#dbeafe",border:D?"1px solid rgba(39,199,216,0.25)":"1px solid #93c5fd",color:D?"var(--af-primary)":"var(--af-primary-hover)",borderRadius:20,padding:"2px 10px"}}>
                    {sessaoAtual.empresaNome} · {sessaoAtual.competencia}
                  </span>
                )}
              </div>
              {erroSalvar && (
                <div style={{fontSize:11,color:"var(--af-warning)",background:"rgba(255,150,50,0.08)",border:"1px solid rgba(255,150,50,0.2)",borderRadius:6,padding:"4px 10px",marginBottom:6}}>
                  {erroSalvar}
                </div>
              )}
              {salvouComSucesso && sessaoAtual && (
                <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(39,199,216,0.08)",border:"1px solid rgba(39,199,216,0.25)",borderRadius:8,padding:"8px 12px",marginBottom:8,flexWrap:"wrap" as const}}>
                  <CheckCircle2 size={14} style={{color:"var(--af-primary)",flexShrink:0}}/>
                  <span style={{fontSize:12,flex:1,color:D?"var(--af-text)":"#0f766e",fontWeight:500}}>
                    Sessão <strong>{sessaoAtual.competencia}</strong> salva — dados disponíveis na Apuração.
                  </span>
                  <button
                    onClick={()=>router.push(`/simples_nacional?aba=apuracao_sistema&competencia=${encodeURIComponent(sessaoAtual.competencia)}`)}
                    style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--af-primary)",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:600,fontSize:12,cursor:"pointer",whiteSpace:"nowrap" as const}}
                  >
                    Ver Apuração do Sistema →
                  </button>
                </div>
              )}
              <h1 style={{margin:0,fontSize:22,fontWeight:700,color:D?"var(--af-text)":T.pageClr,letterSpacing:-0.3}}>Validação de Entradas e Saídas</h1>
              <p style={{margin:"4px 0 0",fontSize:12,color:T.accentDim,lineHeight:1.5}}>Importe XMLs de NF-e para análise — entradas, saídas e benefícios fiscais (CBenef GO)</p>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,alignItems:"center"}}>
            <label style={{...S.bG,cursor:empresa?"pointer":"not-allowed",opacity:empresa?1:0.45,background:D?"rgba(39,199,216,0.07)":"rgba(10,102,116,0.07)",borderColor:D?"rgba(39,199,216,0.3)":"rgba(10,102,116,0.3)"}} title={empresa?"Importar XMLs de fornecedores (notas de entrada)":"Selecione uma empresa antes de importar"}>
              <ArrowDownLeft size={14}/>Terceiros (Entradas)
              <input ref={refXmlTerceiros} type="file" accept=".xml" multiple style={{display:"none"}} onChange={onXmlTerceiros} disabled={!empresa}/>
            </label>
            <label style={{...S.bG,cursor:empresa?"pointer":"not-allowed",opacity:empresa?1:0.45,background:D?"rgba(52,211,153,0.07)":"rgba(5,100,60,0.07)",borderColor:D?"rgba(52,211,153,0.25)":"rgba(5,100,60,0.25)",color:D?"#34d399":"#156543"}} title={empresa?"Importar XMLs emitidos pela própria empresa (notas de saída)":"Selecione uma empresa antes de importar"}>
              <ArrowUpRight size={14}/>Próprios (Saídas)
              <input ref={refXmlProprio} type="file" accept=".xml" multiple style={{display:"none"}} onChange={onXmlProprio} disabled={!empresa}/>
            </label>
            <button type="button" onClick={()=>exportExcel(nf,saidas,null)} disabled={vazio} style={{...S.bG,opacity:vazio?0.35:1,cursor:vazio?"not-allowed":"pointer"}}><Download size={14}/>Exportar Excel</button>
            <button type="button" onClick={limpar} style={S.bD}><Trash2 size={14}/>Limpar</button>
            {sessaoAtual && (
              <button type="button" onClick={limparCompetenciaDb} disabled={limpandoDb}
                style={{...S.bD,background:"rgba(239,68,68,0.08)",color:"var(--af-danger)",borderColor:"rgba(239,68,68,0.2)",opacity:limpandoDb?0.6:1,cursor:limpandoDb?"wait":"pointer"}}>
                <Trash2 size={14}/>{limpandoDb?`Limpando…`:`Limpar ${sessaoAtual.competencia}`}
              </button>
            )}
          </div>
        </div>

        {/* CARD: EMPRESA EM ANÁLISE */}
        <div style={{...S.card,padding:"14px 20px",marginBottom:12,display:"flex",alignItems:"center",gap:14,position:"relative" as const}}>
          <div style={{fontSize:11,fontWeight:700,color:D?"var(--af-muted)":"var(--af-muted)",textTransform:"uppercase" as const,letterSpacing:"0.08em",flexShrink:0}}>
            Empresa em análise
          </div>
          {empresa ? (
            <>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:13,fontWeight:700,color:D?"var(--af-text)":"var(--af-text)"}}>{empresa.razao_social}</span>
                {empresa.cnpj && <span style={{fontSize:11,color:D?"var(--af-muted)":"var(--af-muted)",marginLeft:10}}>{empresa.cnpj}</span>}
              </div>
              <button type="button" onClick={()=>setMostrarSeletorEmpresa(v=>!v)}
                style={{fontSize:11,fontWeight:600,color:"rgba(39,199,216,0.7)",background:"none",border:"1px solid rgba(39,199,216,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>
                Trocar
              </button>
            </>
          ) : (
            <div style={{flex:1,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:"var(--af-muted)"}}>Nenhuma empresa selecionada — selecione para identificar o tipo das NF-es</span>
              <button type="button" onClick={()=>setMostrarSeletorEmpresa(true)}
                style={{fontSize:11,fontWeight:700,color:"var(--af-primary)",background:"var(--af-primary-soft)",border:"1px solid rgba(39,199,216,0.25)",borderRadius:6,padding:"5px 12px",cursor:"pointer"}}>
                Selecionar empresa
              </button>
            </div>
          )}
          {/* Sessões anteriores */}
          {empresa && sessoesSalvas.length > 0 && (
            <div style={{marginLeft:"auto",flexShrink:0}}>
              <button type="button"
                onClick={()=>setSessaoExpandida(v=>!v)}
                style={{fontSize:11,fontWeight:600,color:"rgba(39,199,216,0.8)",background:"rgba(39,199,216,0.07)",border:"1px solid rgba(39,199,216,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                {carregandoSessoes ? "…" : `${sessoesSalvas.length} sessão(ões) salva(s)`}
                <span style={{fontSize:9,opacity:0.7}}>{sessaoExpandida?"▲":"▼"}</span>
              </button>
              {sessaoExpandida && (
                <div style={{position:"absolute" as const,top:"100%",right:0,zIndex:300,background:"#071b2a",border:"1px solid rgba(39,199,216,0.2)",borderRadius:10,padding:"8px",minWidth:260,boxShadow:"0 12px 32px rgba(0,0,0,0.5)",marginTop:4}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--af-muted)",textTransform:"uppercase" as const,letterSpacing:"0.08em",padding:"4px 8px 6px"}}>Reabrir sessão anterior</div>
                  {sessoesSalvas.map(s=>{
                    const qtdXml = s.xmls?.[0]?.count ?? 0;
                    return (
                      <button key={s.id} type="button"
                        onClick={()=>carregarSessaoAnterior(s)}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:sessaoAtual?.sessaoId===s.id?"var(--af-primary-soft)":"transparent",border:"none",borderRadius:6,padding:"7px 10px",cursor:"pointer",gap:8,marginBottom:2,color:"var(--af-text)",fontSize:12}}
                        onMouseEnter={ev=>(ev.currentTarget.style.background="var(--af-primary-soft)")}
                        onMouseLeave={ev=>(ev.currentTarget.style.background=sessaoAtual?.sessaoId===s.id?"var(--af-primary-soft)":"transparent")}>
                        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-start",gap:2}}>
                          <span style={{fontWeight:600,color:"var(--af-primary)"}}>{s.competencia}</span>
                          {qtdXml > 0 && <span style={{fontSize:10,color:"var(--af-muted)"}}>{qtdXml} XML{qtdXml!==1?"s":""}</span>}
                        </div>
                        <span style={{fontSize:10,color:"var(--af-muted)",flexShrink:0}}>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Dropdown de seleção inline */}
          {mostrarSeletorEmpresa && (
            <div style={{position:"absolute" as const,top:"100%",right:0,zIndex:200,background:"#071b2a",border:"1px solid rgba(39,199,216,0.2)",borderRadius:10,padding:"12px",minWidth:300,boxShadow:"0 12px 32px rgba(0,0,0,0.5)"}}>
              {carregandoEmpresas ? (
                <div style={{fontSize:12,color:D?"var(--af-muted)":"var(--af-muted)"}}>Carregando...</div>
              ) : listaEmpresas.length === 0 ? (
                <div style={{fontSize:12,color:"var(--af-muted)"}}>Nenhuma empresa cadastrada.<br/><a href="/empresas" style={{color:"var(--af-primary)"}}>Cadastrar empresa →</a></div>
              ) : (
                listaEmpresas.map(e=>(
                  <div key={e.id} onClick={()=>{definirEmpresaAtiva(e);setMostrarSeletorEmpresa(false);}}
                    style={{padding:"8px 10px",borderRadius:6,cursor:"pointer",fontSize:12,color:D?"var(--af-text)":"var(--af-text)",display:"flex",flexDirection:"column" as const,gap:2,
                      background:empresa?.id===e.id?"var(--af-primary-soft)":"transparent",marginBottom:2}}
                    onMouseEnter={ev=>(ev.currentTarget.style.background="var(--af-primary-soft)")}
                    onMouseLeave={ev=>(ev.currentTarget.style.background=empresa?.id===e.id?"var(--af-primary-soft)":"transparent")}>
                    <span style={{fontWeight:600}}>{e.razao_social}</span>
                    {e.cnpj && <span style={{fontSize:10,color:"var(--af-muted)"}}>{e.cnpj}</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ENTRADAS */}
        <div style={{marginTop:16}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase" as const,color:D?"var(--af-muted)":"rgba(10,102,116,0.4)",marginBottom:8,display:"flex",alignItems:"center",gap:5}}><ArrowDownLeft size={11}/>Entradas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[{lb:"Notas",v:res.totalNotas,sub:`${res.totalItens} itens`,cor:"var(--af-primary)"},{lb:"Notas OK",v:res.totalNotas-res.notasAlerta,sub:"sem alertas",cor:"#86efac"},{lb:"Com Alerta",v:res.notasAlerta,sub:"revisar",cor:"var(--af-warning)"},{lb:"Valor Total",v:fmoe(res.totalValor),sub:"entradas",cor:"var(--af-primary)"},{lb:"ICMS",v:fmoe(res.totalIcms),sub:"a conferir",cor:"#a78bfa"}].map(s=>(
              <div key={s.lb} style={{borderRadius:14,background:T.statBg,border:T.statBrd,padding:"12px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.07em",color:T.accent,marginBottom:4,opacity:0.75}}>{s.lb}</div>
                <div style={{fontSize:18,fontWeight:700,color:s.cor,lineHeight:1.2}}>{s.v}</div>
                <div style={{fontSize:10,color:T.statDim,marginTop:2}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
        {/* SAIDAS — aparece apenas quando ha XMLs de saida */}
        {saidas.length>0&&<div style={{marginTop:14}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase" as const,color:"rgba(52,211,153,0.5)",marginBottom:8,display:"flex",alignItems:"center",gap:5}}><ArrowUpRight size={11}/>Saidas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[
              {lb:"Notas",v:new Set(saidas.map(i=>`${i.numero_nota}__${i.destinatario}`)).size,sub:`${saidas.length} itens`,cor:"#34d399"},
              {lb:"Com Alerta",v:saidas.filter(i=>i.status==="ALERTA").length,sub:"verificar",cor:saidas.filter(i=>i.status==="ALERTA").length>0?"var(--af-warning)":"#86efac"},
              {lb:"Valor Total",v:fmoe(totalSaidasVnf),sub:"saidas",cor:"#34d399"},
              {lb:"ICMS",v:fmoe(saidas.reduce((a,i)=>a+i.valor_icms,0)),sub:"destacado",cor:"#a78bfa"},
              {lb:"PIS + COFINS",v:fmoe(saidas.reduce((a,i)=>a+i.valor_pis+i.valor_cofins,0)),sub:`${saidas.filter(i=>i.cbenef&&i.cbenef!=="SEM CBENEF").length} com CBenef`,cor:"#60a5fa"},
            ].map(s=>(
              <div key={s.lb} style={{borderRadius:14,background:D?"rgba(52,211,153,0.03)":"rgba(52,211,153,0.06)",border:D?"1px solid rgba(52,211,153,0.1)":"1px solid rgba(52,211,153,0.2)",padding:"12px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.07em",color:D?"rgba(52,211,153,0.55)":"rgba(5,100,60,0.7)",marginBottom:4}}>{s.lb}</div>
                <div style={{fontSize:18,fontWeight:700,color:s.cor,lineHeight:1.2}}>{s.v}</div>
                <div style={{fontSize:10,color:D?"rgba(52,211,153,0.35)":"rgba(5,100,60,0.45)",marginTop:2}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>}

        {empresa&&<div style={{marginTop:14,display:"flex",flexWrap:"wrap" as const,gap:20,background:D?"var(--af-primary-soft)":"var(--af-primary-soft)",border:D?"1px solid rgba(127,221,228,0.09)":"1px solid var(--af-border)",borderRadius:14,padding:"12px 18px",fontSize:12}}>
          <div><span style={{color:T.accentDim}}>Empresa: </span><strong style={{color:T.pageClr}}>{empresa.razao_social}</strong></div>
          <div><span style={{color:T.accentDim}}>CNPJ: </span><strong style={{color:T.pageClr}}>{empresa.cnpj ? fcnpj(empresa.cnpj) : "—"}</strong></div>
          <div><span style={{color:T.accentDim}}>Tipo: </span><strong style={{color:ehIndustrial?"var(--af-success)":T.pageClr}}>{ehIndustrial?"Industrial/Equiparado":"Comércio/Serviço"}</strong></div>
        </div>}
        {erro&&<div style={{marginTop:12,background:D?"rgba(239,68,68,0.07)":"rgba(239,68,68,0.07)",border:D?"1px solid rgba(239,68,68,0.18)":"1px solid rgba(200,30,30,0.25)",borderRadius:10,padding:"10px 16px",fontSize:13,color:D?"var(--af-danger)":"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}><FileX size={15} style={{flexShrink:0,marginTop:1}}/>{erro}</div>}
        {infoCanc&&<div style={{marginTop:10,background:D?"rgba(167,139,250,0.07)":"rgba(130,100,250,0.08)",border:D?"1px solid rgba(167,139,250,0.22)":"1px solid rgba(100,70,200,0.25)",borderRadius:10,padding:"10px 16px",fontSize:13,color:D?"#c4b5fd":"#5b2dcc",display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{fontSize:16,flexShrink:0}}>⚠</span>
          <span style={{flex:1,whiteSpace:"pre-line" as const,lineHeight:1.55}}>{infoCanc}</span>
          <button onClick={()=>setInfoCanc("")} style={{flexShrink:0,background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:16,lineHeight:1,padding:"0 2px",opacity:0.7}} title="Fechar">×</button>
        </div>}
      </div>

      {/* MÓDULOS */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {([["entradas","Entradas",<ArrowDownLeft size={14}/>],["saidas","Saídas",<ArrowUpRight size={14}/>],["cfop","Resumo CFOP",<Tag size={14}/>]] as const).map(([m,lb,ic])=>(
          <button key={m} type="button" onClick={()=>setModulo(m as "entradas"|"saidas")} style={{display:"flex",alignItems:"center",gap:7,padding:"10px 22px",borderRadius:12,fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:modulo===m?D?"var(--af-primary-soft)":"var(--af-primary-soft)":D?"rgba(255,255,255,0.04)":"var(--af-primary-soft)",color:modulo===m?T.accent:T.accentDim,borderBottom:modulo===m?"2px solid var(--af-primary)":"2px solid transparent"}}>
            {ic}{lb} {m==="entradas"?`(${linhas.length} itens)`:m==="saidas"?`(${saidas.length} itens)`:``}
          </button>
        ))}
      </div>

      {/* ═══════════════════ ENTRADAS ═══════════════════ */}
      {modulo==="entradas"&&<>
        <div style={{...S.card,padding:"18px 24px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,color:T.accent,fontWeight:700,fontSize:12,letterSpacing:"0.06em",textTransform:"uppercase" as const}}><Filter size={13}/>Filtros e Configurações</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
            <div style={{position:"relative" as const}}><Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--af-primary)",opacity:0.5}}/><input value={filtros.busca} onChange={e=>setFiltros(f=>({...f,busca:e.target.value}))} placeholder="Nota, fornecedor, descrição..." style={{...S.inp,paddingLeft:30}}/></div>
            <input value={filtros.cfop} onChange={e=>setFiltros(f=>({...f,cfop:e.target.value}))} placeholder="CFOP" style={S.inp}/>
            <input value={filtros.ncm} onChange={e=>setFiltros(f=>({...f,ncm:e.target.value}))} placeholder="NCM" style={S.inp}/>
            {/* Filtro classificação — agora inclui "Não classificado" */}
            <select value={filtros.classificacao} onChange={e=>setFiltros(f=>({...f,classificacao:e.target.value}))} style={S.inp}>
              <option value="">Todas as classificações</option>
              <option value="nao_classificado" style={{background:"#031623",color:"#facc15"}}>⚠ Não classificado ({res.naoClassificados})</option>
              {Object.entries(CLASSIFICACAO_LABEL).map(([v,lb])=><option key={v} value={v} style={{background:"#031623"}}>{lb}</option>)}
            </select>
            <select value={perfil} onChange={e=>changePerfil(e.target.value as PerfilEmpresa)} style={S.inp}>{Object.entries(PERFIS_EMPRESA_LABEL).map(([v,lb])=><option key={v} value={v} style={{background:"#031623"}}>{lb}</option>)}</select>
            <label style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:T.accent,cursor:"pointer",background:D?"rgba(255,255,255,0.04)":"rgba(10,102,116,0.05)",border:D?"1px solid rgba(127,221,228,0.13)":"1px solid rgba(10,102,116,0.18)",borderRadius:10,padding:"8px 12px",whiteSpace:"nowrap" as const}}><input type="checkbox" checked={filtros.somenteAlertas} onChange={e=>setFiltros(f=>({...f,somenteAlertas:e.target.checked}))} style={{accentColor:"var(--af-primary)"}}/>Só alertas</label>
          </div>
        </div>

        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {(["notas","itens"] as const).map(a=>(
            <button key={a} type="button" onClick={()=>setAbaE(a)} style={{padding:"8px 20px",borderRadius:"12px 12px 0 0",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:abaE===a?D?"var(--af-primary-soft)":"var(--af-primary-soft)":D?"rgba(255,255,255,0.03)":"var(--af-primary-soft)",color:abaE===a?T.accent:T.accentDim,borderBottom:abaE===a?"2px solid var(--af-primary)":"2px solid transparent"}}>
              {a==="notas"?`Por Nota (${nf.length})`:`Por Produto (${ifs.length})`}
            </button>
          ))}
        </div>

        {/* TABELA NOTAS ENTRADA */}
        {abaE==="notas"&&<div style={{...S.card,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
              <thead><tr><th style={{...S.th,width:32}}></th>{["Nota","Data","Fornecedor","Itens","Valor","Base ICMS","ICMS","Classificação","Sugestões","Alertas","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!nf.length?<tr><td colSpan={12} style={{padding:"60px 20px",textAlign:"center",color:D?"var(--af-muted)":"rgba(10,102,116,0.4)",fontSize:14}}>{linhas.length===0?"Importe um SPED ou XMLs para iniciar.":"Nenhuma nota corresponde aos filtros."}</td></tr>
                :nf.map(nota=>{const exp=expandidas.has(nota.chave);return(
                  <React.Fragment key={nota.chave}>
                    <tr style={{background:nota.itens.some(i=>i.cancelada)?D?"rgba(167,139,250,0.04)":"rgba(167,139,250,0.08)":nota.status==="OK"?D?"rgba(34,197,94,0.025)":"rgba(34,197,94,0.06)":D?"rgba(251,191,36,0.04)":"rgba(251,191,36,0.09)"}}>
                      <td style={{...S.td,textAlign:"center" as const,cursor:"pointer"}} onClick={()=>toggleE(nota.chave)}>{exp?<ChevronDown size={14} color="var(--af-primary)"/>:<ChevronRight size={14} color="var(--af-muted)"/>}</td>
                      <td style={{...S.td,fontWeight:700,color:D?"var(--af-text)":T.pageClr}}>{nota.numero_nota}</td>
                      <td style={{...S.td,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{nota.data}</td>
                      <td style={{...S.td,maxWidth:260,color:T.pageClr}}>{nota.fornecedor}</td>
                      <td style={{...S.td,textAlign:"center" as const,color:"var(--af-primary)"}}>{nota.total_itens}</td>
                      <td style={S.td}>{fmoe(nota.total_contabil)}</td>
                      <td style={S.td}>{fmoe(nota.total_base_icms)}</td>
                      <td style={S.td}>{fmoe(nota.total_valor_icms)}</td>
                      <td style={S.td}><SelCl val={nota.classificacaoPredominante} onChange={v=>setClassNota(nota.chave,v)}/></td>
                      <td style={S.td}><div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>{nota.sugestoes.length?nota.sugestoes.map((s,i)=><span key={i} style={{background:D?"rgba(39,199,216,0.09)":"rgba(10,102,116,0.10)",border:D?"1px solid var(--af-border)":"1px solid rgba(10,102,116,0.25)",borderRadius:20,padding:"2px 9px",fontSize:11,color:T.accent}}>{s}</span>):<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</div></td>
                      <td style={S.td}><div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>{nota.avisos.filter(a=>a!=="Sem inconsistências.").slice(0,2).map((a,i)=><span key={i} style={{background:D?"rgba(251,191,36,0.07)":"rgba(180,120,0,0.09)",border:D?"1px solid rgba(251,191,36,0.16)":"1px solid rgba(180,120,0,0.25)",borderRadius:20,padding:"2px 9px",fontSize:11,color:D?"var(--af-warning)":"#7a5000"}}>{a.slice(0,55)}{a.length>55?"…":""}</span>)}{!nota.avisos.filter(a=>a!=="Sem inconsistências.").length&&<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</div></td>
                      <td style={S.td}><Tg st={nota.status} cancelada={nota.itens.every(i=>i.cancelada)}/></td>
                    </tr>
                    {exp&&<tr style={{background:"rgba(5,18,28,0.6)"}}><td colSpan={12} style={{padding:"0 12px 12px 44px"}}>
                      <div style={{borderRadius:12,background:"rgba(39,199,216,0.03)",border:"1px solid rgba(127,221,228,0.09)",overflow:"hidden",marginTop:6}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr style={{background:"rgba(5,18,28,0.7)"}}>{["Cód.","Descrição","NCM","CFOP Forn.","CFOP Entrada","CST","Valor","Base ICMS","Alíq.","ICMS","Classificação","Sugestão","Status"].map(h=><th key={h} style={S.thSub}>{h}</th>)}</tr></thead>
                          <tbody>{nota.itens.map(item=>(
                            <tr key={item.id}>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.6)":T.accentDim}}>{item.codigo_produto||"—"}</td>
                              <td style={{...S.tdSub,maxWidth:260,color:T.pageClr,lineHeight:1.4}}>{item.descricao}</td>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{item.ncm||"—"}</td>
                              <td style={{...S.tdSub,color:T.accent,fontWeight:600}}>{item.cfop}</td>
                              <td style={S.tdSub}><SelCfopEntrada item={item}/></td>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{item.cst_icms||"—"}</td>
                              <td style={S.tdSub}><ComposicaoValor item={item}/></td>
                              <td style={S.tdSub}>{fmoe(item.base_icms)}</td>
                              <td style={S.tdSub}>{fperc(item.aliquota_icms)}</td>
                              <td style={S.tdSub}>{fmoe(item.valor_icms)}</td>
                              <td style={S.tdSub}><SelCl val={item.classificacao} onChange={v=>setClass(item.id,v)} mini/></td>
                              <td style={S.tdSub}>{item.sugestao.tipo?<div style={{background:D?"var(--af-primary-soft)":"rgba(10,102,116,0.07)",border:D?"1px solid var(--af-border)":"1px solid rgba(10,102,116,0.2)",borderRadius:7,padding:"4px 8px",lineHeight:1.4}}><div style={{fontWeight:700,color:T.accent,fontSize:10}}>{item.sugestao.tipo==="uso_consumo"?"Possível UC":item.sugestao.tipo==="imobilizado"?"Possível Imobilizado":"Possível Combustível"}</div><div style={{color:T.accentDim,fontSize:10,marginTop:1}}>{item.sugestao.motivo}</div></div>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}><Tg st={item.status} cancelada={item.cancelada}/></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </td></tr>}
                  </React.Fragment>
                );})}
              </tbody>
            </table>
          </div>
        </div>}

        {/* TABELA ITENS ENTRADA — expandível */}
        {abaE==="itens"&&<div style={{...S.card,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
              <thead><tr>
                <th style={{...S.th,width:32}}></th>
                {["Nota","Data","Fornecedor","Descrição","CFOP Entrada","Valor","Classificação","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {!ifs.length
                  ?<tr><td colSpan={9} style={{padding:"60px 20px",textAlign:"center",color:D?"var(--af-muted)":"rgba(10,102,116,0.4)",fontSize:14}}>{linhas.length===0?"Importe um SPED ou XMLs para iniciar.":"Nenhum item corresponde aos filtros."}</td></tr>
                  :ifs.map(item=>{
                    const exp=expandidasI.has(item.id);
                    const rowBg=item.cancelada?D?"rgba(167,139,250,0.05)":"rgba(167,139,250,0.08)":item.status==="ALERTA"?D?"rgba(251,191,36,0.03)":"rgba(251,191,36,0.08)":"transparent";
                    return(
                    <React.Fragment key={item.id}>
                      <tr style={{background:rowBg,opacity:item.cancelada?0.65:1,textDecoration:item.cancelada?"line-through":"none"}}>
                        <td style={{...S.td,textAlign:"center" as const,cursor:"pointer"}} onClick={()=>toggleI(item.id)}>
                          {exp?<ChevronDown size={14} color="var(--af-primary)"/>:<ChevronRight size={14} color="var(--af-muted)"/>}
                        </td>
                        <td style={{...S.td,fontWeight:700,color:D?"var(--af-text)":T.pageClr}}>{item.numero_nota}</td>
                        <td style={{...S.td,color:D?"rgba(238,246,251,0.7)":T.accentDim,whiteSpace:"nowrap" as const}}>{item.data}</td>
                        <td style={{...S.td,maxWidth:180,overflow:"hidden" as const,textOverflow:"ellipsis",whiteSpace:"nowrap" as const,color:T.pageClr}}>{item.fornecedor}</td>
                        <td style={{...S.td,maxWidth:240,overflow:"hidden" as const,textOverflow:"ellipsis",whiteSpace:"nowrap" as const,color:T.pageClr}}>{item.descricao}</td>
                        <td style={S.td}><SelCfopEntrada item={item}/></td>
                        <td style={S.td}><ComposicaoValor item={item}/></td>
                        <td style={S.td}><SelCl val={item.classificacao} onChange={v=>setClass(item.id,v)} mini/></td>
                        <td style={S.td}><Tg st={item.status} cancelada={item.cancelada}/></td>
                      </tr>
                      {exp&&<tr style={{background:D?"rgba(5,18,28,0.6)":"rgba(240,249,251,0.8)"}}>
                        <td colSpan={9} style={{padding:"0 12px 12px 44px"}}>
                          <div style={{borderRadius:10,background:D?"rgba(39,199,216,0.03)":"rgba(10,102,116,0.04)",border:D?"1px solid rgba(127,221,228,0.09)":"1px solid rgba(10,102,116,0.12)",padding:"12px 14px",marginTop:6}}>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"8px 20px",fontSize:11}}>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>Cód. Produto</span><span style={{color:T.pageClr,fontWeight:600}}>{item.codigo_produto||"—"}</span></div>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>NCM</span><span style={{color:T.pageClr,fontWeight:600}}>{item.ncm||"—"}</span></div>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>CFOP Fornecedor</span><span style={{color:T.accent,fontWeight:700}}>{item.cfop}</span></div>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>CST ICMS</span><span style={{color:T.pageClr,fontWeight:600}}>{item.cst_icms||"—"}</span></div>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>Base ICMS</span><span style={{color:T.pageClr,fontWeight:600}}>{fmoe(item.base_icms)}</span></div>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>Alíquota</span><span style={{color:T.pageClr,fontWeight:600}}>{fperc(item.aliquota_icms)}</span></div>
                              <div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>ICMS</span><span style={{color:T.pageClr,fontWeight:600}}>{fmoe(item.valor_icms)}</span></div>
                              {item.sugestao.tipo&&<div><span style={{color:T.accentDim,display:"block",marginBottom:2}}>Sugestão</span><span style={{display:"inline-flex",alignItems:"center",gap:4,background:D?"var(--af-primary-soft)":"rgba(10,102,116,0.08)",border:D?"1px solid var(--af-border)":"1px solid rgba(10,102,116,0.2)",borderRadius:20,padding:"2px 10px",color:T.accent}}><Tag size={9}/>{item.sugestao.tipo==="uso_consumo"?"UC":item.sugestao.tipo==="imobilizado"?"Imobilizado":"Combustível"}</span></div>}
                            </div>
                            {item.avisos.filter(a=>a!=="Sem inconsistências.").length>0&&(
                              <div style={{marginTop:10,display:"flex",flexWrap:"wrap" as const,gap:4}}>
                                {item.avisos.filter(a=>a!=="Sem inconsistências.").map((a,i)=>(
                                  <span key={i} style={{background:D?"rgba(251,191,36,0.07)":"rgba(180,120,0,0.09)",border:D?"1px solid rgba(251,191,36,0.16)":"1px solid rgba(180,120,0,0.25)",borderRadius:6,padding:"3px 10px",fontSize:11,color:D?"var(--af-warning)":"#7a5000"}}>{a}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>}
                    </React.Fragment>
                  );})}
              </tbody>
            </table>
          </div>
          {ifs.length>0&&<div style={{padding:"12px 20px",fontSize:11,color:T.statDim,borderTop:T.tdBrd,display:"flex",justifyContent:"space-between" as const,background:D?"transparent":"#f5fbfc"}}><span>{ifs.length} itens exibidos — {res.naoClassificados} sem classificação</span><span style={{opacity:0.5}}>Enfokus Validador Fiscal v2.0</span></div>}
        </div>}
      </>}

      {/* ═══════════════════ SAÍDAS ═══════════════════ */}
      {modulo==="saidas"&&<>
        <div style={{...S.card,padding:"18px 24px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,color:T.accent,fontWeight:700,fontSize:12,letterSpacing:"0.06em",textTransform:"uppercase" as const}}><Filter size={13}/>Filtros — Saídas</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr auto",gap:10,alignItems:"end"}}>
            <div style={{position:"relative" as const}}><Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--af-primary)",opacity:0.5}}/><input value={buscaS} onChange={e=>setBuscaS(e.target.value)} placeholder="Nota, destinatário, descrição, NCM, CBenef..." style={{...S.inp,paddingLeft:30}}/></div>
            <label style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:T.accent,cursor:"pointer",background:D?"rgba(255,255,255,0.04)":"rgba(10,102,116,0.05)",border:D?"1px solid rgba(127,221,228,0.13)":"1px solid rgba(10,102,116,0.18)",borderRadius:10,padding:"8px 12px",whiteSpace:"nowrap" as const}}><input type="checkbox" checked={soAlerS} onChange={e=>setSoAlerS(e.target.checked)} style={{accentColor:"var(--af-primary)"}}/>Só alertas</label>
          </div>
        </div>



        {/* TABELA NOTAS SAÍDA — agrupada com expansão */}
        <div style={{...S.card,overflow:"hidden"}}>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
              <thead><tr>
                <th style={{...S.th,width:32}}></th>
                {["Nota","Data","Destinatário","Itens","Valor Total","ICMS","PIS","COFINS","IBS","CBS","CBenef","Alertas","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {!notasSaida.length?<tr><td colSpan={14} style={{padding:"60px 20px",textAlign:"center",color:D?"var(--af-muted)":"rgba(10,102,116,0.4)",fontSize:14}}>{saidas.length===0?"Importe XMLs de NF-e de saída para analisar.":"Nenhuma nota corresponde aos filtros."}</td></tr>
                :notasSaida.map(nota=>{const exp=expandidasS.has(nota.chave);const notaCancS=nota.itens.every(i=>i.cancelada);return(
                  <React.Fragment key={nota.chave}>
                    <tr style={{background:notaCancS?D?"rgba(167,139,250,0.04)":"rgba(167,139,250,0.08)":nota.status==="OK"?D?"rgba(34,197,94,0.025)":"rgba(34,197,94,0.06)":D?"rgba(251,191,36,0.04)":"rgba(251,191,36,0.09)"}}>
                      <td style={{...S.td,textAlign:"center" as const,cursor:"pointer"}} onClick={()=>toggleS(nota.chave)}>{exp?<ChevronDown size={14} color="var(--af-primary)"/>:<ChevronRight size={14} color="var(--af-muted)"/>}</td>
                      <td style={{...S.td,fontWeight:700,color:D?"var(--af-text)":T.pageClr}}>{nota.numero_nota}</td>
                      <td style={{...S.td,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{nota.data}</td>
                      <td style={{...S.td,maxWidth:240,color:T.pageClr}}>{nota.destinatario}</td>
                      <td style={{...S.td,textAlign:"center" as const,color:"var(--af-primary)"}}>{nota.total_itens}</td>
                      <td style={S.td}>{fmoe(nota.total_contabil)}</td>
                      <td style={S.td}>{fmoe(nota.total_icms)}</td>
                      <td style={S.td}>{fmoe(nota.total_pis)}</td>
                      <td style={S.td}>{fmoe(nota.total_cofins)}</td>
                      <td style={S.td}>{nota.total_ibs>0?<span style={{color:"#34d399",fontWeight:600}}>{fmoe(nota.total_ibs)}</span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                      <td style={S.td}>{nota.total_cbs>0?<span style={{color:"#60a5fa",fontWeight:600}}>{fmoe(nota.total_cbs)}</span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                      <td style={S.td}>{nota.tem_cbenef?<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:8,padding:"3px 9px",fontSize:11,color:"#a78bfa"}}>Sim</span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</td>
                      <td style={S.td}><div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>{nota.alertas.length?nota.alertas.slice(0,2).map((a,i)=><span key={i} style={{background:D?"rgba(251,191,36,0.07)":"rgba(180,120,0,0.09)",border:D?"1px solid rgba(251,191,36,0.16)":"1px solid rgba(180,120,0,0.25)",borderRadius:20,padding:"2px 9px",fontSize:11,color:D?"var(--af-warning)":"#7a5000"}}>{a.slice(0,50)}{a.length>50?"…":""}</span>):<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)",fontSize:11}}>—</span>}</div></td>
                      <td style={S.td}><Tg st={nota.status} cancelada={notaCancS}/></td>
                    </tr>
                    {exp&&<tr style={{background:"rgba(5,18,28,0.6)"}}><td colSpan={14} style={{padding:"0 12px 12px 44px"}}>
                      <div style={{borderRadius:12,background:"rgba(39,199,216,0.03)",border:"1px solid rgba(127,221,228,0.09)",overflow:"hidden",marginTop:6}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr style={{background:"rgba(5,18,28,0.7)"}}>{["Cód.","Descrição","NCM","CFOP","CST","CST PIS","Valor","ICMS","Alíq.","ICMS-ST","IPI","PIS","COFINS","IBS","CBS","CBenef","Benefício Fiscal","Status"].map(h=><th key={h} style={S.thSub}>{h}</th>)}</tr></thead>
                          <tbody>{nota.itens.map(item=>(
                            <tr key={item.id} style={{borderTop:"1px solid rgba(127,221,228,0.05)",background:item.cancelada?D?"rgba(167,139,250,0.04)":"rgba(167,139,250,0.08)":"transparent",opacity:item.cancelada?0.7:1,textDecoration:item.cancelada?"line-through":"none"}}>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.6)":T.accentDim}}>{item.codigo_produto||"—"}</td>
                              <td style={{...S.tdSub,maxWidth:240,color:T.pageClr,lineHeight:1.4}}>{item.descricao}</td>
                              <td style={{...S.tdSub,color:D?"rgba(238,246,251,0.7)":T.accentDim}}>{item.ncm||"—"}</td>
                              <td style={{...S.tdSub,color:T.accent,fontWeight:600}}>{item.cfop}</td>
                              <td style={S.tdSub}>{item.cst_icms||"—"}</td>
                              <td style={S.tdSub}>{item.cst_pis||"—"}</td>
                              <td style={S.tdSub}><ComposicaoValor item={item}/></td>
                              <td style={S.tdSub}>{fmoe(item.valor_icms)}</td>
                              <td style={S.tdSub}>{fperc(item.aliquota_icms)}</td>
                              <td style={S.tdSub}>{item.valor_st>0?fmoe(item.valor_st):<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{item.valor_ipi>0?fmoe(item.valor_ipi):<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{fmoe(item.valor_pis)}</td>
                              <td style={S.tdSub}>{fmoe(item.valor_cofins)}</td>
                              <td style={S.tdSub}>{item.valor_ibs>0?<span style={{color:"#34d399",fontWeight:600}}>{fmoe(item.valor_ibs)}</span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{item.valor_cbs>0?<span style={{color:"#60a5fa",fontWeight:600}}>{fmoe(item.valor_cbs)}</span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={S.tdSub}>{item.cbenef?<span title={item.cbenef_descricao} style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(167,139,250,0.10)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:7,padding:"2px 8px",fontSize:10,color:"#a78bfa",cursor:"help"}}>{item.cbenef}<Info size={8} style={{opacity:0.7}}/></span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)"}}>—</span>}</td>
                              <td style={{...S.tdSub,maxWidth:200}}>{item.cbenef_descricao?<span style={{fontSize:10,color:"rgba(238,246,251,0.6)",lineHeight:1.4}}>{item.cbenef_descricao.slice(0,70)}{item.cbenef_descricao.length>70?"…":""}</span>:<span style={{color:D?"var(--af-muted)":"rgba(10,102,116,0.35)",fontSize:10}}>—</span>}</td>
                              <td style={S.tdSub}><Tg st={item.status} cancelada={item.cancelada}/></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </td></tr>}
                  </React.Fragment>
                );})}
              </tbody>
            </table>
          </div>
          {notasSaida.length>0&&<div style={{padding:"12px 20px",fontSize:11,color:D?"var(--af-muted)":"rgba(10,102,116,0.55)",borderTop:"1px solid var(--af-border)"}}>{notasSaida.length} notas de saída exibidas — {saidasFiltradas.length} itens no total</div>}
        </div>
      </>}

      {/* ═══════════════════ RESUMO POR CFOP ═══════════════════ */}
      {modulo==="cfop"&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

          {/* CFOP ENTRADAS */}
          <div style={{...S.card,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:S.th.borderBottom,display:"flex",alignItems:"center",gap:8}}>
              <ArrowDownLeft size={14} color={T.accent}/>
              <span style={{fontWeight:700,fontSize:13,color:T.pageClr}}>Entradas por CFOP</span>
              <span style={{marginLeft:"auto",fontSize:11,color:T.accentDim}}>{resumoCfopEntradas.length} CFOPs — {linhas.length} itens</span>
            </div>
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
                <thead><tr>{["CFOP","Descrição","Notas","Itens","Valor Contábil","Base ICMS","ICMS"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!resumoCfopEntradas.length
                    ?<tr><td colSpan={7} style={{padding:"40px",textAlign:"center",color:T.accentDim}}>Importe um SPED para ver o resumo.</td></tr>
                    :resumoCfopEntradas.map(r=>(
                      <tr key={r.cfop} style={{borderTop:S.td.borderTop}}>
                        <td style={{...S.td,fontWeight:700,color:T.accent}}>{r.cfop}</td>
                        <td style={{...S.td,maxWidth:280,color:T.pageClr,fontSize:11,lineHeight:1.4}}>{r.descricao}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_notas}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_itens}</td>
                        <td style={{...S.td,fontWeight:600,color:T.pageClr}}>{fmoe(r.valor_contabil)}</td>
                        <td style={S.td}>{fmoe(r.base_icms)}</td>
                        <td style={S.td}>{fmoe(r.valor_icms)}</td>
                      </tr>
                    ))
                  }
                  {resumoCfopEntradas.length>0&&<tr style={{background:D?"rgba(39,199,216,0.05)":"rgba(10,102,116,0.05)"}}>
                    <td colSpan={4} style={{...S.td,fontWeight:700,color:T.accent,fontSize:11,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Total</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopEntradas.reduce((a,r)=>a+r.valor_contabil,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopEntradas.reduce((a,r)=>a+r.base_icms,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopEntradas.reduce((a,r)=>a+r.valor_icms,0))}</td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* CFOP SAÍDAS */}
          <div style={{...S.card,overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:S.th.borderBottom,display:"flex",alignItems:"center",gap:8}}>
              <ArrowUpRight size={14} color="#34d399"/>
              <span style={{fontWeight:700,fontSize:13,color:T.pageClr}}>Saídas por CFOP</span>
              <span style={{marginLeft:"auto",fontSize:11,color:T.accentDim}}>{resumoCfopSaidas.length} CFOPs — {saidas.length} itens</span>
            </div>
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
                <thead><tr>{["CFOP","Descrição","Notas","Itens","Valor Contábil","Base ICMS","ICMS"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!resumoCfopSaidas.length
                    ?<tr><td colSpan={7} style={{padding:"40px",textAlign:"center",color:T.accentDim}}>Importe XMLs de saída para ver o resumo.</td></tr>
                    :resumoCfopSaidas.map(r=>(
                      <tr key={r.cfop} style={{borderTop:S.td.borderTop}}>
                        <td style={{...S.td,fontWeight:700,color:"#34d399"}}>{r.cfop}</td>
                        <td style={{...S.td,maxWidth:280,color:T.pageClr,fontSize:11,lineHeight:1.4}}>{r.descricao}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_notas}</td>
                        <td style={{...S.td,textAlign:"center" as const,color:T.pageClr}}>{r.qtd_itens}</td>
                        <td style={{...S.td,fontWeight:600,color:T.pageClr}}>{fmoe(r.valor_contabil)}</td>
                        <td style={S.td}>{fmoe(r.base_icms)}</td>
                        <td style={S.td}>{fmoe(r.valor_icms)}</td>
                      </tr>
                    ))
                  }
                  {resumoCfopSaidas.length>0&&<tr style={{background:D?"rgba(52,211,153,0.05)":"rgba(5,100,60,0.05)"}}>
                    <td colSpan={4} style={{...S.td,fontWeight:700,color:"#34d399",fontSize:11,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>Total</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopSaidas.reduce((a,r)=>a+r.valor_contabil,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopSaidas.reduce((a,r)=>a+r.base_icms,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:T.pageClr}}>{fmoe(resumoCfopSaidas.reduce((a,r)=>a+r.valor_icms,0))}</td>
                  </tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>}

    </div></main>
  );
}