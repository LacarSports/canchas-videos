import type { Metadata } from "next";
import LegalDoc from "../components/LegalDoc";

export const metadata: Metadata = {
  title: "Política de Privacidad · Lacar Sports",
  description:
    "Política de Privacidad de Lacar Sports SpA, conforme a la Ley N° 19.628 sobre protección de la vida privada.",
};

const ul = "list-disc pl-5 space-y-1.5 marker:text-crystal-400/60";

export default function PrivacidadPage() {
  return (
    <LegalDoc
      title="Política de Privacidad"
      updated="17 de junio de 2026"
      intro={
        <>
          En <strong className="text-snow">Lacar Sports SpA</strong> (&ldquo;Lacar Sports&rdquo;)
          respetamos tu privacidad. Esta Política describe qué datos tratamos, con qué
          finalidad y cuáles son tus derechos, conforme a la{" "}
          <strong className="text-snow">Ley N° 19.628</strong> sobre Protección de la Vida
          Privada de Chile y demás normativa aplicable.
        </>
      }
      sections={[
        {
          heading: "Datos que recopilamos",
          body: (
            <>
              <ul className={ul}>
                <li>
                  <strong className="text-snow">Identificador anónimo de sesión (session_id):</strong>{" "}
                  un identificador aleatorio guardado en tu navegador para generar estadísticas
                  de uso (por ejemplo, cuántas personas reproducen los partidos de un complejo).
                  No te identifica personalmente.
                </li>
                <li>
                  <strong className="text-snow">Correo electrónico de dueños de complejos:</strong>{" "}
                  para crear y administrar la cuenta de acceso al panel.
                </li>
                <li>
                  <strong className="text-snow">Videos de partidos:</strong> imágenes grabadas
                  por las cámaras instaladas en las canchas durante los horarios habilitados.
                </li>
                <li>
                  <strong className="text-snow">Reportes de soporte:</strong> el contenido que
                  nos envías al reportar un problema, junto con datos técnicos básicos del
                  dispositivo y navegador para poder diagnosticarlo.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Finalidad del tratamiento",
          body: (
            <>
              <p>Tratamos estos datos para:</p>
              <ul className={ul}>
                <li>Proveer y operar el servicio (grabar, almacenar y mostrar los partidos).</li>
                <li>
                  Entregar a los dueños de complejos estadísticas de ocupación y actividad de
                  sus canchas.
                </li>
                <li>Atender reportes de soporte y resolver incidencias.</li>
                <li>Mejorar y mantener la calidad y seguridad de la plataforma.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "No vendemos tus datos",
          body: (
            <p>
              Lacar Sports <strong className="text-snow">no vende ni comercializa</strong> tus
              datos personales a terceros. Solo compartimos información con proveedores que nos
              prestan servicios de infraestructura (ver punto siguiente), bajo obligaciones de
              confidencialidad, o cuando una autoridad competente lo requiera conforme a la ley.
            </p>
          ),
        },
        {
          heading: "Almacenamiento",
          body: (
            <p>
              Los datos se almacenan en servidores seguros, con medidas de protección técnicas y
              organizativas adecuadas para resguardarlos contra acceso, alteración o pérdida no
              autorizados.
            </p>
          ),
        },
        {
          heading: "Plazos de retención",
          body: (
            <ul className={ul}>
              <li>
                <strong className="text-snow">Videos de partidos:</strong> permanecen
                disponibles en la plataforma por <strong className="text-snow">7 días</strong>,
                tras lo cual se eliminan. Los clips que un jugador descarga quedan en su poder.
              </li>
              <li>
                <strong className="text-snow">Datos de cuenta:</strong> se conservan mientras la
                cuenta del complejo esté activa, y se eliminan o anonimizan dentro de un plazo
                razonable tras su cierre, salvo obligación legal de conservarlos.
              </li>
              <li>
                <strong className="text-snow">Estadísticas anónimas y reportes:</strong> se
                conservan por el tiempo necesario para las finalidades descritas.
              </li>
            </ul>
          ),
        },
        {
          heading: "Tus derechos",
          body: (
            <>
              <p>
                Conforme a la Ley N° 19.628, tienes derecho a solicitar, respecto de tus datos
                personales:
              </p>
              <ul className={ul}>
                <li>
                  <strong className="text-snow">Acceso:</strong> conocer qué datos tuyos tratamos.
                </li>
                <li>
                  <strong className="text-snow">Rectificación:</strong> corregir datos inexactos
                  o desactualizados.
                </li>
                <li>
                  <strong className="text-snow">Cancelación (eliminación):</strong> solicitar la
                  supresión de tus datos cuando proceda.
                </li>
              </ul>
              <p>
                Para ejercer estos derechos, escríbenos al correo de contacto indicado más
                abajo. Podremos solicitar información que acredite tu identidad antes de dar
                curso a la solicitud.
              </p>
            </>
          ),
        },
        {
          heading: "Cambios a esta Política",
          body: (
            <p>
              Podemos actualizar esta Política para reflejar cambios en el servicio o en la
              normativa. Publicaremos la versión vigente en esta página, indicando la fecha de
              última actualización.
            </p>
          ),
        },
        {
          heading: "Contacto",
          body: (
            <p>
              Para consultas sobre privacidad o para ejercer tus derechos, contáctanos en{" "}
              <a
                href="mailto:soporte@lacarsports.cl"
                className="text-crystal-400 hover:text-crystal-300 underline underline-offset-2"
              >
                soporte@lacarsports.cl
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
