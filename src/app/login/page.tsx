"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PaginaLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro(null);
    setCarregando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
    });

    console.log("LOGIN RESULT:", data, error);

    setCarregando(false);

    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    console.log("USER:", data?.user);

    router.push("/home");
  }

  return (
    <main className="min-h-screen text-white">
      {/* Fundo */}
      <div className="fixed inset-0 -z-10 bg-[#070B12]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_circle_at_20%_15%,rgba(0,174,239,0.35),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(120,68,255,0.25),transparent_55%),radial-gradient(900px_circle_at_60%_85%,rgba(0,174,239,0.18),transparent_55%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.06] bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22 viewBox=%220 0 4 4%22%3E%3Cpath fill=%22%23ffffff%22 fill-opacity=%221%22 d=%22M1 0h1v1H1V0zm2 2h1v1H3V2z%22/%3E%3C/svg%3E')]" />

      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <div className="grid w-full grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
          {/* Marca/mensagem */}
          <section className="hidden md:block">
            <div className="inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#00AEEF] to-[#7A4CFF] p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#070B12]">
                  <span className="text-base font-semibold">pró+</span>
                </div>
              </div>
              <div className="leading-tight">
                <p className="text-sm text-white/70">Portal de Monitoramento</p>
                <p className="text-lg font-semibold">Club Pro+</p>
              </div>
            </div>

            <h1 className="mt-10 text-4xl font-semibold tracking-tight whitespace-nowrap">
              Controle diário, visão clara.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-white/70">
              Uploads por dia, ranking de infrações e indicadores de risco — tudo
              em um painel simples.
            </p>

            <div className="mt-12 grid max-w-lg grid-cols-2 gap-5">
              <CartaoInfo titulo="Calendário" texto="Dias com upload marcados" />
              <CartaoInfo titulo="Campeonato" texto="Ranking dos infratores" />
              <CartaoInfo titulo="Auditoria" texto="Histórico de arquivos" />
              <CartaoInfo titulo="Filtros" texto="Placa, período, motorista" />
            </div>
          </section>

          {/* Card login */}
          <section className="mx-auto w-full max-w-lg scale-[1.06]">
            <div className="relative rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
              <div className="absolute -top-[1px] left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-[#00AEEF] to-transparent opacity-70" />

              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#00AEEF] to-[#7A4CFF] p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#070B12]">
                    <span className="text-base font-semibold">pró+</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Entrar</h2>
                  <p className="text-sm text-white/70">
                    Acesse com as credenciais fornecidas.
                  </p>
                </div>
              </div>

              <form className="mt-7 space-y-5">
                <Campo
                  label="E-mail"
                  placeholder="seuemail@empresa.com"
                  valor={email}
                  aoMudar={setEmail}
                  nome="email"
                  autoComplete="email"
                />

                <Campo
                  label="Senha"
                  placeholder="••••••••"
                  tipo="password"
                  valor={senha}
                  aoMudar={setSenha}
                  aoEnter={entrar}
                  nome="password"
                  autoComplete="current-password"
                />


                {erro && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {erro}
                  </div>
                )}

                <button
                  type="button"
                  onClick={entrar}
                  disabled={carregando}
                  className="mt-1 w-full rounded-2xl bg-gradient-to-r from-[#00AEEF] to-[#7A4CFF] px-5 py-4 text-base font-semibold shadow-lg shadow-[#00AEEF]/10 transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
                >
                  {carregando ? "Entrando..." : "Entrar"}
                </button>

                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className="text-white/60">Esqueceu a senha?</span>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-white/80 hover:bg-white/10"
                    onClick={() => setErro("Ainda vamos implementar recuperação de senha.")}
                  >
                    Recuperar
                  </button>
                </div>
              </form>

              <p className="mt-7 text-center text-xs text-white/50">
                © {new Date().getFullYear()} Promais. Todos os direitos
                reservados.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Campo({
  label,
  placeholder,
  tipo = "text",
  valor,
  aoMudar,
  aoEnter,
  nome,
  autoComplete,
}: {
  label: string;
  placeholder: string;
  tipo?: string;
  valor: string;
  aoMudar: (novo: string) => void;
  aoEnter?: () => void;
  nome: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/70">{label}</span>
      <input
        name={nome}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        type={tipo}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onInput={(e) => aoMudar((e.target as HTMLInputElement).value)} // <- pega autofill também
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            aoEnter?.();
          }
        }}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white placeholder:text-white/35 outline-none transition focus:border-[#00AEEF]/60 focus:bg-white/10"
      />
    </label>
  );
}


function CartaoInfo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mt-2 text-sm text-white/70">{texto}</p>
    </div>
  );
}
