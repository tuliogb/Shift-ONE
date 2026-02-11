"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UploadMini = {
  id: string;
  nome_arquivo: string;
  status: string | null;
};

type DashboardMini = {
  upload_id: string;
  tipo: string;
  resumo: any;
};

type PlacaResumo = { placa: string; infracoes: number };

export default function PaginaDetalheVelocidade() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [erro, setErro] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadMini | null>(null);
  const [dash, setDash] = useState<DashboardMini | null>(null);

  useEffect(() => {
    let timer: any;

    async function carregar() {
      setErro(null);

      const { data: sessaoData } = await supabase.auth.getSession();
      if (!sessaoData.session) {
        router.replace("/login");
        return;
      }

      const { data: up, error: e1 } = await supabase
        .from("uploads")
        .select("id, nome_arquivo, status")
        .eq("id", id)
        .single();

      if (e1) {
        console.error(e1);
        setErro("Falha ao buscar upload.");
        return;
      }

      setUpload(up as any);

      const { data: d, error: e2 } = await supabase
        .from("dashboards")
        .select("upload_id, tipo, resumo")
        .eq("upload_id", id)
        .single();

      if (e2) {
        // dashboard pode não existir ainda (primeiro clique ou ainda processando)
        setDash(null);
      } else {
        setDash(d as any);
      }

      const st = (up as any)?.status ?? "";
      if (st === "processando") {
        timer = setTimeout(carregar, 1500);
      }
    }

    carregar();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [id, router]);

  const placas: PlacaResumo[] = useMemo(() => {
    const r = dash?.resumo ?? {};

    // ✅ formato atual (edge salva aqui)
    if (Array.isArray(r?.placas)) return r.placas as PlacaResumo[];

    // fallback para formato antigo (se tiver sobrado algo velho)
    if (Array.isArray(r?.placas_resumo)) return r.placas_resumo as PlacaResumo[];

    return [];
  }, [dash]);

  const totalEventos = dash?.resumo?.total_eventos ?? "-";

  const estaProcessando = upload?.status === "processando";
  const dashboardAindaNaoExiste = !dash && !estaProcessando;

  return (
    <main className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#070B12]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.14),transparent_55%)]" />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          {/* Header + Voltar */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Dashboard do Upload</h1>
              <p className="mt-1 text-white/70">Velocidade</p>
            </div>

            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              onClick={() => router.push("/relatorios/velocidade")}
            >
              Voltar
            </button>
          </div>

          {erro && (
            <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
              {erro}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs text-white/60">Arquivo</p>
            <p className="mt-1 text-sm font-semibold text-white/90">
              {upload?.nome_arquivo ?? "-"}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60">Status</p>
                <p className="mt-1 text-sm font-semibold">{upload?.status ?? "-"}</p>
              </div>

              {estaProcessando && (
                <p className="text-xs text-white/60">Processando... (atualizando)</p>
              )}
            </div>
          </div>

          {/* Mensagens de estado */}
          {dashboardAindaNaoExiste && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              Ainda não há dados de dashboard para este upload.
              <span className="block mt-1 text-xs text-white/50">
                (Isso aparece se ele nunca foi processado ou se você limpou a tabela dashboards.)
              </span>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-white/60">Placas detectadas</p>
                <p className="mt-1 text-lg font-semibold">
                  {placas.length > 0 ? placas.length : "-"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-white/60">Total de eventos</p>
                <p className="mt-1 text-lg font-semibold">{totalEventos}</p>
              </div>
            </div>

            {/* Grid de cards */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {placas.map((p) => (
                <button
                  key={p.placa}
                  type="button"
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition"
                  onClick={() => {
                    const url = `/relatorios/velocidade/${id}/placa/${p.placa}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <p className="text-sm font-semibold">{p.placa}</p>
                  <p className="mt-1 text-xs text-white/70">{p.infracoes} infrações</p>
                  <p className="mt-2 text-[11px] text-white/50">Clique para detalhes</p>
                </button>
              ))}

              {placas.length === 0 && !estaProcessando && (
                <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Ainda sem dados para exibir.
                </div>
              )}

              {placas.length === 0 && estaProcessando && (
                <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Processando… assim que terminar, as placas aparecem aqui automaticamente.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
