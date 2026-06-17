import type { Metadata } from "next";
import LegalDoc from "../components/LegalDoc";

export const metadata: Metadata = {
  title: "Términos y Condiciones · Lacar Sports",
  description:
    "Términos y Condiciones de Uso de la plataforma Lacar Sports SpA.",
};

const ul = "list-disc pl-5 space-y-1.5 marker:text-crystal-400/60";

export default function TerminosPage() {
  return (
    <LegalDoc
      title="Términos y Condiciones de Uso"
      updated="17 de junio de 2026"
      intro={
        <>
          Estos Términos y Condiciones (los &ldquo;Términos&rdquo;) regulan el acceso y uso de
          la plataforma <strong className="text-snow">Lacar Sports</strong>, operada por{" "}
          <strong className="text-snow">Lacar Sports SpA</strong>, sociedad constituida en
          Chile (&ldquo;Lacar Sports&rdquo;, &ldquo;nosotros&rdquo;). Al acceder o utilizar la
          plataforma, ya sea como jugador o como dueño de un complejo deportivo, aceptas estos
          Términos en su totalidad. Si no estás de acuerdo, debes abstenerte de usar la
          plataforma.
        </>
      }
      sections={[
        {
          heading: "Descripción del servicio",
          body: (
            <>
              <p>
                Lacar Sports es una plataforma que permite grabar automáticamente partidos
                disputados en complejos deportivos que cuentan con nuestras cámaras instaladas.
                Una vez grabados, los partidos quedan disponibles en línea para que los
                jugadores puedan buscarlos por complejo, cancha, fecha y hora, reproducirlos,
                marcar sus mejores jugadas y descargar clips.
              </p>
              <p>
                Adicionalmente, ofrecemos a los dueños de complejos un panel de administración
                con estadísticas de ocupación y actividad, configuración de cámaras y monitoreo
                del estado del servicio.
              </p>
              <p>
                Lacar Sports puede modificar, suspender o discontinuar funcionalidades del
                servicio en cualquier momento, procurando dar aviso razonable cuando ello
                afecte de forma relevante a los usuarios.
              </p>
            </>
          ),
        },
        {
          heading: "Registro y cuentas (dueños de complejos)",
          body: (
            <>
              <p>
                El acceso al panel de administración está reservado a los dueños o
                administradores de complejos con los que Lacar Sports mantiene una relación
                comercial. Las cuentas son creadas y habilitadas por Lacar Sports mediante
                correo electrónico y contraseña.
              </p>
              <ul className={ul}>
                <li>
                  Eres responsable de mantener la confidencialidad de tus credenciales y de toda
                  actividad realizada bajo tu cuenta.
                </li>
                <li>
                  Debes proporcionar información veraz y mantenerla actualizada.
                </li>
                <li>
                  Debes notificarnos de inmediato ante cualquier uso no autorizado de tu cuenta.
                </li>
              </ul>
              <p>
                Los jugadores no requieren registrarse para buscar y ver los partidos públicos
                de su complejo.
              </p>
            </>
          ),
        },
        {
          heading: "Uso aceptable de la plataforma",
          body: (
            <>
              <p>Al usar la plataforma, te comprometes a no:</p>
              <ul className={ul}>
                <li>Utilizarla con fines ilícitos o que infrinjan derechos de terceros.</li>
                <li>
                  Intentar acceder a partidos privados o a cuentas ajenas sin autorización.
                </li>
                <li>
                  Descargar, reproducir o distribuir contenido para acosar, difamar o vulnerar
                  la privacidad o dignidad de otras personas.
                </li>
                <li>
                  Interferir con el funcionamiento de la plataforma, vulnerar sus medidas de
                  seguridad o realizar ingeniería inversa.
                </li>
                <li>
                  Emplear medios automatizados para extraer contenido o datos de forma masiva
                  sin nuestro consentimiento.
                </li>
              </ul>
              <p>
                El incumplimiento de estas reglas puede derivar en la suspensión o terminación
                del acceso al servicio.
              </p>
            </>
          ),
        },
        {
          heading: "Propiedad intelectual",
          body: (
            <>
              <p>
                La plataforma, su software, diseño, interfaz, la marca &ldquo;Lacar
                Sports&rdquo;, logotipos y demás elementos distintivos son de propiedad de Lacar
                Sports SpA o de sus licenciantes, y están protegidos por la legislación chilena
                e internacional. No se concede ningún derecho sobre ellos salvo el uso permitido
                por estos Términos.
              </p>
              <p>
                Respecto de los videos de los partidos: Lacar Sports gestiona la grabación,
                almacenamiento y puesta a disposición del contenido. Se autoriza a los jugadores
                a descargar y compartir los clips de sus propias jugadas para uso personal y no
                comercial. Cualquier uso comercial del contenido requiere autorización previa y
                por escrito de Lacar Sports.
              </p>
            </>
          ),
        },
        {
          heading: "Grabación de partidos y consentimiento",
          body: (
            <>
              <p>
                Las cámaras instaladas en los complejos graban la actividad deportiva de las
                canchas durante los horarios habilitados. Al ingresar y jugar en una cancha con
                cámara de Lacar Sports, los jugadores reconocen que el partido puede ser grabado
                y puesto a disposición en la plataforma conforme a estos Términos y a nuestra{" "}
                <a href="/privacidad" className="text-crystal-400 hover:text-crystal-300 underline underline-offset-2">
                  Política de Privacidad
                </a>
                .
              </p>
              <p>
                El complejo deportivo es responsable de informar a sus usuarios, mediante
                señalética visible u otros medios, de la existencia de cámaras y de la grabación
                de los partidos. Si un jugador no desea aparecer en una grabación, puede
                solicitarlo al complejo o contactarnos para gestionar la restricción o
                eliminación del contenido cuando corresponda.
              </p>
            </>
          ),
        },
        {
          heading: "Privacidad de los videos (público vs. privado)",
          body: (
            <>
              <p>
                El dueño del complejo puede configurar, por bloque horario, si los videos son:
              </p>
              <ul className={ul}>
                <li>
                  <strong className="text-snow">Públicos:</strong> cualquier persona con el
                  enlace puede buscarlos y verlos en la plataforma.
                </li>
                <li>
                  <strong className="text-snow">Privados:</strong> el acceso al video requiere
                  una clave definida por el complejo.
                </li>
                <li>
                  <strong className="text-snow">Bloqueados:</strong> la cámara no graba ese
                  bloque, por lo que no se genera video.
                </li>
              </ul>
              <p>
                Lacar Sports pone a disposición estas herramientas, pero la decisión sobre la
                visibilidad de cada bloque corresponde al complejo.
              </p>
            </>
          ),
        },
        {
          heading: "Limitación de responsabilidad",
          body: (
            <>
              <p>
                La plataforma se ofrece &ldquo;tal cual&rdquo; y &ldquo;según
                disponibilidad&rdquo;. Lacar Sports no garantiza que el servicio sea
                ininterrumpido o esté libre de errores. La grabación depende de factores como el
                suministro eléctrico, la conexión a internet del complejo y el correcto
                funcionamiento del equipamiento; ante cortes o fallas, es posible que algunos
                partidos no se graben.
              </p>
              <p>
                En la máxima medida permitida por la ley chilena, Lacar Sports no será
                responsable por daños indirectos, incidentales o lucro cesante derivados del uso
                o imposibilidad de uso de la plataforma, ni por la pérdida de videos no
                grabados, eliminados conforme a los plazos de retención, o cuyo bloque haya sido
                bloqueado por el complejo.
              </p>
            </>
          ),
        },
        {
          heading: "Legislación aplicable y jurisdicción",
          body: (
            <p>
              Estos Términos se rigen por las leyes de la República de Chile. Cualquier
              controversia relativa a su interpretación o cumplimiento será sometida a los
              Tribunales Ordinarios de Justicia de la ciudad de Santiago, sin perjuicio de los
              derechos que la legislación de protección al consumidor reconozca a los usuarios.
            </p>
          ),
        },
        {
          heading: "Contacto",
          body: (
            <p>
              Ante cualquier duda sobre estos Términos, puedes escribirnos a{" "}
              <a
                href="mailto:soporte@soporte.lacarsports.cl"
                className="text-crystal-400 hover:text-crystal-300 underline underline-offset-2"
              >
                soporte@soporte.lacarsports.cl
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
