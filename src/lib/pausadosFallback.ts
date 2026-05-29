import { supabase } from "@/integrations/supabase/client";

const LOCAL_STORAGE_KEY = "local_pausados_fallback";
const VENCIMENTO_LOCAL_KEY = "local_vencimentos_fallback";

interface LocalPausadosData {
  suplente: Record<string, string>;   // mapping: id -> data_pausa
  lideranca: Record<string, string>;  // mapping: id -> data_pausa
  admin: Record<string, string>;      // mapping: id -> data_pausa
  paused_months?: Record<string, number[]>; // mapping: id -> list of months
}

interface LocalVencimentosData {
  vencimentos: Record<string, number>; // mapping: id -> dia_vencimento
}

function getLocalData(): LocalPausadosData {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        if (!parsed.paused_months) {
          parsed.paused_months = {};
        }
        if (!parsed.suplente) parsed.suplente = {};
        if (!parsed.lideranca) parsed.lideranca = {};
        if (!parsed.admin) parsed.admin = {};
        return parsed;
      }
    }
  } catch (e) {
    console.error("Erro ao ler local_pausados_fallback:", e);
  }
  return { suplente: {}, lideranca: {}, admin: {}, paused_months: {} };
}

function saveLocalData(data: LocalPausadosData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Erro ao salvar local_pausados_fallback:", e);
  }
}

function getLocalVencimentos(): LocalVencimentosData {
  try {
    const stored = localStorage.getItem(VENCIMENTO_LOCAL_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Erro ao ler local_vencimentos_fallback:", e);
  }
  return { vencimentos: {} };
}

function saveLocalVencimentos(data: LocalVencimentosData) {
  try {
    localStorage.setItem(VENCIMENTO_LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Erro ao salvar local_vencimentos_fallback:", e);
  }
}

export function getLocalVencimento(id: string): number {
  const data = getLocalVencimentos();
  return data.vencimentos[id] ?? 10;
}

export function saveLocalVencimento(id: string, dia: number) {
  const data = getLocalVencimentos();
  data.vencimentos[id] = dia;
  saveLocalVencimentos(data);
}

function getCurrentReferenceMonth(): number {
  try {
    const val = localStorage.getItem("pag-mes");
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 3 && parsed <= 12) {
        return parsed;
      }
    }
  } catch (e) {}
  return new Date().getMonth() + 1;
}

export function getLocalPausedMonths(id: string): number[] {
  const data = getLocalData();
  return data.paused_months?.[id] || [];
}

export function addLocalPausedMonth(id: string, mes: number) {
  const data = getLocalData();
  if (!data.paused_months) data.paused_months = {};
  const current = data.paused_months[id] || [];
  if (!current.includes(mes)) {
    current.push(mes);
    data.paused_months[id] = current;
    saveLocalData(data);
  }
}

export function clearLocalPausedMonth(id: string, mes: number) {
  const data = getLocalData();
  if (!data.paused_months) return;
  const current = data.paused_months[id] || [];
  const index = current.indexOf(mes);
  if (index > -1) {
    current.splice(index, 1);
    data.paused_months[id] = current;
    saveLocalData(data);
  }
}

export function isCollaboratorPausedInMonth(
  id: string,
  tipo: "suplente" | "lideranca" | "admin",
  m: number,
  isCurrentlyPaused?: boolean | null,
  dataPausa?: string | null
): boolean {
  const pausedMonths = getLocalPausedMonths(id);
  if (pausedMonths.includes(m)) {
    return true;
  }

  const localPaused = getLocalPaused(tipo);
  const dataPausaEfetiva = dataPausa || localPaused[id];
  const isPaused = isCurrentlyPaused ?? !!localPaused[id];

  if (isPaused && dataPausaEfetiva) {
    try {
      const dt = new Date(dataPausaEfetiva);
      if (!isNaN(dt.getTime())) {
        const mesPausa = dt.getMonth() + 1;
        if (m >= mesPausa) {
          return true;
        }
      }
    } catch (e) {
      const mesPausa = getCurrentReferenceMonth();
      if (m >= mesPausa) {
        return true;
      }
    }
  }

  return false;
}

const RELACIONAMENTOS_LOCAL_KEY = "local_relacionamentos_fallback";

interface LocalRelacionamentosData {
  suplente_vinculado: Record<string, string>; // suplente_id -> suplente_id (vinculado_id)
  lideranca_suplente: Record<string, string>; // lideranca_id -> suplente_id
  lideranca_vinculada: Record<string, string>; // lideranca_id -> lideranca_id
  admin_suplente: Record<string, string>; // admin_id -> suplente_id
}

