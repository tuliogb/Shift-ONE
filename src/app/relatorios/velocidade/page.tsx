"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Upload = {
  id: string;
  criado_em: string;
  nome_arquivo: string;
  tipo: string;
  caminho_storage: string;
  tamanho_bytes: number | null;
  status: string | null;
};

export default function PaginaVelocidade() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setErro(null);

      const { data: sessaoData } = await supabase.auth.getSession();
      if (!sessaoData.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("uploads")
        .select("id, criado_em, nome_arquivo, tipo, caminho_storage, tamanho_bytes, status")
        .eq("tipo", "velocidade")
        .order("criado_em", { ascending: false })
        .limit(31);

      if (error) {
        console.error(error);
        setErro("Falha ao buscar uploads.");
        setUploads([]);
        setCarregando(false);
        return;
      }

      setUploads((data ?? []) as Upload[]);
      setCarregando(false);
    }

    carregar();
  }, [router]);

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

  function formatarTamanho(bytes: number | null) {
    if (bytes == null) return "-";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  async function aoClicarUpload(uploadId: string) {
    try {
      setErro(null);
      setProcessandoId(uploadId);

      // 1) Se já tem dashboard pronto, NÃO chama edge: só navega
      const { data: dash, error: errDash } = await supabase
        .from("dashboards")
        .select("resumo")
        .eq("upload_id", uploadId)
        .single();

      if (!errDash && dash?.resumo?.ok === true && dash?.resumo?.processado_global === true) {
        router.push(`/relatorios/velocidade/${uploadId}`);
        return;
      }

      // 2) Senão chama edge pra processar
      const { data, error } = await supabase.functions.invoke("processar-upload", {
        body: { upload_id: uploadId },
      });

      if (error) {
        console.error("ERRO EDGE:", error);
        setErro("Falha ao iniciar processamento (edge function).");
        return;
      }

      console.log("RETORNO data:", data);
      router.push(`/relatorios/velocidade/${uploadId}`);
    } finally {
      setProcessandoId(null);
    }
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
            <BotaoMenu texto="Campeonato" aoClicar={() => router.push("/campeonato")} />
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
            <BotaoMenu texto="Campeonato" aoClicar={() => router.push("/campeonato")} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          <div>
            <h1 className="text-2xl font-semibold">Velocidade</h1>
            <p className="mt-1 text-white/70">Histórico de uploads do relatório de velocidade.</p>
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
          ) : uploads.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              Nenhum upload encontrado ainda.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-12 bg-white/5 px-4 py-3 text-xs text-white/60">
                <div className="col-span-6">Arquivo</div>
                <div className="col-span-3">Data</div>
                <div className="col-span-2 text-right">Tamanho</div>
                <div className="col-span-1 text-right">Status</div>
              </div>

              <div className="divide-y divide-white/10">
                {uploads.map((u) => {
                  const bloqueado = processandoId === u.id;

                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={bloqueado}
                      className={`grid w-full grid-cols-12 items-center px-4 py-4 text-left transition ${
                        bloqueado ? "opacity-60 cursor-not-allowed" : "hover:bg-white/5"
                      }`}
                      onClick={() => aoClicarUpload(u.id)}
                    >
                      <div className="col-span-6">
                        <p className="text-sm font-semibold text-white/90 line-clamp-1">
                          {u.nome_arquivo}
                        </p>
                        <p className="mt-1 text-xs text-white/50 line-clamp-1">
                          {u.caminho_storage}
                        </p>
                        {bloqueado && (
                          <p className="mt-2 text-xs text-white/60">Processando...</p>
                        )}
                      </div>

                      <div className="col-span-3 text-sm text-white/80">
                        {formatarData(u.criado_em)}
                      </div>

                      <div className="col-span-2 text-right text-sm text-white/80">
                        {formatarTamanho(u.tamanho_bytes)}
                      </div>

                      <div className="col-span-1 text-right text-xs text-white/60">
                        {u.status ?? "-"}
                      </div>
                    </button>
                  );
                })}
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
