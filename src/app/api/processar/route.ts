import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { upload_id } = await req.json();

    if (!upload_id) {
      return NextResponse.json({ erro: "upload_id obrigatório" }, { status: 400 });
    }

    // 1) buscar o upload
    const { data: upload, error: erroUpload } = await supabaseAdmin
      .from("uploads")
      .select("id, tipo, caminho_storage, nome_arquivo")
      .eq("id", upload_id)
      .single();

    if (erroUpload || !upload) {
      return NextResponse.json({ erro: "Upload não encontrado" }, { status: 404 });
    }

    if (upload.tipo !== "velocidade") {
      return NextResponse.json({ erro: "Esse processador é só velocidade" }, { status: 400 });
    }

    // 2) baixar o arquivo do storage
    const { data: arquivo, error: erroDownload } = await supabaseAdmin.storage
      .from("relatorios")
      .download(upload.caminho_storage);

    if (erroDownload || !arquivo) {
      return NextResponse.json({ erro: "Falha ao baixar arquivo" }, { status: 500 });
    }

    // 3) ler XLSX
    const arrayBuffer = await arquivo.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const primeiraAba = workbook.SheetNames[0];
    const sheet = workbook.Sheets[primeiraAba];

    // transforma em linhas (objetos)
    const linhas = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    // 4) PROCESSAMENTO (placeholder real)
    // >>> aqui no próximo passo a gente ajusta com as colunas reais do seu relatório de velocidade <<<
    const totalLinhas = linhas.length;

    const resumo = {
      nome_arquivo: upload.nome_arquivo,
      total_linhas: totalLinhas,
      gerado_em: new Date().toISOString(),
      // depois: total_infracoes, placas, motoristas, etc
    };

    // 5) salvar dashboards
    const { error: erroDash } = await supabaseAdmin
      .from("dashboards")
      .upsert({
        upload_id: upload.id,
        tipo: "velocidade",
        resumo,
        atualizado_em: new Date().toISOString(),
      });

    if (erroDash) {
      return NextResponse.json({ erro: "Falha ao salvar dashboard" }, { status: 500 });
    }

    // 6) marcar upload como processado
    const { error: erroStatus } = await supabaseAdmin
      .from("uploads")
      .update({ status: "processado" })
      .eq("id", upload.id);

    if (erroStatus) {
      return NextResponse.json({ erro: "Falha ao atualizar status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, resumo });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { erro: e?.message || "Erro inesperado" },
      { status: 500 }
    );
  }
}
