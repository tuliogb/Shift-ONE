"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LinhaGlobal = {
  placa: string;
  qtd_infracoes: number | null;
  dias_pego: number | null;
  tratativa: number | null;
  atualizado_em: string | null;
};

type SortKey = "infracoes" | "proporcao" | "tratativas";

function normalizarPlaca(valor: string) {
  return String(valor ?? "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
}

function formatarPorcentagem(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

export default function PaginaCampeonato() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [linhas, setLinhas] = useState<LinhaGlobal[]>([]);
  const [totalDiasOperacao, setTotalDiasOperacao] = useState<number>(0);

  const [sortKey, setSortKey] = useState<SortKey>("infracoes");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    async function carregar() {
      setErro(null);
      setCarregando(true);

      const { data: sessaoData } = await supabase.auth.getSession();
      if (!sessaoData.session) {
        router.replace("/login");
        return;
      }

      // 1) total de dias do sistema (operacao_dias)
      const { count: countDias, error: errDias } = await supabase
        .from("operacao_dias")
        .select("dia", { count: "exact", head: true });

      if (errDias) {
        console.error(errDias);
        // não é fatal, só vai zerar proporção
        setTotalDiasOperacao(0);
      } else {
        setTotalDiasOperacao(countDias ?? 0);
      }

      // 2) dados globais
      const { data, error } = await supabase
        .from("velocidade_global")
        .select("placa, qtd_infracoes, dias_pego, tratativa, atualizado_em")
        .limit(5000);

      if (error) {
        console.error(error);
        setErro("Falha ao buscar ranking (velocidade_global).");
        setLinhas([]);
        setCarregando(false);
        return;
      }

      setLinhas((data ?? []) as LinhaGlobal[]);
      setCarregando(false);
    }

    carregar();
  }, [router]);

  const linhasOrdenadas = useMemo(() => {
    const td = totalDiasOperacao;

    const lista = (linhas ?? []).map((l) => {
      const placa = normalizarPlaca(l.placa);
      const infracoes = l.qtd_infracoes ?? 0;
      const diasPegos = l.dias_pego ?? 0;
      const tratativa = l.tratativa ?? 0;
      const proporcao = td > 0 ? diasPegos / td : 0;

      return {
        ...l,
        placa,
        infracoes,
        diasPegos,
        tratativa,
        proporcao,
      };
    });

    const mult = sortDir === "desc" ? -1 : 1;

    lista.sort((a, b) => {
      const va =
        sortKey === "infracoes"
          ? a.infracoes
          : sortKey === "tratativas"
            ? a.tratativa
            : a.proporcao;

      const vb =
        sortKey === "infracoes"
          ? b.infracoes
          : sortKey === "tratativas"
            ? b.tratativa
            : b.proporcao;

      // desc padrão: maior primeiro
      if (va < vb) return 1 * mult;
      if (va > vb) return -1 * mult;

      // desempate por infrações (desc) e depois placa
      if (a.infracoes !== b.infracoes) return b.infracoes - a.infracoes;
      return a.placa.localeCompare(b.placa);
    });

    return lista;
  }, [linhas, sortKey, sortDir, totalDiasOperacao]);

  function setOrdenacao(chave: SortKey) {
    if (chave === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(chave);
    setSortDir("desc");
  }

  function medalhaPorPosicao(pos: number) {
    if (pos === 0) return "🥇";
    if (pos === 1) return "🥈";
    if (pos === 2) return "🥉";
    return "";
  }

  return (
    <main className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#070B12]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.14),transparent_55%)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070B12]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#00AEEF] to-[#7A4CFF] p-[1px]">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#070B12]">
                <span className="text-sm font-semibold">pró+</span>
              </div>
            </div>
            <div className="leading-tight">
              <p className="text-xs text-white/60">Portal</p>
              <p className="text-sm font-semibold">Club Pro+</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <BotaoMenu texto="Home" aoClicar={() => router.push("/home")} />
            <BotaoMenu texto="Velocidade" aoClicar={() => router.push("/relatorios/velocidade")} />
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
            >
              Sair
            </button>
          </div>
        </div>

        <div className="md:hidden border-t border-white/10">
          <div className="mx-auto flex max-w-7xl gap-2 px-6 py-3">
            <BotaoMenu texto="Home" aoClicar={() => router.push("/home")} />
            <BotaoMenu texto="Velocidade" aoClicar={() => router.push("/relatorios/velocidade")} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Campeonato</h1>
              <p className="mt-1 text-white/70">
                Ranking em{" "}
                <span className="font-semibold text-white/90">
                  {totalDiasOperacao || "-"}
                </span>{" "}
                dias de campeonato
              </p>
            </div>



            {/* Botões de ordenação */}
            <div className="flex flex-wrap gap-2">
              <BotaoFiltro
                ativo={sortKey === "infracoes"}
                texto={`Infrações ${sortKey === "infracoes" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                aoClicar={() => setOrdenacao("infracoes")}
              />
              <BotaoFiltro
                ativo={sortKey === "proporcao"}
                texto={`Proporção de dias ${sortKey === "proporcao" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                aoClicar={() => setOrdenacao("proporcao")}
              />
              <BotaoFiltro
                ativo={sortKey === "tratativas"}
                texto={`Tratativas ${sortKey === "tratativas" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                aoClicar={() => setOrdenacao("tratativas")}
              />
            </div>
          </div>

          {erro && (
            <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
              {erro}
            </div>
          )}

          {carregando ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              Carregando ranking...
            </div>
          ) : linhasOrdenadas.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              Ainda não existem dados na velocidade_global.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-12 bg-white/5 px-4 py-3 text-xs text-white/60">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Placa</div>
                <div className="col-span-2">Infrações</div>
                <div className="col-span-2">Dias pego</div>
                <div className="col-span-2">Proporção</div>
                <div className="col-span-2 text-right">Tratativas</div>
              </div>

              <div className="divide-y divide-white/10">
                {linhasOrdenadas.map((l, idx) => (
                  <button
                    key={l.placa}
                    type="button"
                    className="grid w-full grid-cols-12 items-center px-4 py-3 text-left text-sm hover:bg-white/5 transition"
                    onClick={() => {
                      // rota do campeonato (sem uploadId)
                      const url = `/campeonato/placa/${l.placa}`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    title="Abrir detalhes globais desta placa"
                  >
                    <div className="col-span-1 text-white/70">
                      {medalhaPorPosicao(idx) ? (
                        <span title={`Top ${idx + 1}`}>{medalhaPorPosicao(idx)}</span>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div className="col-span-3 font-semibold">{l.placa}</div>
                    <div className="col-span-2">{l.infracoes}</div>
                    <div className="col-span-2">{l.diasPegos}</div>
                    <div className="col-span-2">{formatarPorcentagem(l.proporcao)}</div>
                    <div className="col-span-2 text-right">{l.tratativa}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

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

function BotaoFiltro({
  texto,
  ativo,
  aoClicar,
}: {
  texto: string;
  ativo: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={[
        "rounded-xl border px-4 py-2 text-sm font-semibold transition",
        ativo
          ? "border-white/20 bg-white/15 hover:bg-white/20"
          : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      {texto}
    </button>
  );
}
