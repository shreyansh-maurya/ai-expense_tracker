import { NextResponse } from "next/server";
import { buildExpensesCsv, buildTemplateCsv, exportFilename, getExpensesForExport } from "@/lib/services/csv";
import { parseUTCMidnight } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("template")) {
    const csv = "\ufeff" + buildTemplateCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="expenses-template.csv"',
      },
    });
  }

  const from = parseUTCMidnight(url.searchParams.get("from") ?? "");
  const to = parseUTCMidnight(url.searchParams.get("to") ?? "");
  if (url.searchParams.get("from") && !from) {
    return NextResponse.json({ error: "Invalid from date (use YYYY-MM-DD)" }, { status: 400 });
  }
  if (url.searchParams.get("to") && !to) {
    return NextResponse.json({ error: "Invalid to date (use YYYY-MM-DD)" }, { status: 400 });
  }

  const rows = await getExpensesForExport({
    from: from ? from.toISOString().slice(0, 10) : undefined,
    to: to ? to.toISOString().slice(0, 10) : undefined,
  });
  const csv = "\ufeff" + buildExpensesCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename()}"`,
    },
  });
}
