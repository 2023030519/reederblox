export const metadata = { title: "Normas · readerblox" };

export default function Rules() {
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Normas de la comunidad</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Solo obra propia</h2>
        <p>Aquí solo se publica trabajo del que eres autor o tienes permiso expreso del autor para publicarlo. No se suben obras de terceros, ni traducciones o escaneos de obras comerciales, ni material robado o copiado.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Qué no se permite</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Contenido sexual explícito o con menores, o violencia gráfica sin aviso.</li>
          <li>Acoso, insultos o discriminación, en comentarios o en las obras.</li>
          <li>Spam, publicidad o enlaces engañosos.</li>
          <li>Datos personales de otras personas sin su permiso.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Si algo infringe estas normas</h2>
        <p>Quien administra el sitio puede ocultar o borrar una obra, un capítulo o un comentario, y quitar el permiso de creador, sin aviso previo. Si crees que una obra tuya o ajena está publicada sin permiso, avisa a quien administra el sitio y se retira.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tu cuenta y tus datos</h2>
        <p>Guardamos tu correo para iniciar sesión, tu historial de lectura, tus estados y tus listas. No se comparten con nadie ni se venden. Para borrar tu cuenta, pídelo a quien administra el sitio.</p>
      </section>
    </article>
  );
}
