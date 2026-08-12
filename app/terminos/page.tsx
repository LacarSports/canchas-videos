import type { Metadata } from "next";
import LegalDoc from "../components/LegalDoc";

export const metadata: Metadata = {
  title: "Términos y Condiciones · Lacar Sports",
  description:
    "Términos y Condiciones de Uso de la plataforma audiovisual deportiva LacarSports, conforme a las Leyes N° 19.628 y N° 21.719 de la República de Chile.",
};

const ul = "list-disc pl-5 space-y-1.5 marker:text-crystal-400/60";
const mail = "text-crystal-400 hover:text-crystal-300 underline underline-offset-2";

export default function TerminosPage() {
  return (
    <LegalDoc
      title="Términos y Condiciones de Uso"
      updated="agosto de 2026"
      intro={
        <>
          El presente documento de Términos y Condiciones establece el marco regulatorio y
          contractual que rige la relación entre la empresa propietaria y operadora de la
          tecnología (en adelante, la &ldquo;Organización&rdquo;), el ecosistema digital, entorno
          web y aplicaciones móviles que sean de su propiedad o estén bajo su control directo (en
          adelante, el &ldquo;Portal&rdquo; o el &ldquo;Sitio&rdquo;), y que permitan crear el
          material audiovisual de registro deportivo procesado, transmitido, distribuido,
          reproducido y que es grabado a través de las cámaras e infraestructura de la
          Organización (en adelante, las &ldquo;Grabaciones&rdquo; o el &ldquo;Contenido&rdquo;) y
          los Usuarios finales de la plataforma (en adelante, el &ldquo;Usuario&rdquo;).
          <br />
          <br />
          La condición de Usuario se adquiere mediante el ingreso, navegación y/o creación de
          credenciales en el Portal. Ello implica la aceptación irrestricta, expresa y consciente
          de estos Términos y Condiciones y de todas las cláusulas vigentes al momento del acceso.
          Estas directrices mantendrán plena validez legal mientras persista la interacción con
          nuestros servicios, subsistiendo las responsabilidades por hechos acaecidos con
          anterioridad tras el cierre de la cuenta o el cese del uso del Sitio.
          <br />
          <br />
          El uso del Sitio web, la suscripción y el acceso a los servicios se rigen
          complementariamente por los estatutos específicos disponibles en la plataforma, entre
          los cuales se incluye de manera mandatoria la{" "}
          <a href="/privacidad" className={mail}>
            Política de Privacidad
          </a>
          .
        </>
      }
      sections={[
        {
          heading: "Requisitos de edad y protocolo para menores (Ley chilena N° 21.719)",
          body: (
            <>
              <p>
                1.1 Conforme a las directrices de orden público dispuestas en la legislación de la
                República de Chile sobre resguardo de datos en entornos digitales, la Plataforma
                aplica un criterio diferenciado y restrictivo según la edad de los participantes.
              </p>
              <p>
                1.2 El Usuario declara y garantiza que posee plena capacidad legal para obligarse
                por sí mismo bajo estos Términos y Condiciones, teniendo al menos dieciocho (18)
                años de edad. En caso de ser un menor de edad que tenga entre catorce (14) y
                diecisiete (17) años, declara que cuenta con la debida asistencia o autorización de
                sus padres, tutores o representantes legales.
              </p>
              <p>
                1.3 Se prohíbe de forma absoluta la suscripción individual de personas menores de
                catorce (14) años. En el evento de actividades deportivas infantiles organizadas
                (ligas de menores, academias o escuelas formativas), la captura y almacenamiento de
                imágenes requerirá obligatoriamente el consentimiento expreso, por escrito y previo
                de sus padres o representantes legales, cuya recaudación y custodia será
                responsabilidad exclusiva del recinto deportivo organizador.
              </p>
            </>
          ),
        },
        {
          heading: "Perfil de usuario, resguardo de acceso y bajas",
          body: (
            <>
              <p>
                2.1 El acceso a las transmisiones vía streaming y la consulta de las Grabaciones
                requiere la creación de un perfil digital individual protegido mediante un
                identificador (ID) y una clave alfanumérica secreta elegida por el Usuario en el
                Sitio Web www.lacarsports.cl
              </p>
              <p>
                2.2 El uso del perfil tiene carácter estrictamente confidencial. El Usuario asume
                la posición de guardián de sus datos de acceso, siendo responsable directo por
                cualquier actividad, consulta o descarga efectuada en la Plataforma bajo sus
                credenciales. La Organización queda liberada de toda responsabilidad civil ante
                intromisiones derivadas del descuido o pérdida de las claves por parte del Usuario.
              </p>
              <p>
                2.3 La Organización se reserva la facultad de cancelar, suspender o bloquear de
                manera inmediata cualquier perfil de usuario si detecta conductas que amenacen la
                integridad del sistema, sin que ello genere derecho a indemnización alguna.
              </p>
            </>
          ),
        },
        {
          heading:
            "Protección de datos personales y derechos de imagen (Ley N° 21.719 y Ley N° 19.628)",
          body: (
            <>
              <p>
                3.1 En virtud de la legislación chilena, la imagen y la voz de las personas
                naturales constituyen datos personales. El tratamiento automatizado de las
                filmaciones dentro de los complejos deportivos asociados se fundamenta
                principalmente en:
              </p>
              <ul className={ul}>
                <li>
                  <strong className="text-snow">El Interés Legítimo comercial y recreativo:</strong>{" "}
                  Destinado a proveer un servicio de entretención y análisis deportivo en recintos
                  deportivos comerciales debidamente señalizados, donde el Usuario tiene la
                  expectativa razonable de ser filmado en el marco del juego.
                </li>
                <li>
                  <strong className="text-snow">El Consentimiento Expreso:</strong> Otorgado
                  formalmente por el Usuario al momento de registrarse en la Plataforma para
                  buscar, reproducir o interactuar con el Contenido.
                </li>
              </ul>
              <p>
                3.2 <strong className="text-snow">Mecanismo de Exclusión Inmediata (Derechos ARCO):</strong>{" "}
                La Plataforma garantiza el derecho permanente de Acceso, Rectificación, Cancelación
                y Oposición. Cualquier Usuario o tercero que no desee que su imagen permanezca
                alojada en el Portal podrá solicitar la baja inmediata remitiendo un correo
                electrónico a los canales de soporte. La Organización se compromete a remover,
                pixelar o bloquear de forma definitiva el archivo visual en un plazo máximo e
                improrrogable de veinticuatro (24) horas hábiles desde la recepción de la
                solicitud.
              </p>
              <p>
                3.3 <strong className="text-snow">Prohibición de Datos Sensibles:</strong> Está
                estrictamente prohibido cargar, comentar o asociar datos sensibles al perfil
                (ideologías, religión, aspectos de salud física o mental ajenos al deporte). Las
                imágenes se procesan de forma automatizada y con fines exclusivamente recreativos.
              </p>
            </>
          ),
        },
        {
          heading: "Reglas específicas de conducta y prohibiciones operativas",
          body: (
            <>
              <p>
                4.1 El Usuario se compromete a utilizar la Plataforma bajo criterios de buena fe y
                respeto. Queda prohibido de forma categórica:
              </p>
              <ul className={ul}>
                <li>
                  (a) Suplantar identidades, utilizar perfiles ajenos o aportar datos falsos en el
                  proceso de registro.
                </li>
                <li>
                  (b) Emplear el Portal para fines comerciales externos, retransmisiones no
                  autorizadas o lucro personal fuera de la visualización privada.
                </li>
                <li>
                  (c) Desactivar, vulnerar, testear o sortear los esquemas de seguridad
                  informática, cortafuegos o restricciones tecnológicas del código fuente de la
                  Plataforma.
                </li>
                <li>
                  (d) Alterar, borrar o superponer los avisos de copyright, logos o marcas de agua
                  insertas en las Grabaciones.
                </li>
                <li>
                  (e) Ejecutar técnicas de extracción automatizada de datos (tales como scraping,
                  crawling o minería de datos) sobre los servidores de la Organización.
                </li>
                <li>
                  (f) Propagar, inyectar o distribuir códigos maliciosos, virus, troyanos o gusanos
                  informáticos destinados a alterar el normal funcionamiento del servicio.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Régimen de almacenamiento temporal y caducidad de datos",
          body: (
            <>
              <p>
                5.1 En observancia estricta del principio de minimización de datos, las Grabaciones
                completas de los eventos deportivos tendrán una vigencia limitada en el Portal de
                siete (07) días corridos contados desde su captura.
              </p>
              <p>
                5.2 Terminado este periodo, el software ejecutará un proceso de depuración
                automatizada y destrucción irreversible de la totalidad del material audiovisual
                asociado al partido, incluyendo tanto la grabación completa como cualquier clip
                corto o resumen (Highlight) generado a partir de ella. Ningún archivo permanecerá
                disponible en el Portal una vez transcurrido el plazo de siete (7) días. Si el
                Usuario desea conservar algún fragmento, deberá descargarlo en su dispositivo
                personal antes del vencimiento de dicho plazo, asumiendo íntegramente la
                responsabilidad conforme al Artículo 6 de estos Términos. Asimismo, aquellas
                cuentas de usuario que no registren inicios de sesión por un plazo continuo de doce
                (12) meses serán dadas de baja por inactividad, eliminándose de forma definitiva
                sus datos históricos asociados.
              </p>
            </>
          ),
        },
        {
          heading: "Exportación de resúmenes (highlights) y ruptura de custodia",
          body: (
            <>
              <p>
                6.1 El Portal provee herramientas técnicas para que el Usuario pueda segmentar
                clips de video de corta duración (jugadas destacadas o goles) para su descarga y
                archivo privado en el dispositivo personal del Usuario.
              </p>
              <p>
                6.2 <strong className="text-snow">Limitación de Uso Comercial:</strong> Queda
                prohibido vender, licenciar o lucrar con el material descargado. El Usuario solo
                podrá conservar el fragmento para fines personales y domésticos.
              </p>
              <p>
                6.3 <strong className="text-snow">Estatuto de Responsabilidad por Difusión:</strong>{" "}
                La transmisión del partido completo se realiza de manera segura y cerrada por
                streaming dentro del Portal. Si el Usuario decide exportar, descargar un clip de
                video o difundir enlaces en redes sociales o plataformas externas (como Instagram,
                TikTok o WhatsApp), se produce jurídicamente una ruptura de la cadena de custodia.
                A partir de ese hito, el Usuario asume la calidad jurídica de Responsable
                Independiente del Tratamiento de esas imágenes de terceros.
              </p>
              <p>
                6.4 El Usuario declara expresamente bajo su responsabilidad que cuenta con la
                anuencia y el respeto del fair-play y la convivencia deportiva respecto a los demás
                integrantes del partido (compañeros y rivales). Queda estrictamente prohibido
                difundir clips de video con propósitos de acoso, burla, difamación o cualquier uso
                malicioso. El Usuario mantendrá completamente indemne a la Organización frente a
                cualquier acción legal, demanda o sanción de terceros o de la Agencia de Protección
                de Datos Personales derivada del mal uso o difusión no consentida de los archivos
                descargados.
              </p>
            </>
          ),
        },
        {
          heading: "Modelo operativo y ausencia de transacciones digitales",
          body: (
            <>
              <p>
                7.1 El Usuario toma conocimiento de que la Plataforma actúa bajo un modelo de
                habilitación institucional, por lo que no procesa, recauda ni ejecuta transacciones
                económicas ni pasarelas de pago de cara al consumidor final en su entorno web.
              </p>
              <p>
                7.2 Cualquier cobro, arriendo o habilitación del servicio se gestiona e implementa
                de manera externa y directa con la administración del complejo deportivo
                correspondiente, rigiéndose por los reglamentos comerciales propios de dicho
                recinto.
              </p>
            </>
          ),
        },
        {
          heading: "Sitios de terceros e hiperenlaces limitados",
          body: (
            <>
              <p>
                8.1 Debido a que la Plataforma no integra pasarelas de pago ni herramientas
                transaccionales, los hipervínculos externos en el Portal se limitan de manera
                estricta a redireccionamientos informativos institucionales o redes sociales
                oficiales de la Organización.
              </p>
              <p>
                8.2 En caso de interactuar con dichos enlaces externos, el Usuario reconoce que
                estos se rigen por políticas ajenas a nuestra Organización, por lo que su
                navegación se realiza bajo su propio riesgo corporativo y personal.
              </p>
            </>
          ),
        },
        {
          heading: "Integridad y cláusula de salvaguarda",
          body: (
            <>
              <p>
                9.1 Estos Términos y Condiciones constituyen el pacto único y vinculante entre la
                Organización y el Usuario respecto al Portal, anulando cualquier comunicación
                verbal o escrita previa.
              </p>
              <p>
                9.2 Si cualquier acápite o porción de este texto es declarada inaplicable o nula
                por un tribunal chileno, dicha invalidez no contaminará al resto de las cláusulas,
                las cuales mantendrán pleno vigor. El artículo afectado será sustituido por un
                texto legalmente válido que refleje fielmente la intención económica y preventiva
                original.
              </p>
            </>
          ),
        },
        {
          heading: "Exclusión de garantías operativas",
          body: (
            <>
              <p>
                10.1 Los Servicios se suministran en condiciones &ldquo;tal como están&rdquo; y
                según su disponibilidad técnica. La Organización realiza sus mejores esfuerzos por
                mantener la continuidad operativa, pero no garantiza la ausencia total de
                interrupciones, demoras en el procesamiento de video por fallas en la conectividad
                de Internet, fallas eléctricas del complejo deportivo o pérdidas fortuitas de
                Contenido.
              </p>
              <p>
                10.2 La Organización queda exonerada de responder por pérdidas fortuitas de
                Grabaciones causadas por eventos de fuerza mayor o fallas en la conectividad
                Internet o del suministro eléctrico de los recintos deportivos.
              </p>
            </>
          ),
        },
        {
          heading: "Indemnidad corporativa",
          body: (
            <p>
              11.1 El Usuario se obliga a defender, indemnizar y eximir de toda responsabilidad
              legal a la Organización, sus directores y técnicos ante cualquier gasto, costo
              judicial, honorarios de abogados o indemnizaciones derivadas de reclamos interpuestos
              por otros jugadores, rivales o terceros, que tengan como causa directa la infracción
              de estos Términos y Condiciones o el mal uso de las Grabaciones por parte del
              Usuario.
            </p>
          ),
        },
        {
          heading: "Límites sancionatorios y responsabilidad civil",
          body: (
            <>
              <p>
                12.1 Con el máximo alcance autorizado por el ordenamiento civil chileno, la
                Organización no responderá bajo ninguna circunstancia por daños indirectos, lucro
                cesante, pérdidas de oportunidades comerciales o perjuicios morales derivados de la
                visualización o el uso de los clips de video.
              </p>
              <p>
                12.2 Cualquier compensación o responsabilidad total acumulada imputable a la
                Organización quedará topada de forma estricta a un monto máximo equivalente a una
                (1) Unidad de Fomento (UF) vigente a la fecha del hito generador, salvo en eventos
                donde se demuestre dolo directo o negligencia inexcusable calificada por un
                tribunal.
              </p>
            </>
          ),
        },
        {
          heading: "Canales de comunicación oficial",
          body: (
            <p>
              13.1 Para notificaciones legales, requerimientos institucionales o consultas
              administrativas, la Organización dispone de la casilla oficial:{" "}
              <a href="mailto:contacto@lacarsports.cl" className={mail}>
                contacto@lacarsports.cl
              </a>
              . Para solicitudes exclusivas de eliminación preventiva de contenido bajo derechos de
              imagen, el canal habilitado es:{" "}
              <a href="mailto:bajas@lacarsports.cl" className={mail}>
                bajas@lacarsports.cl
              </a>
              .
            </p>
          ),
        },
        {
          heading: "Revisión y enmiendas de los Términos y Condiciones",
          body: (
            <>
              <p>
                14.1 La Organización podrá ajustar, actualizar o reestructurar el texto de estos
                Términos y Condiciones cuando las actualizaciones tecnológicas o los cambios
                normativos en Chile lo exijan. Dichas enmiendas serán vinculantes desde el momento
                de su publicación en el Portal.
              </p>
              <p>
                14.2 Se informará a los usuarios registrados sobre las variaciones sustanciales
                mediante alertas en el panel de control o correos informativos. El uso de los
                servicios con posterioridad a las modificaciones implica la total conformidad con
                el nuevo texto.
              </p>
            </>
          ),
        },
        {
          heading: "Legislación nacional y foro de resolución",
          body: (
            <>
              <p>
                15.1 Este clausulado se rige e interpreta de forma exclusiva bajo las leyes
                vigentes de la República de Chile.
              </p>
              <p>
                15.2 Ante cualquier controversia que no sea solucionada mediante avenimiento
                directo entre las partes, estas fijan su domicilio contractual y se someten a la
                jurisdicción de los Tribunales Ordinarios de Justicia de la comuna de Santiago de
                Chile.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
