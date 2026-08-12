import type { Metadata } from "next";
import LegalDoc from "../components/LegalDoc";

export const metadata: Metadata = {
  title: "Política de Privacidad · Lacar Sports",
  description:
    "Política de Privacidad y Tratamiento de Datos Personales de LacarSports, conforme a las Leyes N° 19.628 y N° 21.719 de la República de Chile.",
};

const ul = "list-disc pl-5 space-y-1.5 marker:text-crystal-400/60";
const ol = "list-decimal pl-5 space-y-1.5 marker:text-crystal-400/60";
const mail = "text-crystal-400 hover:text-crystal-300 underline underline-offset-2";

export default function PrivacidadPage() {
  return (
    <LegalDoc
      title="Política de Privacidad y Tratamiento de Datos Personales"
      updated="agosto de 2026"
      sections={[
        {
          heading: "Marco general y compromiso con la privacidad",
          body: (
            <>
              <p>
                La empresa propietaria y operadora de la tecnología (en adelante, la
                &ldquo;Organización&rdquo;) asume un compromiso estricto con el resguardo, la
                confidencialidad y la protección de la información de los usuarios que acceden,
                navegan o registran credenciales en el Sitio Web www.lacarsports.cl (en adelante,
                el &ldquo;Usuario&rdquo;). Asimismo, este documento regula la protección de los
                datos de aquellas personas cuyas imágenes de audiovideo son captados de forma
                automatizada mediante la infraestructura técnica instalada en los recintos
                deportivos clientes de la Organización.
              </p>
              <p>
                Si el Usuario entrega o facilita información de terceros a la Organización,
                declara bajo su exclusiva responsabilidad que dispone de las autorizaciones
                obligatorias de los titulares del dato y garantiza la veracidad de los
                antecedentes entregados.
              </p>
              <p>
                Todas las operaciones de recopilación, almacenamiento, sistematización y
                procesamiento de datos se ejecutan en estricta observancia de la normativa vigente
                en la República de Chile, con especial sujeción a la{" "}
                <strong className="text-snow">Ley N° 19.628</strong> sobre Protección de la Vida
                Privada y a la <strong className="text-snow">Ley N° 21.719</strong> que regula el
                tratamiento de datos personales y crea la Agencia de Protección de Datos
                Personales.
              </p>
            </>
          ),
        },
        {
          heading: "Categorías de información objeto de procesamiento",
          body: (
            <>
              <p>
                Mediante la interacción con el Portal, la Organización puede clasificar, utilizar
                y almacenar diferentes clases de antecedentes del Usuario, los cuales se agrupan
                bajo los siguientes puntos:
              </p>
              <ul className={ul}>
                <li>
                  <strong className="text-snow">Identificadores de identidad:</strong> Nombre
                  completo, apellidos, alias o identificadores del perfil digital, RUT o número de
                  documento nacional de identidad, así como las imágenes capturadas en los
                  archivos de video o resúmenes de jugadas.
                </li>
                <li>
                  <strong className="text-snow">Datos de contacto:</strong> Dirección de correo
                  electrónico principal, números de telefonía móvil y referencias geográficas
                  informativas.
                </li>
                <li>
                  <strong className="text-snow">Antecedentes de naturaleza técnica:</strong>{" "}
                  Dirección de Protocolo de Internet (IP), credenciales de autenticación, datos de
                  navegación en el Portal, tipo y versión del explorador web, huso horario local,
                  sistema operativo del terminal y tecnologías empleadas para acceder a la
                  plataforma.
                </li>
                <li>
                  <strong className="text-snow">Información del perfil:</strong> Nombre de
                  registro de la cuenta, claves de seguridad encriptadas, intereses deportivos
                  declarados, configuraciones de personalización, comentarios y aportes en
                  formularios internos.
                </li>
                <li>
                  <strong className="text-snow">Estadísticas de uso:</strong> Datos relativos al
                  comportamiento de navegación del Usuario dentro del Sitio, tiempo de
                  visualización y patrones de interacción con las herramientas de la interfaz.
                </li>
              </ul>
              <p>
                La Organización declara expresamente que no recopila de forma directa categorías
                de datos sensibles (tales como militancia política, convicciones morales,
                adscripción religiosa, origen étnico, orientación sexual, raza, estado de salud
                íntima o antecedentes penales) de sus Usuarios.
              </p>
            </>
          ),
        },
        {
          heading: "Tratamiento específico del derecho a la propia imagen",
          body: (
            <>
              <p>
                La Organización opera capturando imágenes de audio video de partidos en
                establecimientos deportivos clientes de LacarSports, imágenes que luego son
                transmitidas y reproducidas mediante streaming. Los establecimientos deportivos
                entregan aviso explícito de la existencia de cámaras y de la filmación de los
                videos con fines deportivos, de forma tal que los Usuarios otorgan su
                consentimiento de acuerdo a las leyes chilenas N° 19.628 y N° 21.719. En el
                momento que el Usuario se suscribe al Portal se configura el marco lícito para la
                captura audiovisual.
              </p>
              <p>
                <strong className="text-snow">El &ldquo;Botón de Oposición Deportiva&rdquo;:</strong>{" "}
                Si por cualquier causa personal un participante o tercero no desea figurar en las
                retransmisiones del Sitio, podrá exigir de forma directa la remoción preventiva
                del partido enviando un correo a{" "}
                <a href="mailto:bajas@lacarsports.cl" className={mail}>
                  bajas@lacarsports.cl
                </a>
                , adjuntando la referencia temporal del encuentro. La Organización se obliga a
                ocultar, pixelar o eliminar el registro audiovisual en un plazo técnico
                improrrogable que no excederá las veinticuatro (24) horas hábiles desde la
                notificación del reclamo.
              </p>
            </>
          ),
        },
        {
          heading: "Fundamentos legales para el procesamiento de datos personales",
          body: (
            <>
              <p>
                La Organización solo ejecutará el tratamiento de los datos personales bajo los
                supuestos de licitud autorizados por el ordenamiento chileno, limitándose a los
                siguientes escenarios:
              </p>
              <ul className={ul}>
                <li>
                  Cuando medie un consentimiento inequívoco, expreso e informado por parte del
                  Usuario al suscribirse a la plataforma.
                </li>
                <li>
                  Cuando sea indispensable para la ejecución de las obligaciones contractuales
                  derivadas de los{" "}
                  <a href="/terminos" className={mail}>
                    Términos y Condiciones
                  </a>{" "}
                  aceptados por el Usuario.
                </li>
                <li>
                  Bajo la figura del Interés Legítimo comercial y recreativo de la Organización o
                  de los propios recintos deportivos adscritos, siempre que no lesione los
                  derechos o las expectativas de privacidad de los deportistas dentro del juego.
                </li>
                <li>
                  Para dar cumplimiento a mandatos judiciales u obligaciones legales exigidas por
                  las autoridades regulatorias de la República de Chile.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Captura automatizada de antecedentes técnicos (cookies)",
          body: (
            <>
              <p>
                Al navegar por el Portal, el software recopila de manera automatizada métricas
                técnicas referentes a los patrones de exploración del equipo del Usuario. Esta
                transferencia informativa se realiza mediante el uso de registros de servidor y
                herramientas conocidas como &ldquo;Cookies&rdquo;.
              </p>
              <p>
                Las Cookies son pequeños archivos de datos que se almacenan en el navegador del
                terminal del Usuario. La Organización utiliza este recurso técnico con la
                exclusiva finalidad de optimizar la velocidad del Portal, adaptar la interfaz y
                evaluar estadísticamente el uso del Sitio de forma anónima, sin asociar estos
                archivos con identidades individuales.
              </p>
              <p>
                El Usuario mantiene la facultad de desactivar o eliminar las Cookies modificando
                los parámetros de seguridad en el menú de configuración de su navegador web. No
                obstante, bloquear estos elementos puede condicionar la disponibilidad de ciertas
                funciones dinámicas del Portal.
              </p>
            </>
          ),
        },
        {
          heading: "Acceso y comunicación de datos personales a terceros",
          body: (
            <>
              <p>
                Para el correcto despliegue técnico del Portal, la Organización trabaja con
                proveedores externos de infraestructura informática (servicios de almacenamiento
                en la nube, soporte de redes, herramientas de edición audiovisual y analítica
                automatizada), quienes podrían acceder de forma estrictamente instrumental a los
                antecedentes almacenados. Dichos encargados operan de acuerdo con instrucciones
                restrictivas destinadas a asegurar el resguardo de la información de los Usuarios.
              </p>
              <p>
                Los datos personales del Usuario no serán comercializados ni transferidos a
                terceros con fines publicitarios ajenos. Solo serán revelados ante requerimientos
                expresos emanados de los Tribunales de Justicia, fiscalías o la Agencia de
                Protección de Datos Personales, en el marco de sus atribuciones legales.
              </p>
            </>
          ),
        },
        {
          heading: "Plazos de almacenamiento y retención temporal",
          body: (
            <>
              <p>
                La permanencia de los datos personales de los Usuarios en los servidores está
                estrictamente vinculada a los fines operativos del servicio deportivo, tales como:
              </p>
              <ul className={ul}>
                <li>
                  <strong className="text-snow">Registros de las Grabaciones de AudioVideo:</strong>{" "}
                  En observancia del principio de minimización de datos, los archivos de video de
                  los partidos completos grabados de manera automatizada en las canchas de los
                  complejos deportivos permanecerán disponibles en el Portal por un plazo máximo
                  de siete (7) días corridos contados desde su captura. Terminado este periodo, el
                  sistema ejecutará un borrado automatizado, definitivo e irreversible de la
                  totalidad del material audiovisual, incluyendo la grabación completa y cualquier
                  resumen o &ldquo;Highlight&rdquo; generado a partir de ella. Transcurrido el
                  plazo, ningún archivo de video de la fecha correspondiente permanecerá alojado en
                  los servidores de la Organización.
                </li>
                <li>
                  <strong className="text-snow">Información del Perfil de Usuario:</strong> Los
                  antecedentes de registro de la cuenta se mantendrán vigentes mientras el Usuario
                  no solicite su baja formal. No obstante, si una cuenta permanece inactiva (sin
                  inicios de sesión registrados) por un espacio continuo de doce (12) meses, se
                  procederá a su cancelación automática por desuso, eliminándose el historial
                  informativo de forma permanente.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Derechos de los usuarios, ejercicio de derechos ARCO y canal de oposición",
          body: (
            <>
              <p>
                De conformidad con las garantías reconocidas por la legislación nacional, el
                Usuario —o cualquier deportista captado incidentalmente en los registros
                audiovisuales— ostenta el derecho inalienable de{" "}
                <strong className="text-snow">
                  Acceso, Rectificación, Cancelación y Oposición (Derechos ARCO)
                </strong>{" "}
                sobre sus datos personales.
              </p>
              <p>
                Para ejercer cualquiera de estas prerrogativas, el titular del dato o su
                representante legal debidamente acreditado deberá dirigir una solicitud escrita a
                la casilla oficial de correo electrónico:{" "}
                <a href="mailto:privacidad@lacarsports.cl" className={mail}>
                  privacidad@lacarsports.cl
                </a>
                . Dicha comunicación deberá incorporar:
              </p>
              <ol className={ol}>
                <li>Nombre completo, RUT y antecedentes de contacto del peticionario.</li>
                <li>
                  Identificación clara y detallada del dato o registro audiovisual específico
                  objeto de la solicitud (indicando fecha, hora y complejo deportivo del partido,
                  de ser el caso).
                </li>
                <li>
                  Documentación que valide fehacientemente la identidad del titular o las
                  facultades de representación legal.
                </li>
              </ol>
              <p>
                La Organización analizará el requerimiento y remitirá una respuesta formal dentro
                de un plazo máximo de quince (15) días hábiles.
              </p>
            </>
          ),
        },
        {
          heading: "Política de seguridad y notificación de incidentes",
          body: (
            <>
              <p>
                La Organización implementa barreras técnicas y medidas administrativas
                proporcionales para mitigar riesgos de pérdida accidental, alteración, filtración
                o accesos no autorizados a las bases de datos que contengan los datos personales
                de los Usuarios. El acceso al panel administrativo está restringido exclusivamente
                a los colaboradores técnicos que requieran procesar la información por razones
                técnicas u operativas, quienes se encuentran sujetos a un estricto secreto
                profesional.
              </p>
              <p>
                En caso de detectarse un evento fortuito o ataque cibernético que afecte la
                integridad de los datos resguardados, la Organización activará sus protocolos de
                mitigación y procederá a informar a los Usuarios afectados y a la autoridad
                fiscalizadora en los plazos perentorios exigidos por la ley chilena.
              </p>
            </>
          ),
        },
        {
          heading: "Entidad responsable y actualizaciones",
          body: (
            <>
              <p>
                La entidad jurídica responsable del resguardo y gobernanza de los datos personales
                tratados bajo este Portal es la Organización operadora de LacarSports. Ante dudas
                metodológicas o consultas legales referentes a este documento, los Usuarios pueden
                comunicarse con la Organización a través del canal institucional:{" "}
                <a href="mailto:contacto@lacarsports.cl" className={mail}>
                  contacto@lacarsports.cl
                </a>
                .
              </p>
              <p>
                Esta Política de Privacidad podrá ser modificada de forma periódica con el fin de
                asimilar reformas legislativas o reestructuraciones tecnológicas en Chile. Todo
                cambio material será comunicado oportunamente mediante notificaciones dirigidas al
                panel de control de los usuarios o avisos destacados en el Sitio Web principal.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
