"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type EventoHoras = {
  inicio: string | null;
  fim: string | null;

  // pode vir em segundos ou horas, deixei flexível
  duracao_segundos?: number | null;
  duracao_horas?: number | null;

  // classificação do evento (se sua edge function já gerar)
  nivel?: "INFRACAO" | "GRAVISSIMA" | string | null;
};

type GlobalHoras = {
  placa: string;

  // contadores históricos
  qtd_infracoes_10h: number | null;
  qtd_gravissimas_12h: number | null;
  dias_pego: number | null;

  // tratativa
  tratativa: number | null;
  datas_tratativa: string[] | null;
};

function normalizarPlaca(valor: string) {
  return String(valor ?? "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
}

function formatarDataBR(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function normalizarArrayDatas(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : null))
    .filter((x): x is string => Boolean(x));
}

function formatarDuracao(evento: EventoHoras) {
  if (evento.duracao_horas != null && Number.isFinite(evento.duracao_horas)) {
    return `${evento.duracao_horas.toFixed(2)} h`;
  }
  if (evento.duracao_segundos != null && Number.isFinite(evento.duracao_segundos)) {
    const total = Math.max(0, Math.floor(evento.duracao_segundos));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return "-";
}

export default function PaginaPlacaLigadoDesligado() {
  const router = useRouter();
  const params = useParams();

  const uploadId = params.id as string;
  const placaParam = params.placa as string;

  const placaNormalizada = useMemo(() => normalizarPlaca(placaParam), [placaParam]);

  const [erro, setErro] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoHoras[]>([]);
  const [carregando, setCarregando] = useState(true);

  // GLOBAL
  const [global, setGlobal] = useState<GlobalHoras | null>(null);
  const [diasSistema, setDiasSistema] = useState<number | null>(null);
  const [diaOperacao, setDiaOperacao] = useState<string | null>(null);

  const [salvandoTratativa, setSalvandoTratativa] = useState(false);

  useEffect(() => {
    async function carregar() {
      setErro(null);
      setCarregando(true);

      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) {
        router.replace("/login");
        return;
      }

      // 1) DASHBOARD (local)
      const { data: dashData, error: dashErr } = await supabase
        .from("dashboards")
        .select("resumo")
        .eq("upload_id", uploadId)
        .single();

      if (dashErr || !dashData) {
        console.error(dashErr);
        setErro("Falha ao carregar dashboard.");
        setCarregando(false);
        return;
      }

      const resumo = (dashData as any)?.resumo ?? {};
      setDiaOperacao(typeof resumo?.dia_operacao === "string" ? resumo.dia_operacao : null);

      // Esperado: resumo.detalhes_por_placa[PLACA] -> array de eventos
      // Mas deixei com fallback caso você resolva salvar como objeto {eventos: [...]}
      const bruto = resumo?.detalhes_por_placa?.[placaNormalizada];

      if (Array.isArray(bruto)) {
        setEventos(bruto as EventoHoras[]);
      } else if (bruto && Array.isArray(bruto.eventos)) {
        setEventos(bruto.eventos as EventoHoras[]);
      } else {
        setEventos([]);
      }

      // 2) GLOBAL (historico da placa)
      const { data: glob, error: globErr } = await supabase
        .from("horas_global")
        .select("placa, qtd_infracoes_10h, qtd_gravissimas_12h, dias_pego, tratativa, datas_tratativa")
        .eq("placa", placaNormalizada)
        .maybeSingle();

      if (globErr) {
        console.error(globErr);
        // não é fatal: pode não existir ainda
        setGlobal(null);
      } else if (glob) {
        setGlobal({
          placa: glob.placa,
          qtd_infracoes_10h: (glob as any).qtd_infracoes_10h ?? 0,
          qtd_gravissimas_12h: (glob as any).qtd_gravissimas_12h ?? 0,
          dias_pego: (glob as any).dias_pego ?? 0,
          tratativa: (glob as any).tratativa ?? 0,
          datas_tratativa: normalizarArrayDatas((glob as any).datas_tratativa),
        });
      } else {
        setGlobal(null);
      }

      // 3) DIAS DO SISTEMA
      const { count, error: diasErr } = await supabase
        .from("operacao_dias")
        .select("*", { count: "exact", head: true });

      if (diasErr) {
        console.error(diasErr);
        setDiasSistema(null);
      } else {
        setDiasSistema(count ?? 0);
      }

      setCarregando(false);
    }

    carregar();
  }, [uploadId, placaNormalizada, router]);

  const taxaPresenca = useMemo(() => {
    const diasPegos = global?.dias_pego ?? null;
    const dias = diasSistema ?? null;
    if (!diasPegos || !dias) return null;
    return (diasPegos / dias) * 100;
  }, [global, diasSistema]);

  async function realizarTratativa() {
    try {
      setErro(null);
      setSalvandoTratativa(true);

      if (!global) {
        setErro("Essa placa ainda não existe na horas_global (sem histórico).");
        return;
      }

      const agoraIso = new Date().toISOString();
      const tratativaAtual = global.tratativa ?? 0;
      const datasAtuais = normalizarArrayDatas(global.datas_tratativa);

      const novasDatas = [...datasAtuais, agoraIso];
      const novaTratativa = tratativaAtual + 1;

      const { error: upErr } = await supabase
        .from("horas_global")
        .update({
          tratativa: novaTratativa,
          datas_tratativa: novasDatas,
          atualizado_em: new Date().toISOString(),
        })
        .eq("placa", placaNormalizada);

      if (upErr) {
        console.error(upErr);
        setErro("Falha ao salvar tratativa. (Provável permissão/RLS)");
        return;
      }

      setGlobal((g) =>
        g
          ? {
              ...g,
              tratativa: novaTratativa,
              datas_tratativa: novasDatas,
            }
          : g,
      );
    } finally {
      setSalvandoTratativa(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#070B12]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.14),transparent_55%)]" />

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Placa {placaNormalizada}</h1>
              <p className="mt-1 text-white/70">Análise local (relatório) + Visão Global</p>
            </div>

            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              onClick={() => window.close()}
            >
              Fechar
            </button>
          </div>

          {erro && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          {/* RESUMO GLOBAL */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-white/60">Visão Global</p>
                <p className="mt-1 text-sm text-white/70">
                  Base: <span className="text-white/90 font-semibold">horas_global</span> +{" "}
                  <span className="text-white/90 font-semibold">operacao_dias</span>
                </p>
              </div>

              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60"
                onClick={realizarTratativa}
                disabled={salvandoTratativa || !global}
                title={!global ? "Ainda não existe histórico dessa placa na global" : "Somar 1 e registrar data"}
              >
                {salvandoTratativa ? "Salvando..." : "Realizar tratativa"}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Infrações (≥10h)</p>
                <p className="mt-1 text-lg font-semibold">{global?.qtd_infracoes_10h ?? "-"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Gravíssimas (≥12h)</p>
                <p className="mt-1 text-lg font-semibold">{global?.qtd_gravissimas_12h ?? "-"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Dias pego (histórico)</p>
                <p className="mt-1 text-lg font-semibold">{global?.dias_pego ?? "-"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Presença</p>
                <p className="mt-1 text-lg font-semibold">
                  {taxaPresenca == null ? "-" : `${taxaPresenca.toFixed(1)}%`}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Dia do relatório atual</p>
                <p className="mt-1 text-sm font-semibold text-white/90">{diaOperacao ?? "-"}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Tratativas</p>
                <p className="mt-1 text-sm font-semibold text-white/90">{global?.tratativa ?? "-"}</p>

                <p className="mt-2 text-xs text-white/60">Datas</p>
                <div className="mt-1 text-xs text-white/80">
                  {global?.datas_tratativa && global.datas_tratativa.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {global.datas_tratativa
                        .slice()
                        .reverse()
                        .map((d, idx) => (
                          <span
                            key={`${d}-${idx}`}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1"
                            title={d}
                          >
                            {formatarDataBR(d)}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <span className="text-white/60">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TABELA LOCAL */}
          {carregando ? (
            <div className="mt-6 text-sm text-white/70">Carregando...</div>
          ) : eventos.length === 0 ? (
            <div className="mt-6 text-sm text-white/70">Nenhum evento encontrado para esta placa.</div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-5 bg-white/5 px-4 py-3 text-xs text-white/60">
                <div>#</div>
                <div>Início</div>
                <div>Fim</div>
                <div>Duração</div>
                <div className="text-right">Nível</div>
              </div>

              <div className="divide-y divide-white/10">
                {eventos.map((e, idx) => (
                  <div key={idx} className="grid grid-cols-5 items-center px-4 py-3 text-sm">
                    <div className="text-white/70">{idx + 1}</div>
                    <div>{e.inicio ? formatarDataBR(e.inicio) : "-"}</div>
                    <div>{e.fim ? formatarDataBR(e.fim) : "-"}</div>
                    <div>{formatarDuracao(e)}</div>
                    <div className="text-right text-xs text-white/70">{e.nivel ?? "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}