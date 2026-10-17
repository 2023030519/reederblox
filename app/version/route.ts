// The deployed build's version. Clients compare it with the one their (maybe cached) code was built with.
export const dynamic = "force-static";

export const GET = () => new Response(process.env.NEXT_PUBLIC_VERSION ?? "dev", { headers: { "content-type": "text/plain" } });
