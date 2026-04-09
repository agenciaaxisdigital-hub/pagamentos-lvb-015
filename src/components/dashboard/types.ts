export type Lideranca = {
  id: string; nome: string; regiao: string | null;
  retirada_mensal_valor: number | null; retirada_mensal_meses: number | null;
  retirada_ate_mes: number | null; chave_pix: string | null;
  municipio_id?: string | null;
};

export type AdminPessoa = {
  id: string; nome: string; whatsapp: string | null;
  valor_contrato: number | null; valor_contrato_meses: number | null;
  contrato_ate_mes: number | null;
  municipio_id?: string | null;
};

export type Pagamento = {
  id: string; mes: number; ano: number; valor: number;
  categoria: string; tipo_pessoa: string | null;
  suplente_id: string | null; lideranca_id: string | null; admin_id: string | null;
};

export type FluxoMes = {
  mes: number; label: string;
  suplentes: number; liderancas: number; admin: number;
  total: number; pago: number;
};

export type CidadeData = {
  id: string; nome: string; uf: string; color: string;
  suplentes: number; liderancasCount: number; admin: number;
  orcSup: number; retiradaSup: number; liderancasVal: number;
  fiscaisVal: number; plotagemVal: number;
  retiradaMensalSup: number; liderancasQtd: number;
  fiscaisQtd: number; plotagemQtd: number;
  lidMensal: number; orcLid: number;
  admMensal: number; orcAdm: number;
  orcamento: number; pago: number;
  votos2024: number; expectativa2026: number;
  lidCidade: Lideranca[];
  admCidade: AdminPessoa[];
};

export const MESES_LABEL = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const MESES_FULL = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro"];

export const MES_INICIO_LID = 3;
export const MES_INICIO_SUP = 3;
export const MES_INICIO_ADM = 3;
export const MES_FIM = 9;

export const COLORS_CAT = {
  suplentes: "hsl(var(--primary))",
  liderancas: "hsl(263, 70%, 58%)",
  admin: "hsl(217, 91%, 60%)",
};

export const COLORS_CITY = [
  "hsl(var(--primary))", "hsl(263, 70%, 58%)", "hsl(217, 91%, 60%)",
  "hsl(160, 60%, 45%)", "hsl(30, 90%, 55%)", "hsl(0, 70%, 55%)",
];

export const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtN = (v: number) => v.toLocaleString("pt-BR");
export const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0);
