"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Infracao = {
  inicio: string | null;
  fim: string | null;
  endereco_inicio: string | null;
  vel_media: number | null;
};

function normalizarPlaca(valor: string) {
  return String(valor ?? "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
}

export default function PaginaPlacaVelocidade() {
  const router = useRouter();
  const params = useParams();

  const uploadId = params.id as string;
  const placaParam = params.placa as string;

  const placaNormalizada = useMemo(() => normalizarPlaca(placaParam), [placaParam]);

  const [erro, setErro] = useState<string | null>(null);
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      setErro(null);
      setCarregando(true);

      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("dashboards")
        .select("resumo")
        .eq("upload_id", uploadId)
        .single();

      if (error || !data) {
        console.error(error);
        setErro("Falha ao carregar dashboard.");
        setCarregando(false);
        return;
      }

      const detalhes = (data as any)?.resumo?.detalhes_por_placa?.[placaNormalizada] ?? [];

      // garante formato array
      setInfracoes(Array.isArray(detalhes) ? (detalhes as Infracao[]) : []);
      setCarregando(false);
    }

    carregar();
  }, [uploadId, placaNormalizada, router]);

  return (
    <main className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#070B12]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.14),transparent_55%)]" />

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Placa {placaNormalizada}</h1>
              <p className="mt-1 text-white/70">Infrações registradas neste relatório</p>
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

          {carregando ? (
            <div className="mt-6 text-sm text-white/70">Carregando...</div>
          ) : infracoes.length === 0 ? (
            <div className="mt-6 text-sm text-white/70">
              Nenhuma infração encontrada para esta placa.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              {/* Header */}
              <div className="grid grid-cols-5 bg-white/5 px-4 py-3 text-xs text-white/60">
                <div>#</div>
                <div>Início</div>
                <div>Fim</div>
                <div>Endereço</div>
                <div className="text-right">Velocidade média</div>
              </div>

              {/* Linhas */}
              <div className="divide-y divide-white/10">
                {infracoes.map((i, idx) => (
                  <div key={idx} className="grid grid-cols-5 items-center px-4 py-3 text-sm">
                    <div className="text-white/70">{idx + 1}</div>
                    <div>{i.inicio ?? "-"}</div>
                    <div>{i.fim ?? "-"}</div>
                    <div className="truncate" title={i.endereco_inicio ?? ""}>
                      {i.endereco_inicio ?? "-"}
                    </div>
                    <div className="text-right">
                      {i.vel_media == null ? "-" : `${i.vel_media} km/h`}
                    </div>
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
