export const metadata = { title: "Preguntas frecuentes · readerblox" };

const QA: [string, string][] = [
  ["¿Qué es readerblox?", "Un lector privado de manga, manhwa y webtoons donde los autores publican su propio trabajo. Es un proyecto personal entre amigos."],
  ["¿Necesito cuenta para leer?", "No. Puedes leer sin cuenta. Con cuenta se guardan tu historial, tus estados y tus listas."],
  ["¿Qué significan los estados (Siguiendo, Pendiente, Leído…)?", "Son tu forma de organizar las obras. «Siguiendo» es el que activa los capítulos pendientes en el inicio: te avisa de los capítulos nuevos que aún no has leído. Los demás son solo etiquetas para ti."],
  ["¿Cuándo se marca un capítulo como leído?", "Al abrirlo en el lector, si tienes sesión iniciada. También puedes marcarlo o desmarcarlo a mano desde la página de la obra, o todos a la vez."],
  ["¿Cómo funcionan las listas?", "Creas una lista con el nombre que quieras y añades obras desde su página. Una lista es privada por defecto; si la haces pública, cualquiera puede verla."],
  ["¿Cómo publico mi obra?", "Pide a la persona que administra el sitio que active tu cuenta de creador. Después verás el apartado Estudio: creas la obra, subes la portada y los capítulos, y la publicas cuando quieras."],
  ["¿Qué formatos de imagen acepto al subir?", "JPG, PNG o WebP. Las páginas se reducen a un ancho máximo de 1600 px y se convierten a WebP en tu navegador antes de subirse. Se ordenan por nombre de archivo, así que numera tus archivos (01, 02, 03…)."],
  ["¿Puedo editar o borrar lo que subí?", "Sí. Desde el Estudio puedes ocultar, publicar o borrar cada capítulo, y editar los datos de tu obra en cualquier momento."],
  ["¿Hay una app para Android?", "Está en el plan, pero todavía no está lista."],
  ["¿Cómo borro mi cuenta o reporto un problema?", "Escribe a la persona que administra el sitio. Todavía no hay un botón de reportes."],
];

export default function Faq() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Preguntas frecuentes</h1>
      <div className="divide-y divide-line">
        {QA.map(([q, a]) => (
          <details key={q} className="py-3">
            <summary className="cursor-pointer font-medium">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
