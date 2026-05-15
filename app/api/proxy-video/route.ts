import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  // Basic scheme validation
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return Response.json(
      { error: "Invalid URL" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Forward range header so the browser can seek efficiently (206 partial responses)
  const upstreamHeaders: HeadersInit = {};
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  try {
    const upstream = await fetch(url, { headers: upstreamHeaders });

    const responseHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) responseHeaders.set("content-type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) responseHeaders.set("content-length", cl);
    const cr = upstream.headers.get("content-range");
    if (cr) responseHeaders.set("content-range", cr);
    const ar = upstream.headers.get("accept-ranges");
    if (ar) responseHeaders.set("accept-ranges", ar);
    responseHeaders.set("cache-control", "public, max-age=3600");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream" },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
