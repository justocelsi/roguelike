# VIGILIA

> Un roguelike donde el mundo se reescribe mientras dormís, vos elegís cómo, y sos el único que recuerda la versión anterior.

## Origen

Inspirado en la ciencia ficción de ideas: *Solaris* (Lem), *La rueda celeste* (Le Guin), *Soy leyenda* (Matheson), *Fundación* y *Yo, Robot* (Asimov). El hilo común de esos cinco libros no es el espacio ni la tecnología: es que **el problema del protagonista es epistemológico**. No es "cómo lo mato", es "qué está pasando realmente".

De ahí sale el hook: **el recurso escaso es la certeza, y el enemigo es tu propio modelo equivocado del mundo.**

Referencia de formato y tono: **NO-SKIN** (No-Eye Soft) — roguelike de terror minimalista, ubicaciones con probabilidades declaradas, por turnos, atmósfera por escritura y no por animación.

**Lo que nos diferencia de NO-SKIN:** ahí las reglas del juego son fijas. Acá el jugador va reescribiendo el reglamento y el mundo se acomoda hacia atrás. Al final de una run estás jugando a algo que no existía cuando empezaste. Esa es la idea original y hay que protegerla en cada decisión de diseño.

---

## El ciclo

1. **Despierto.** Se te presentan **tres o más salas**. Cada sala muestra sus *lecturas*: los **3 o 4 eventos posibles** que pueden ocurrir ahí, cada uno con su probabilidad declarada. Elegís una sala, se sortea el evento, y entrás.
2. **Adentro de la sala hay decisiones** (ver abajo). Cada acción consume Vigilia.
3. **A medida que la Vigilia baja, la interfaz se degrada.** Los porcentajes pasan de `40%` a `~40%` a `4?%` a `??`. El cansancio no te pega más fuerte: te hace *saber menos*.
4. **Dormís.** El sueño te ofrece **tres distorsiones**. Elegís una.
5. **Despertás en un mundo reescrito**, retroactivamente. Las salas que conocías ahora son otras. Los números que memorizaste ya no valen. El juego mantiene **tu anotación vieja tachada al lado de la nueva**: sos el único que recuerda.
6. Repetir. Morir → permadeath → mundo nuevo.

## La tensión central

Una sola decisión, todos los ciclos, y es con la que el jugador se va a pelear:

- **Dormís temprano** → *elegís* entre tres distorsiones, pero exploraste poco y estás mal equipado.
- **Aguantás hasta desplomarte** → exploraste todo el ciclo, pero **la distorsión la elige la pesadilla**, y las suyas son peores y más raras.

**La agencia sobre la distorsión es, en sí misma, el recurso.**

---

## Adentro de la sala

Tres verbos:

- **Observar** — gastás Vigilia y ganás información: revela el evento real, o una lectura oculta, o qué pasaría si usaras otro verbo.
- **Actuar** — el verbo propio del evento (tomar / forzar / hablar / desactivar). Resuelve la sala.
- **Retirarte** — salís con las manos vacías. Siempre disponible, siempre gratis.

### La regla que lo convierte en juego

**Cada acción adentro consume Vigilia. Y la Vigilia es al mismo tiempo tu vida, tu reloj y tu claridad.**

Todo el juego en una frase: **comprás certeza con vida.** Observar es seguro pero te empuja hacia la pesadilla. Actuar a ciegas es barato, pero podés estar aplicando el verbo equivocado a algo que no era lo que creías.

"La certeza es el recurso escaso" no es una idea del documento: es el sistema económico del juego.

### El evento madura

Si te quedás demasiado, **el evento cambia**. Lo que era una sala aprovechable se vuelve otra cosa. Observar tiene entonces dos costos: la Vigilia, y que aquello que mirás deje de ser lo que estabas mirando.

Eso da un reloj *adentro* de la sala, no sólo afuera. Y evita que "observar siempre" sea la estrategia dominante.

---

## Combate

Mínimo, por turnos, y **no es un sistema aparte: son los mismos tres verbos con el reloj acelerado.**

| Fuera de combate | En combate |
|---|---|
| Observar | Esperar / cubrirte |
| Actuar | Golpear |
| Retirarte | Huir |

- **No hay barra de vida enemiga.** Feedback cualitativo: *"se mueve más lento"*, *"algo cede"*. Nunca sabés cuánto le falta.
- **El daño se descuenta de Vigilia.** Un solo recurso en todo el juego. Que te peguen es perder claridad y reloj a la vez. Una pelea mala te come el ciclo y te empuja a dormir antes de lo que querías — devolviéndote a la tensión central. Todo cierra sobre el mismo bucle, sin economías paralelas.
- **La criatura tiene un patrón oculto** de 2 o 3 intenciones y **telegrafía** la próxima con una línea de texto (*tell*). Responder bien depende de leer el tell.
- Duración: **2 a 4 turnos**.
- No todo evento hostil abre combate. Algunos siguen siendo "el verbo equivocado te mata".

