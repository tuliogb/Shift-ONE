"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LinhaVelocidade = {
  placa: string;
  qtd_infracoes: number | null;
  dias_pego: number | null;
  tratativa: number | null;
  atualizado_em: string | null;
};

type LinhaHoras = {
  placa: string;
  qtd_infracoes_10h: number | null;
  qtd_gravissimas_12h: number | null;
  dias_pego: number | null;
  tratativa: number | null;
  atualizado_em: string | null;
};

type TipoCampeonato = "velocidade" | "horas";
type SortKeyVel = "infracoes" | "proporcao" | "tratativas";
type SortKeyHoras = "infracoes10" | "gravissimas12" | "proporcao" | "tratativas";

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

  const [tipoCampeonato, setTipoCampeonato] = useState<TipoCampeonato>("velocidade");

  const [linhasVel, setLinhasVel] = useState<LinhaVelocidade[]>([]);
  const [linhasHoras, setLinhasHoras] = useState<LinhaHoras[]>([]);
  const [totalDiasOperacao, setTotalDiasOperacao] = useState<number>(0);

  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [sortKeyVel, setSortKeyVel] = useState<SortKeyVel>("infracoes");
  const [sortKeyHoras, setSortKeyHoras] = useState<SortKeyHoras>("infracoes10");

  useEffect(() => {
    async function carregar() {
      setErro(null);
      setCarregando(true);

      const { data: sessaoData } = await supabase.auth.getSession();
      if (!sessaoData.session) {
        router.replace("/login");
        return;
      }

      // 1) total de dias do sistema
      const { count: countDias, error: errDias } = await supabase
        .from("operacao_dias")
        .select("dia", { count: "exact", head: true });

      if (errDias) {
        console.error(errDias);
        setTotalDiasOperacao(0);
      } else {
        setTotalDiasOperacao(countDias ?? 0);
      }

      // 2) carrega os dois rankings (sem depender de UI)
      const [{ data: vData, error: vErr }, { data: hData, error: hErr }] = await Promise.all([
        supabase
          .from("velocidade_global")
          .select("placa, qtd_infracoes, dias_pego, tratativa, atualizado_em")
          .limit(5000),
        supabase
          .from("horas_global")
          .select("placa, qtd_infracoes_10h, qtd_gravissimas_12h, dias_pego, tratativa, atualizado_em")
          .limit(5000),
      ]);

      if (vErr) console.error("velocidade_global:", vErr);
      if (hErr) console.error("horas_global:", hErr);

      // Se os dois falharem, mostra erro geral
      if (vErr && hErr) {
        setErro("Falha ao buscar ranking (velocidade_global e horas_global).");
        setLinhasVel([]);
        setLinhasHoras([]);
        setCarregando(false);
        return;
      }

      setLinhasVel((vData ?? []) as LinhaVelocidade[]);
      setLinhasHoras((hData ?? []) as LinhaHoras[]);
      setCarregando(false);
    }

    carregar();
  }, [router]);

  const linhasOrdenadas = useMemo(() => {
    const td = totalDiasOperacao;
    const mult = sortDir === "desc" ? -1 : 1;

    if (tipoCampeonato === "velocidade") {
      const lista = (linhasVel ?? []).map((l) => {
        const placa = normalizarPlaca(l.placa);
        const infracoes = l.qtd_infracoes ?? 0;
        const diasPegos = l.dias_pego ?? 0;
        const tratativa = l.tratativa ?? 0;
        const proporcao = td > 0 ? diasPegos / td : 0;

        return { ...l, placa, infracoes, diasPegos, tratativa, proporcao };
      });

      lista.sort((a, b) => {
        const va =
          sortKeyVel === "infracoes"
            ? a.infracoes
            : sortKeyVel === "tratativas"
              ? a.tratativa
              : a.proporcao;

        const vb =
          sortKeyVel === "infracoes"
            ? b.infracoes
            : sortKeyVel === "tratativas"
              ? b.tratativa
              : b.proporcao;

        if (va < vb) return 1 * mult;
        if (va > vb) return -1 * mult;

        if (a.infracoes !== b.infracoes) return b.infracoes - a.infracoes;
        return a.placa.localeCompare(b.placa);
      });

      return { tipo: "velocidade" as const, lista };
    }

    // horas
    const lista = (linhasHoras ?? []).map((l) => {
      const placa = normalizarPlaca(l.placa);
      const infracoes10 = l.qtd_infracoes_10h ?? 0;
      const gravissimas12 = l.qtd_gravissimas_12h ?? 0;
      const diasPegos = l.dias_pego ?? 0;
      const tratativa = l.tratativa ?? 0;
      const proporcao = td > 0 ? diasPegos / td : 0;

      return { ...l, placa, infracoes10, gravissimas12, diasPegos, tratativa, proporcao };
    });

    lista.sort((a, b) => {
      const va =
        sortKeyHoras === "infracoes10"
          ? a.infracoes10
          : sortKeyHoras === "gravissimas12"
            ? a.gravissimas12
            : sortKeyHoras === "tratativas"
              ? a.tratativa
              : a.proporcao;

      const vb =
        sortKeyHoras === "infracoes10"
          ? b.infracoes10
          : sortKeyHoras === "gravissimas12"
            ? b.gravissimas12
            : sortKeyHoras === "tratativas"
              ? b.tratativa
              : b.proporcao;

      if (va < vb) return 1 * mult;
      if (va > vb) return -1 * mult;

      // desempate: gravissimas > infracoes10 > placa
      if (a.gravissimas12 !== b.gravissimas12) return b.gravissimas12 - a.gravissimas12;
      if (a.infracoes10 !== b.infracoes10) return b.infracoes10 - a.infracoes10;
      return a.placa.localeCompare(b.placa);
    });

    return { tipo: "horas" as const, lista };
  }, [tipoCampeonato, linhasVel, linhasHoras, sortDir, sortKeyVel, sortKeyHoras, totalDiasOperacao]);

  function setOrdenacaoVel(chave: SortKeyVel) {
    if (chave === sortKeyVel) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKeyVel(chave);
    setSortDir("desc");
  }

  function setOrdenacaoHoras(chave: SortKeyHoras) {
    if (chave === sortKeyHoras) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKeyHoras(chave);
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

            <div className="flex flex-wrap items-center gap-2">
              <BotaoFiltro
                ativo={tipoCampeonato === "velocidade"}
                texto="Velocidade"
                aoClicar={() => setTipoCampeonato("velocidade")}
              />
              <BotaoFiltro
                ativo={tipoCampeonato === "horas"}
                texto="Dirigindo e Parado"
                aoClicar={() => setTipoCampeonato("horas")}
              />
            </div>
          </div>

          {/* Ordenação */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tipoCampeonato === "velocidade" ? (
              <>
                <BotaoFiltro
                  ativo={sortKeyVel === "infracoes"}
                  texto={`Infrações ${sortKeyVel === "infracoes" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoVel("infracoes")}
                />
                <BotaoFiltro
                  ativo={sortKeyVel === "proporcao"}
                  texto={`Proporção de dias ${sortKeyVel === "proporcao" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoVel("proporcao")}
                />
                <BotaoFiltro
                  ativo={sortKeyVel === "tratativas"}
                  texto={`Tratativas ${sortKeyVel === "tratativas" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoVel("tratativas")}
                />
              </>
            ) : (
              <>
                <BotaoFiltro
                  ativo={sortKeyHoras === "infracoes10"}
                  texto={`Infrações (≥10h) ${sortKeyHoras === "infracoes10" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoHoras("infracoes10")}
                />
                <BotaoFiltro
                  ativo={sortKeyHoras === "gravissimas12"}
                  texto={`Gravíssimas (≥12h) ${sortKeyHoras === "gravissimas12" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoHoras("gravissimas12")}
                />
                <BotaoFiltro
                  ativo={sortKeyHoras === "proporcao"}
                  texto={`Proporção de dias ${sortKeyHoras === "proporcao" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoHoras("proporcao")}
                />
                <BotaoFiltro
                  ativo={sortKeyHoras === "tratativas"}
                  texto={`Tratativas ${sortKeyHoras === "tratativas" ? (sortDir === "desc" ? "↓" : "↑") : ""}`}
                  aoClicar={() => setOrdenacaoHoras("tratativas")}
                />
              </>
            )}
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
          ) : (
            <>
              {linhasOrdenadas.tipo === "velocidade" ? (
                linhasOrdenadas.lista.length === 0 ? (
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
                      {linhasOrdenadas.lista.map((l: any, idx: number) => (
                        <button
                          key={l.placa}
                          type="button"
                          className="grid w-full grid-cols-12 items-center px-4 py-3 text-left text-sm hover:bg-white/5 transition"
                          onClick={() => {
                            const url = `/campeonato/placa/${l.placa}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <div className="col-span-1 text-white/70">
                            {medalhaPorPosicao(idx) ? medalhaPorPosicao(idx) : idx + 1}
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
                )
              ) : linhasOrdenadas.lista.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  Ainda não existem dados na horas_global.
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-12 bg-white/5 px-4 py-3 text-xs text-white/60">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Placa</div>
                    <div className="col-span-2">Infrações (≥10h)</div>
                    <div className="col-span-2">Gravíssimas (≥12h)</div>
                    <div className="col-span-2">Proporção</div>
                    <div className="col-span-2 text-right">Tratativas</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {linhasOrdenadas.lista.map((l: any, idx: number) => (
                      <button
                        key={l.placa}
                        type="button"
                        className="grid w-full grid-cols-12 items-center px-4 py-3 text-left text-sm hover:bg-white/5 transition"
                        onClick={() => {
                          // rota separada pra horas (opcional, mas recomendo)
                          const url = `/campeonato/horas/placa/${l.placa}`;
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <div className="col-span-1 text-white/70">
                          {medalhaPorPosicao(idx) ? medalhaPorPosicao(idx) : idx + 1}
                        </div>

                        <div className="col-span-3 font-semibold">{l.placa}</div>
                        <div className="col-span-2">{l.infracoes10}</div>
                        <div className="col-span-2">{l.gravissimas12}</div>
                        <div className="col-span-2">{formatarPorcentagem(l.proporcao)}</div>
                        <div className="col-span-2 text-right">{l.tratativa}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
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
        ativo ? "border-white/20 bg-white/15 hover:bg-white/20" : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      {texto}
    </button>
  );
}