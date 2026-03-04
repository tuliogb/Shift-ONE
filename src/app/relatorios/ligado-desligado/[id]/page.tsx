"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Upload = {
  id: string;
  criado_em: string;
  nome_arquivo: string;
  status: string | null;
};

type ResumoHoras = {
  ok?: boolean;
  processado_global?: boolean;
  dia_operacao?: string;

  // sugeridos pro resumo:
  placas?: string[];
  total_eventos?: number;

  // contadores (se sua edge function já calcular)
  total_infracoes_10h?: number;
  total_gravissimas_12h?: number;

  // detalhes por placa (se existir)
  detalhes_por_placa?: Record<
    string,
    {
      total_eventos?: number;
      total_infracoes_10h?: number;
      total_gravissimas_12h?: number;
      eventos?: Array<any>;
    }
  >;
};

type Dashboard = {
  id: string;
  upload_id: string;
  resumo: ResumoHoras | null;
};

export default function DashboardLigadoDesligado() {
  const router = useRouter();
  const params = useParams();
  const uploadId = String(params?.id ?? "");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [upload, setUpload] = useState<Upload | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);

  useEffect(() => {
    async function carregar() {
      setErro(null);

      const { data: sessaoData } = await supabase.auth.getSession();
      if (!sessaoData.session) {
        router.replace("/login");
        return;
      }

      const { data: up, error: errUp } = await supabase
        .from("uploads")
        .select("id, criado_em, nome_arquivo, status")
        .eq("id", uploadId)
        .single();

      if (errUp) {
        console.error(errUp);
        setErro("Falha ao buscar upload.");
        setCarregando(false);
        return;
      }

        const { data: d, error: errD } = await supabase
        .from("dashboards")
        .select("upload_id, tipo, resumo, criado_em, atualizado_em")
        .eq("upload_id", uploadId)
        .single();

      if (errD) {
        console.error(errD);
        setErro("Falha ao buscar dashboard.");
        setCarregando(false);
        return;
      }

      setUpload(up as Upload);
      setDash((d ?? null) as any);
      setCarregando(false);
    }

    if (uploadId) carregar();
  }, [router, uploadId]);

  // polling enquanto estiver processando
  useEffect(() => {
    if (!uploadId) return;

    const status = upload?.status ?? null;
    if (status !== "processando") return;

    const t = setInterval(async () => {
      const { data: up } = await supabase
        .from("uploads")
        .select("id, criado_em, nome_arquivo, status")
        .eq("id", uploadId)
        .maybeSingle();

      const { data: d } = await supabase
        .from("dashboards")
        .select("upload_id, tipo, resumo, criado_em, atualizado_em")
        .eq("upload_id", uploadId)
        .maybeSingle();

      if (up) setUpload(up as Upload);
      if (d) setDash(d as any);
    }, 1500);

    return () => clearInterval(t);
  }, [uploadId, upload?.status]);

  function formatarData(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const resumo = dash?.resumo ?? null;

  const placas =
    resumo?.placas ??
    (resumo?.detalhes_por_placa ? Object.keys(resumo.detalhes_por_placa) : []);

  const totalPlacas = placas.length;

  // contadores com fallback
  const totalEventos =
    resumo?.total_eventos ??
    (resumo?.detalhes_por_placa
      ? Object.values(resumo.detalhes_por_placa).reduce((acc, p) => acc + (p?.total_eventos ?? 0), 0)
      : 0);

  const totalInfracoes10 =
    resumo?.total_infracoes_10h ??
    (resumo?.detalhes_por_placa
      ? Object.values(resumo.detalhes_por_placa).reduce((acc, p) => acc + (p?.total_infracoes_10h ?? 0), 0)
      : 0);

  const totalGravissimas12 =
    resumo?.total_gravissimas_12h ??
    (resumo?.detalhes_por_placa
      ? Object.values(resumo.detalhes_por_placa).reduce((acc, p) => acc + (p?.total_gravissimas_12h ?? 0), 0)
      : 0);

  const pronto = resumo?.ok === true && resumo?.processado_global === true;
  const processando = (upload?.status ?? null) === "processando";

return (
  <main className="min-h-screen text-white">
    <div className="fixed inset-0 -z-10 bg-[#070B12]" />
    <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.14),transparent_55%)]" />

    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        {/* Título + botão Voltar (igual velocidade: sem header) */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dirigindo e Parado</h1>
            <p className="mt-1 text-white/70">Dashboard do upload selecionado.</p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/relatorios/ligado-desligado")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Voltar
          </button>
        </div>

        {erro && (
          <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            Carregando...
          </div>
        ) : !upload ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            Upload não encontrado.
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm text-white/70">Arquivo</p>
              <p className="mt-1 text-sm font-semibold text-white/90">{upload.nome_arquivo}</p>
              <p className="mt-1 text-xs text-white/50">
                Enviado em: {formatarData(upload.criado_em)} • Status: {upload.status ?? "-"}
              </p>

              {processando && (
                <p className="mt-2 text-xs text-white/60">Processando... (atualizando automaticamente)</p>
              )}
            </div>

            {!pronto && !processando && (
              <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
                Este upload ainda não foi processado. Volte e clique nele para iniciar o processamento.
              </div>
            )}

            {pronto && (
              <>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card titulo="Placas pegas" valor={String(totalPlacas)} />
                  <Card titulo="Eventos" valor={String(totalEventos)} />
                  <Card titulo="Gravíssimas (≥12h)" valor={String(totalGravissimas12)} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card titulo="Infrações (≥10h)" valor={String(totalInfracoes10)} />
                  <Card titulo="Dia operação" valor={resumo?.dia_operacao ?? "-"} />
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-12 bg-white/5 px-4 py-3 text-xs text-white/60">
                    <div className="col-span-10">Placa</div>
                    <div className="col-span-2 text-right">Abrir</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {placas.map((placa) => (
                      <button
                        key={placa}
                        type="button"
                        className="grid w-full grid-cols-12 items-center px-4 py-4 text-left transition hover:bg-white/5"
                        onClick={() => {
                        const url = `/relatorios/ligado-desligado/${uploadId}/placa/${encodeURIComponent(placa)}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <div className="col-span-10">
                          <p className="text-sm font-semibold text-white/90">{placa}</p>
                          <p className="mt-1 text-xs text-white/50">Clique para ver detalhes da placa.</p>
                        </div>
                        <div className="col-span-2 text-right text-xs text-white/60">→</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  </main>
);}

function BotaoMenu({ texto, aoClicar }: { texto: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="rounded-xl px-4 py-2 text-sm font-semibold transition border bg-white/5 border-white/10 hover:bg-white/10"
    >
      {texto}
    </button>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-white/60">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-white/90">{valor}</p>
    </div>
  );
}