### Meta-progresión

**No se desbloquea nada entre runs. La meta-progresión es el conocimiento del jugador**: aprender qué significa cada tell, qué hace cada tipo de evento, qué esconde cada distorsión. Como Spelunky o Dark Souls.

Y encima es el tema del juego: la partida se gana sabiendo, y las distorsiones existen para arruinar lo que creías saber.

---

## Las distorsiones

Dos categorías. La intensidad determina si se acumula o si reemplaza.

### Chicas — acumulables

Ajustan parámetros. Son el tejido, no el evento.

- Observar cuesta 1 menos de Vigilia
- Una lectura de cada sala viene revelada de entrada
- Retirarte devuelve algo de Vigilia
- Los eventos maduran más lento

### Grandes — excluyentes, sólo una activa por vez

Cambian una **regla del motor**. Elegir una nueva significa **perder la anterior**.

| Distorsión | Efecto |
|---|---|
| **Los números mienten** | Las probabilidades declaradas tienen un error desconocido |
| **Silencio** | No ves los eventos posibles, sólo la sala |
| **Lucidez** | Ves el evento real antes de entrar, pero sólo podés hacer *una* acción adentro |
| **El eco** | Al entrar repetís automáticamente tu última acción del ciclo anterior |

Las cuatro grandes atacan **tu capacidad de saber**, no tus stats. Ahí viven Lem y Asimov.

**Nota sobre la regla de oro:** "cambia una regla, no un número" aplica **sólo a las grandes**. Las chicas son numéricas a propósito — es lo que evita que cada elección al dormir dé vuelta la mesa.

---

## Ambientación: sin lugar

> **Abierto:** la variante de **sala de control / estación de observación** sigue en juego. Puede convivir con lo abstracto: una consola concreta desde la cual observás un lugar que no lo es. Decidir.

No se aclara nunca dónde estás. Pero **el lugar no tiene nombre, tiene gramática**: las salas se generan por composición, no se escriben a mano.

```
[cualidad] + [forma] + [lectura]
→ "Una sala donde el aire pesa"
→ "Un pasillo que ya recorriste (¿lo recorriste?)"
→ "Algo con una puerta de más"
```

Ventajas:
- Contenido infinito sin escribir un guión.
- **Es mecánicamente necesario:** *Silencio* sólo funciona si los nombres eran arbitrarios desde el principio. En una casa concreta, la cocina no puede dejar de ser la cocina.

**El ancla emocional no es el lugar: son las notas del jugador.** El juego registra lo que fue descubriendo, y las distorsiones invalidan ese registro. Lo que se pierde cuando el mundo se reescribe no es un hogar: es el propio mapa mental.

## Estética

Minimalista. Monocromo o duotono, tipografía fuerte, texto corto y bien escrito, cero animación. La atmósfera sale del ritmo y de la escritura. Tailwind hace esto perfecto y no necesitamos ni un asset.

---

## Preguntas abiertas

1. ~~¿Hay combate?~~ → **Sí, mínimo por turnos, mismos verbos.**
2. ~~¿Cómo es la sala una vez que entrás?~~ → **Tres verbos, Vigilia como costo, el evento madura.**
3. ~~Las distorsiones bajo el principio acumulables/excluyentes~~ → **Resuelto. Falta ampliar el pool.**
4. **Ambientación**: abstracto puro, o sala de control observando algo abstracto.
5. **¿Las probabilidades declaradas son honestas?** Parcialmente respondido por *Los números mienten*, pero falta definir si son honestas por defecto o si hay algo más de fondo.
6. **Números concretos**: Vigilia inicial, costo de cada verbo, daño, cuántos ciclos dura una run. Se define jugando.

---

## Alcance

### MVP — mínimo jugable, sin backend

- [ ] Generación procedural de salas por composición
- [ ] 3+ salas por elección, cada una con 3-4 eventos y probabilidades declaradas
- [ ] Los tres verbos + Vigilia + maduración del evento
- [ ] Degradación progresiva de la interfaz según Vigilia
- [ ] Combate mínimo: 2 criaturas, tells, daño a Vigilia
- [ ] Dormir → elegir 1 de 3 → distorsiones (chicas + grandes)
- [ ] 3 ciclos, muerte, reinicio
- [ ] Deploy en Vercel

Sin cuentas, sin base de datos, sin guardado.

### Después del MVP

- Ampliar el pool de distorsiones (cada una nueva multiplica las combinaciones)
- Semilla diaria compartida, tipo Wordle, con resultado compartible
- Supabase: leaderboard y estadísticas de qué distorsiones elige la gente
- **Norte de diseño a largo plazo:** que la condición de victoria sea *recordar* — reconstruir correctamente cómo era el mundo antes de la primera distorsión. La memoria como win condition, no como decorado.

## Stack

TypeScript · Next.js 16 (App Router) · React 19 · Tailwind v4 · Vercel · Supabase (post-MVP)
