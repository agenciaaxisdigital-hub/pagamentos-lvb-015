type PessoaPagamentoTipo = "suplente" | "lideranca" | "admin";
type CategoriaPagamento = "retirada" | "salario";

export type PagamentoElegibilidade = {
  ano: number;
  categoria: string;
  mes: number;
  admin_id?: string | null;
  lideranca_id?: string | null;
  suplente_id?: string | null;
};

type GetMesInicioArgs = {
  categoria: CategoriaPagamento;
  createdAt?: string | null;
  mesCutoffExcecao?: number;
  mesInicioGlobal: number;
  pagamentos?: PagamentoElegibilidade[];
  pessoaId: string;
  tipo: PessoaPagamentoTipo;
  anoReferencia?: number;
};

export function getMesInicioPorCadastro(
  createdAt: string | null | undefined,
  mesInicioGlobal: number,
  mesCutoffExcecao = 3,
  anoReferencia = 2026,
): number {
  if (!createdAt) return mesInicioGlobal;

  const dt = new Date(createdAt);
  if (Number.isNaN(dt.getTime())) return mesInicioGlobal;

  const mesCadastro = dt.getMonth() + 1;
  const anoCadastro = dt.getFullYear();

  if (anoCadastro < anoReferencia || (anoCadastro === anoReferencia && mesCadastro <= mesCutoffExcecao)) {
    return mesInicioGlobal;
  }

  return Math.max(mesInicioGlobal, mesCadastro + 1);
}

function getPessoaPagamentoId(tipo: PessoaPagamentoTipo, pagamento: PagamentoElegibilidade): string | null | undefined {
  if (tipo === "suplente") return pagamento.suplente_id;
  if (tipo === "lideranca") return pagamento.lideranca_id;
  return pagamento.admin_id;
}

export function getMesInicioComHistorico({
  categoria,
  createdAt,
  mesCutoffExcecao = 3,
  mesInicioGlobal,
  pagamentos = [],
  pessoaId,
  tipo,
  anoReferencia = 2026,
}: GetMesInicioArgs): number {
  const inicioCadastro = getMesInicioPorCadastro(createdAt, mesInicioGlobal, mesCutoffExcecao, anoReferencia);

  const primeiroMesPago = pagamentos
    .filter((pagamento) => (
      pagamento.ano === anoReferencia &&
      pagamento.categoria === categoria &&
      getPessoaPagamentoId(tipo, pagamento) === pessoaId
    ))
    .reduce<number | null>((menorMes, pagamento) => {
      if (menorMes == null) return pagamento.mes;
      return Math.min(menorMes, pagamento.mes);
    }, null);

  if (primeiroMesPago == null) return inicioCadastro;

  return Math.max(inicioCadastro, primeiroMesPago);
}