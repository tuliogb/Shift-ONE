"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DiaStatus = "ok" | "faltou" | "hoje_faltou" | "futuro";

export default function Home() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [diasComUpload, setDiasComUpload] = useState<Set<string>>(new Set());
  const [tipoRelatorio, setTipoRelatorio] = useState<"velocidade" | "ligado_desligado">("velocidade");

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [statusUpload, setStatusUpload] = useState<"idle" | "enviando" | "ok" | "erro">("idle");
  const [mensagemUpload, setMensagemUpload] = useState<string>("");

  // Monta os últimos 7 dias (inclui hoje)
  const ultimos7 = useMemo(() => {
    const hoje = new Date();
    const lista: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setHours(0, 0, 0, 0);
      d.setDate(hoje.getDate() - i);
      lista.push(d);
    }
    return lista;
  }, []);

  function chaveDataLocal(d: Date) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function letraDiaSemana(d: Date) {
    // pt-BR: domingo = 0
    const nomes = ["D", "S", "T", "Q", "Q", "S", "S"];
    return nomes[d.getDay()];
  }

  useEffect(() => {
    async function checarSessaoECarregarSemana() {
      // 1) proteger rota
      const { data } = await supabase.auth.getSession();
      const sessao = data.session;

      if (!sessao) {
        router.replace("/login");
        return;
      }

      // 2) buscar uploads dos últimos 7 dias
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      inicio.setDate(inicio.getDate() - 6);

      const fim = new Date();
      fim.setHours(23, 59, 59, 999);

      const { data: uploads, error } = await supabase
        .from("uploads")
        .select("criado_em")
        .gte("criado_em", inicio.toISOString())
        .lte("criado_em", fim.toISOString());

      if (error) {
        console.error("Erro ao buscar uploads:", error);
        setDiasComUpload(new Set());
        setCarregando(false);
        return;
      }

      const conjunto = new Set<string>();
      for (const u of uploads ?? []) {
        const dt = new Date(u.criado_em);
        dt.setHours(0, 0, 0, 0);
        conjunto.add(chaveDataLocal(dt));
      }

      setDiasComUpload(conjunto);
      setCarregando(false);
    }

    checarSessaoECarregarSemana();
  }, [router]);

  function validarXlsx(f: File) {
    const nome = f.name.toLowerCase();
    return nome.endsWith(".xlsx");
  }

  function limparNomeArquivo(nome: string) {
    return nome
      .normalize("NFD") // separa acentos
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-zA-Z0-9._-]+/g, "_") // só deixa seguro
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function enviarArquivo(f: File) {
    try {
      setStatusUpload("enviando");
      setMensagemUpload("");

      // Limite preventivo
      const maxBytes = 45 * 1024 * 1024; // 45MB
      if (f.size > maxBytes) {
        setStatusUpload("erro");
        setMensagemUpload("Arquivo muito grande. Envie até 45MB.");
        return;
      }

      const { data: sessaoData, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao || !sessaoData.session) {
        setStatusUpload("erro");
        setMensagemUpload("Sessão inválida. Faça login novamente.");
        return;
      }

      const userId = sessaoData.session.user.id;

      // caminho no storage: tipoRelatorio/AAAA-MM-DD/timestamp_nome.xlsx
      const agora = new Date();
      const ano = agora.getFullYear();
      const mes = String(agora.getMonth() + 1).padStart(2, "0");
      const dia = String(agora.getDate()).padStart(2, "0");

      const nomeLimpo = limparNomeArquivo(f.name);
      const caminho = `${tipoRelatorio}/${ano}-${mes}-${dia}/${Date.now()}_${nomeLimpo}`;

      // 1) sobe no storage
      const { data: storageData, error: erroUpload } = await supabase.storage
        .from("relatorios")
        .upload(caminho, f, {
          upsert: false,
          contentType:
            f.type && f.type.length > 0
              ? f.type
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

      if (erroUpload) {
        console.error("ERRO NO UPLOAD (storage):", erroUpload);
        console.error("DETALHES storage:", JSON.stringify(erroUpload, null, 2));
        setStatusUpload("erro");
        setMensagemUpload(erroUpload.message || "Falha ao enviar arquivo.");
        return;
      }

      // 2) grava na tabela uploads
      // (criado_em não precisa, pq o banco preenche com now())
      const { error: erroInsert } = await supabase.from("uploads").insert({
        nome_arquivo: f.name,
        tipo: tipoRelatorio,
        caminho_storage: storageData?.path ?? caminho,
        tamanho_bytes: f.size,
        user_id: userId,
        status: "enviado",
      });

      if (erroInsert) {
        console.error("ERRO NO INSERT (uploads):", erroInsert);
        console.error("DETALHES insert:", JSON.stringify(erroInsert, null, 2));

        // rollback: remove o arquivo que já subiu
        const { error: erroRemove } = await supabase.storage
          .from("relatorios")
          .remove([caminho]);

        if (erroRemove) {
          console.error("Falha ao remover arquivo após erro de insert:", erroRemove);
        }

        setStatusUpload("erro");
        setMensagemUpload("Arquivo foi enviado, mas falhou ao registrar na tabela uploads.");
        return;
      }

      setStatusUpload("ok");
      setMensagemUpload("Arquivo enviado e registrado com sucesso!");

      // atualiza semana sem recarregar
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const chaveHoje = chaveDataLocal(hoje);
      setDiasComUpload((ant) => new Set([...ant, chaveHoje]));
    } catch (e: any) {
      console.error("ERRO INESPERADO:", e);
      setStatusUpload("erro");
      setMensagemUpload(e?.message || "Erro inesperado ao enviar.");
    }
  }


  if (carregando) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          Carregando...
        </div>
      </main>
    );
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const chaveHoje = chaveDataLocal(hoje);

  const totalOk = ultimos7.filter((d) => diasComUpload.has(chaveDataLocal(d))).length;
  const hojeTemUpload = diasComUpload.has(chaveHoje);

  return (
    <main className="min-h-screen text-white">
      {/* Fundo */}
      <div className="fixed inset-0 -z-10 bg-[#070B12]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.18),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.14),transparent_55%)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070B12]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
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

          {/* Menu */}
          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href="/relatorios/velocidade"
              className="rounded-xl px-4 py-2 text-sm font-semibold border bg-white/5 border-white/10 hover:bg-white/10"
            >
              Velocidade
            </Link>

            <Link
              href="/relatorios/ligado-desligado"
              className="rounded-xl px-4 py-2 text-sm font-semibold border bg-white/5 border-white/10 hover:bg-white/10"
            >
              Ligado e Desligado
            </Link>
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

        {/* Menu mobile */}
        <div className="md:hidden border-t border-white/10">
          <div className="mx-auto flex max-w-7xl gap-2 px-6 py-3">
            <Link
              href="/relatorios/velocidade"
              className="rounded-xl px-4 py-2 text-sm font-semibold border bg-white/5 border-white/10 hover:bg-white/10"
            >
              Velocidade
            </Link>

            <Link
              href="/relatorios/ligado-desligado"
              className="rounded-xl px-4 py-2 text-sm font-semibold border bg-white/5 border-white/10 hover:bg-white/10"
            >
              Ligado e Desligado
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold">Conferência da semana</h1>
              <p className="mt-1 text-white/70">Últimos 7 dias (inclui hoje)</p>
            </div>

            <div className="text-right">
              <p className="text-sm text-white/60">Semana</p>
              <p className="text-3xl font-semibold">{totalOk}/7</p>
            </div>
          </div>

          {!hojeTemUpload && (
            <div className="mt-5 rounded-2xl border border-[#00AEEF]/30 bg-[#00AEEF]/10 px-4 py-3 text-sm text-white/90">
              Hoje ainda <span className="font-semibold">não</span> teve upload.
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {ultimos7.map((d) => {
              const chave = chaveDataLocal(d);
              const tem = diasComUpload.has(chave);

              let status: DiaStatus = "faltou";
              if (d.getTime() > hoje.getTime()) status = "futuro";
              else if (tem) status = "ok";
              else if (chave === chaveHoje) status = "hoje_faltou";
              else status = "faltou";

              return <PillDia key={chave} letra={letraDiaSemana(d)} diaNumero={d.getDate()} status={status} />;
            })}
          </div>

          <p className="mt-4 text-sm text-white/60">
            Dica: “faltou” aparece em tom neutro, "enviado" azul, e o atual consta em aberto até o momento do envio.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Esquerda: tipo do relatório */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
                <h2 className="text-base font-semibold">Qual relatório irá fazer o upload?</h2>
                <p className="mt-1 text-sm text-white/70">Escolha o tipo para organizar o processamento e os indicadores.</p>

                <div className="mt-5 space-y-3">
                  <OpcaoRelatorio
                    titulo="Velocidade"
                    descricao="Acima de 120 km/h"
                    selecionado={tipoRelatorio === "velocidade"}
                    aoClicar={() => setTipoRelatorio("velocidade")}
                  />

                  <OpcaoRelatorio
                    titulo="Ligado e Desligado"
                    descricao="Tempo rodando direto"
                    selecionado={tipoRelatorio === "ligado_desligado"}
                    aoClicar={() => setTipoRelatorio("ligado_desligado")}
                  />
                </div>
              </div>
            </div>

            {/* Direita: upload box */}
            <div className="lg:col-span-8">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
                <h2 className="text-base font-semibold">Enviar arquivo</h2>
                <p className="mt-1 text-sm text-white/70">Arraste o arquivo aqui ou clique para selecionar.</p>

                <div className="mt-4 rounded-3xl border border-dashed border-white/20 bg-white/5 p-4 text-center hover:bg-white/10 transition">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00AEEF]/40 to-[#7A4CFF]/30">
                    <span className="text-lg font-semibold">↑</span>
                  </div>

                  <p className="mt-4 text-sm text-white/80">
                    Solte seu <span className="font-semibold">.xlsx</span> aqui
                  </p>

                  <input
                    id="input-arquivo"
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.target as HTMLInputElement;
                      const f = input.files?.[0];
                      if (!f) return;

                      if (!validarXlsx(f)) {
                        setStatusUpload("erro");
                        setMensagemUpload("Envie um arquivo .xlsx");
                        input.value = "";
                        return;
                      }

                      setArquivo(f);
                      await enviarArquivo(f);
                      input.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => document.getElementById("input-arquivo")?.click()}
                    className="mt-3 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                  >
                    Selecionar arquivo
                  </button>

                  {arquivo && (
                    <p className="mt-3 text-xs text-white/60">
                      Arquivo: <span className="text-white/80">{arquivo.name}</span>
                    </p>
                  )}

                  {statusUpload !== "idle" && (
                    <div
                      className={[
                        "mt-3 rounded-2xl border px-4 py-3 text-sm",
                        statusUpload === "ok"
                          ? "border-[#00AEEF]/30 bg-[#00AEEF]/10 text-white"
                          : statusUpload === "enviando"
                          ? "border-white/10 bg-white/5 text-white/80"
                          : "border-white/15 bg-white/5 text-white/80",
                      ].join(" ")}
                    >
                      {statusUpload === "enviando" ? "Enviando..." : mensagemUpload}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PillDia({
  letra,
  diaNumero,
  status,
}: {
  letra: string;
  diaNumero: number;
  status: DiaStatus;
}) {
  const classes =
    status === "ok"
      ? "border-transparent bg-gradient-to-r from-[#00AEEF]/35 to-[#7A4CFF]/25 text-white"
      : status === "hoje_faltou"
      ? "border-[#00AEEF]/35 bg-[#00AEEF]/10 text-white"
      : status === "faltou"
      ? "border-white/10 bg-white/5 text-white/70"
      : "border-white/5 bg-white/0 text-white/35";

  const marcador = "•";

  return (
    <div
      className={["flex items-center gap-2 rounded-2xl border px-3 py-2 backdrop-blur", classes].join(" ")}
      title={
        status === "ok"
          ? "Teve upload"
          : status === "hoje_faltou"
          ? "Hoje ainda sem upload"
          : status === "faltou"
          ? "Sem upload"
          : "Futuro"
      }
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
        <span className="text-sm font-semibold">{letra}</span>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">{diaNumero}</p>
        <p className="text-xs opacity-80">{marcador}</p>
      </div>
    </div>
  );
}

function OpcaoRelatorio({
  titulo,
  descricao,
  selecionado = false,
  aoClicar,
}: {
  titulo: string;
  descricao: string;
  selecionado?: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={[
        "w-full rounded-2xl border p-3 text-left transition",
        selecionado ? "border-[#00AEEF]/40 bg-[#00AEEF]/10" : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="mt-1 text-sm text-white/70">{descricao}</p>
        </div>

        <div
          className={[
            "h-5 w-5 rounded-full border",
            selecionado ? "border-[#00AEEF]/60 bg-[#00AEEF]/30" : "border-white/20 bg-transparent",
          ].join(" ")}
        />
      </div>
    </button>
  );
}