function getLocalRelacionamentos(): LocalRelacionamentosData {
  try {
    const stored = localStorage.getItem(RELACIONAMENTOS_LOCAL_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Erro ao ler local_relacionamentos_fallback:", e);
  }
  return { suplente_vinculado: {}, lideranca_suplente: {}, lideranca_vinculada: {}, admin_suplente: {} };
}

function saveLocalRelacionamentos(data: LocalRelacionamentosData) {
  try {
    localStorage.setItem(RELACIONAMENTOS_LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Erro ao salvar local_relacionamentos_fallback:", e);
  }
}

export function saveLocalSuplenteVinculado(id: string, vinculadoId: string | null | undefined) {
  const data = getLocalRelacionamentos();
  if (vinculadoId) {
    data.suplente_vinculado[id] = vinculadoId;
  } else {
    delete data.suplente_vinculado[id];
  }
  saveLocalRelacionamentos(data);
}

export function saveLocalLiderancaSuplente(id: string, suplenteId: string | null | undefined) {
  const data = getLocalRelacionamentos();
  if (suplenteId) {
    data.lideranca_suplente[id] = suplenteId;
  } else {
    delete data.lideranca_suplente[id];
  }
  saveLocalRelacionamentos(data);
}

export function saveLocalLiderancaVinculada(id: string, liderancaVinculadaId: string | null | undefined) {
  const data = getLocalRelacionamentos();
  if (liderancaVinculadaId) {
    data.lideranca_vinculada[id] = liderancaVinculadaId;
  } else {
    delete data.lideranca_vinculada[id];
  }
  saveLocalRelacionamentos(data);
}

export function saveLocalAdminSuplente(id: string, suplenteId: string | null | undefined) {
  const data = getLocalRelacionamentos();
  if (suplenteId) {
    data.admin_suplente[id] = suplenteId;
  } else {
    delete data.admin_suplente[id];
  }
  saveLocalRelacionamentos(data);
}

/**
 * Retorna todos os colaboradores pausados localmente para o tipo especificado.
 */
export function getLocalPaused(tipo: "suplente" | "lideranca" | "admin"): Record<string, string> {
  const data = getLocalData();
  return data[tipo] || {};
}

/**
 * Mescla o status de pausado do banco com o do localStorage para tolerância a falhas.
 * Também mescla o dia de vencimento local e os relacionamentos de forma transparente.
 */
export function mergePausados<T extends { id: string; pausado?: boolean | null; data_pausa?: string | null; dia_vencimento?: number | null; vinculado_id?: string | null; suplente_id?: string | null; lideranca_vinculada_id?: string | null; data_inicio?: string | null }>(
  list: T[] | null | undefined,
  tipo: "suplente" | "lideranca" | "admin"
): T[] {
  if (!list) return [];
  const localPaused = getLocalPaused(tipo);
  const localVencimentos = getLocalVencimentos().vencimentos;
  const localRel = getLocalRelacionamentos();
  const localDatasInicio = getLocalDatasInicio().datas;

  return list.map(item => {
    const merged = {
      ...item,
      dia_vencimento: localVencimentos[item.id] ?? item.dia_vencimento ?? 10,
      data_inicio: localDatasInicio[item.id] ?? (item as any).data_inicio ?? null
    };

    if (tipo === "suplente") {
      merged.vinculado_id = localRel.suplente_vinculado[item.id] ?? item.vinculado_id ?? null;
    } else if (tipo === "lideranca") {
      merged.suplente_id = localRel.lideranca_suplente[item.id] ?? item.suplente_id ?? null;
      merged.lideranca_vinculada_id = localRel.lideranca_vinculada[item.id] ?? item.lideranca_vinculada_id ?? null;
    } else if (tipo === "admin") {
      merged.suplente_id = localRel.admin_suplente[item.id] ?? item.suplente_id ?? null;
    }

    if (localPaused[item.id]) {
      merged.pausado = true;
      merged.data_pausa = localPaused[item.id];
    }
    return merged;
  });
}
/**
 * Pausa um colaborador tentando primeiro o banco de dados.
 * Se falhar por qualquer motivo (por exemplo, falta de coluna no schema), salva no localStorage como fallback automático e reporta sucesso no frontend.
 */
export async function pauseCollaborator(
  id: string,
  tipo: "suplente" | "lideranca" | "admin",
  mesReferencia?: number
): Promise<{ success: boolean; error?: any; fallbackUsed: boolean }> {
  const table = tipo === "suplente" ? "suplentes" : tipo === "lideranca" ? "liderancas" : "administrativo";
  const nowIso = new Date().toISOString();
  const mesPausa = mesReferencia ?? getCurrentReferenceMonth();

  // Registrar o mês de pausa localmente
  addLocalPausedMonth(id, mesPausa);

  try {
    // 1. Tentar com a coluna data_pausa e pausado
    const { error: err1 } = await supabase.from(table).update({ pausado: true, data_pausa: nowIso } as any).eq("id", id);
    if (!err1) {
      // Remover do localStorage caso estivesse lá anteriormente
      const data = getLocalData();
      if (data[tipo]?.[id]) {
        delete data[tipo][id];
        saveLocalData(data);
      }
      return { success: true, fallbackUsed: false };
    }

    // Se falhar, tenta apenas pausado: true
    const { error: err2 } = await supabase.from(table).update({ pausado: true } as any).eq("id", id);
    if (!err2) {
      // Salva a data localmente mas mantém o status no banco
      const data = getLocalData();
      data[tipo] = data[tipo] || {};
      data[tipo][id] = nowIso;
      saveLocalData(data);
      return { success: true, fallbackUsed: true };
    }

    // Se ambos falharem (provavelmente coluna 'pausado' inexistente), cai no fallback completo local
    console.warn(`[Fallback] Falha ao atualizar banco de dados para '${table}'. Utilizando armazenamento local no localStorage.`);
    const data = getLocalData();
    data[tipo] = data[tipo] || {};
    data[tipo][id] = nowIso;
    saveLocalData(data);
    return { success: true, fallbackUsed: true };
  } catch (e: any) {
    console.error("Erro crítico ao pausar colaborador:", e);
    // Em caso de qualquer erro grave, garante a operação usando LocalStorage
    const data = getLocalData();
    data[tipo] = data[tipo] || {};
    data[tipo][id] = nowIso;
    saveLocalData(data);
    return { success: true, fallbackUsed: true };
  }
}

/**
 * Reativa um colaborador limpando no banco de dados e no localStorage.
 */
export async function reactivateCollaborator(
  id: string,
  tipo: "suplente" | "lideranca" | "admin",
  updatePayload: any
): Promise<{ success: boolean; error?: any }> {
  const table = tipo === "suplente" ? "suplentes" : tipo === "lideranca" ? "liderancas" : "administrativo";

  // Obter o mês de pausa anterior para congelar os meses do gap
  const localPaused = getLocalPaused(tipo);
  const dataPausaEfetiva = localPaused[id];
  let mesPausa = 0;
  if (dataPausaEfetiva) {
    try {
      const dt = new Date(dataPausaEfetiva);
      if (!isNaN(dt.getTime())) {
        mesPausa = dt.getMonth() + 1;
      }
    } catch (e) {}
  }
  if (!mesPausa) {
    mesPausa = getCurrentReferenceMonth();
  }

  // Determinar o novo início do plano de reativação
  let novoInicioMes = getCurrentReferenceMonth();
  if (updatePayload) {
    if (updatePayload.inicioMes !== undefined) {
      novoInicioMes = updatePayload.inicioMes;
    } else if (tipo === "suplente" && updatePayload.retirada_mensal_meses !== undefined) {
      novoInicioMes = Math.max(3, 10 - updatePayload.retirada_mensal_meses + 1);
    } else if (tipo === "lideranca" && updatePayload.retirada_ate_mes !== undefined && updatePayload.retirada_mensal_meses !== undefined) {
      novoInicioMes = Math.max(3, updatePayload.retirada_ate_mes - updatePayload.retirada_mensal_meses + 1);
    } else if (tipo === "admin" && updatePayload.contrato_ate_mes !== undefined && updatePayload.valor_contrato_meses !== undefined) {
      novoInicioMes = Math.max(3, updatePayload.contrato_ate_mes - updatePayload.valor_contrato_meses + 1);
    }
  }

  // Congelar a pausa para todos os meses do gap (desde mesPausa até novoInicioMes - 1)
  for (let m = mesPausa; m < novoInicioMes; m++) {
    if (m >= 3 && m <= 12) {
      addLocalPausedMonth(id, m);
    }
  }

  // E garantir que os novos meses ativos sejam limpos do histórico de pausados
  let novoFimMes = 10;
  if (updatePayload) {
    if (updatePayload.fimMes !== undefined) {
      novoFimMes = updatePayload.fimMes;
    } else if (tipo === "lideranca" && updatePayload.retirada_ate_mes !== undefined) {
      novoFimMes = updatePayload.retirada_ate_mes;
    } else if (tipo === "admin" && updatePayload.contrato_ate_mes !== undefined) {
      novoFimMes = updatePayload.contrato_ate_mes;
    }
  }
  for (let m = novoInicioMes; m <= novoFimMes; m++) {
    clearLocalPausedMonth(id, m);
  }

  // Limpar local
  const data = getLocalData();
  if (data[tipo]?.[id]) {
    delete data[tipo][id];
    saveLocalData(data);
  }

  // Decouple client-side columns from the payload
  const cleanPayload = { ...updatePayload };
  
  if ("dia_vencimento" in cleanPayload) {
    saveLocalVencimento(id, cleanPayload.dia_vencimento);
    delete cleanPayload.dia_vencimento;
  }
  if ("vinculado_id" in cleanPayload) {
    saveLocalSuplenteVinculado(id, cleanPayload.vinculado_id);
    delete cleanPayload.vinculado_id;
  }
  if ("suplente_id" in cleanPayload) {
    if (tipo === "lideranca") {
      saveLocalLiderancaSuplente(id, cleanPayload.suplente_id);
    } else if (tipo === "admin") {
      saveLocalAdminSuplente(id, cleanPayload.suplente_id);
    }
    delete cleanPayload.suplente_id;
  }
  if ("lideranca_vinculada_id" in cleanPayload) {
    saveLocalLiderancaVinculada(id, cleanPayload.lideranca_vinculada_id);
    delete cleanPayload.lideranca_vinculada_id;
  }
  if ("pausado" in cleanPayload) {
    delete cleanPayload.pausado;
  }
  if ("data_pausa" in cleanPayload) {
    delete cleanPayload.data_pausa;
  }
  if ("inicioMes" in cleanPayload) {
    delete cleanPayload.inicioMes;
  }
  if ("fimMes" in cleanPayload) {
    delete cleanPayload.fimMes;
  }
  if ("details" in cleanPayload) {
    delete cleanPayload.details;
  }

  try {
    const updateObj1: any = {
      ...cleanPayload
    };
    
    // 1. Tenta atualizar no banco limpando a data_pausa e aplicando o novo plano
    const { error: err1 } = await supabase.from(table).update({
      pausado: false,
      data_pausa: null,
      ...updateObj1
    } as any).eq("id", id);

    if (!err1) return { success: true };

    // 2. Se falhar, tenta apenas pausado: false
    const { error: err2 } = await supabase.from(table).update({
      pausado: false,
      ...updateObj1
    } as any).eq("id", id);

    if (!err2) return { success: true };

    // 3. Se falhar também (colunas inexistentes no DB), atualiza apenas os campos válidos
    if (Object.keys(updateObj1).length > 0) {
      const { error: err3 } = await supabase.from(table).update(updateObj1).eq("id", id);
      if (!err3) return { success: true };
      return { success: false, error: err3 };
    }

    return { success: true };
  } catch (e: any) {
    console.error("Erro crítico ao reativar colaborador:", e);
    return { success: false, error: e };
  }
}

const DATA_INICIO_LOCAL_KEY = "local_data_inicio_fallback";

interface LocalDataInicioData {
  datas: Record<string, string>; // mapping: id -> ISO date or YYYY-MM-DD
}

function getLocalDatasInicio(): LocalDataInicioData {
  try {
    const stored = localStorage.getItem(DATA_INICIO_LOCAL_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Erro ao ler local_data_inicio_fallback:", e);
  }
  return { datas: {} };
}

function saveLocalDatasInicio(data: LocalDataInicioData) {
  try {
    localStorage.setItem(DATA_INICIO_LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Erro ao salvar local_data_inicio_fallback:", e);
  }
}

export function getLocalDataInicio(id: string): string {
  const data = getLocalDatasInicio();
  return data.datas[id] || "";
}

export function saveLocalDataInicio(id: string, dateStr: string | null | undefined) {
  const data = getLocalDatasInicio();
  if (dateStr) {
    data.datas[id] = dateStr;
  } else {
    delete data.datas[id];
  }
  saveLocalDatasInicio(data);
}

