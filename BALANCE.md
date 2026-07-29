# Estado del balance

Registro de las perillas del juego, sus valores actuales y por qué están donde
están. Sirve para volver atrás: cada cambio grande queda anotado con la
medición de antes y de después, así se puede recuperar un estado anterior aunque
el código ya no exista.

**Todas las cifras salen de bots simulando miles de partidas.** Los scripts no
están versionados; se reconstruyen desde las descripciones de acá.

---

## Perillas actuales

| Perilla | Valor | Dónde | Qué toca |
|---|---|---|---|
| `DAÑO_ATAQUE` | **6** | `engine.ts` | Golpe a mano limpia |
| `DAÑO_CONTRA` | **3** | `engine.ts` | Lo que devuelve un bloqueo que salió |
| `EFECTIVIDAD_BLOQUEO` | **0.90** | `engine.ts` | Chance de que el bloqueo funcione |
| `PASA_BLOQUEANDO` | **0.40** | `engine.ts` | Del golpe que igual entra bloqueando |
| `POR_PROFESOR` | **0.40** | `engine.ts` | Daño extra del jugador por profesor vencido |
| `PRECISION_ATAQUE` | **0.92** | `engine.ts` | Puntería del golpe a mano limpia |
| `FALLA_POR_MIEDO` | **0.30** | `engine.ts` | Chance de que una acción no salga con miedo |
| `EV` (escala de vida) | **0.10** | `engine.ts` | Vida enemiga por ciclo |
| `ED` (escala de daño) | **0.04** | `engine.ts` | Daño enemigo por ciclo |
| `MAX_ARMAS` | **3** | `engine.ts` | Tope de la mochila |
| `VIDA_BASE` | **45** | `engine.ts` | Vida inicial |
| `CICLOS` | **5** | `engine.ts` | Duración de una run |
| `AULAS` por pasillo | **5** | `mundo.ts` | Aulas antes del profesor |
| `perdida` de la pelota | **0.05** | `content.ts` | Chance de perderla por rebote |

Varias son ajustables por entorno para simular sin editar código:
`NEXT_PUBLIC_PUNO`, `NEXT_PUBLIC_CONTRA`, `NEXT_PUBLIC_EV`, `NEXT_PUBLIC_ED`.

---

## Objetivo de balance

No se busca cuál estrategia es la correcta. Se busca que **varias formas
distintas de jugar caigan en una banda parecida**, y que las degeneradas
—repetir una sola acción, saltearse el contenido— queden claramente afuera.

**Banda sana: 50% a 60% de muertes** para estilos con criterio.

### Medición actual

**Estilos de combate** — cómo decidís turno a turno:

| Estilo | Muertes |
|---|---|
| Calculador: bloquea, salvo que pueda matarlo antes del golpe | 51,1% |
| Luchador: corre a terminar la pelea, nunca bloquea | 52,5% |
| Pasivo: bloquea siempre que ve venir un golpe | 57,7% |

**Estilos de pasillo** — cuánto explorás y cuándo gastás:

| Estilo | Muertes |
|---|---|
| Limpia todo a lo bruto | 55,2% |
| Limpia todo, cura apenas baja la vida | 55,4% |
| Limpia todo, guarda los items para el profesor | 57,2% |
| Limpia la mitad del pasillo | 60,8% |
| **Va derecho al profesor** | **91,9%** |

**Degeneradas:** repetir una sola acción muere el 100%.

Los dos ejes se cruzan: un luchador que limpia todo juega distinto de un
pasivo que va a media pasada, y los dos son viables.

---

## Historia

### Bloqueo: el error de hacerlo mejor que atacar

**El error.** Se llegó a `DAÑO_CONTRA = 23` con `DAÑO_ATAQUE = 6`. Bloquear
devolvía casi cuatro veces lo que un golpe, así que **no había ninguna razón
para atacar cuando veías venir un golpe**. La decisión se había vaciado: la
respuesta correcta era siempre la misma.

**La regla que quedó.** *Bloquear no puede devolver más que un ataque normal.*
Ahora devuelve **3**, la mitad del puño.

**Y bloquear ya no anula.** Pasa el **40%** del golpe igual, así que a veces
conviene comerse el impacto y correr a matarlo antes. Sin eso, bloquear era
gratis y volvía a no haber decisión.

**Medición del arreglo:** con contra 23, el pasivo ganaba por lejos. Ahora los
tres estilos de combate caen en 51-58% y el que decide turno a turno gana por
apenas 1 a 6 puntos — suficiente para premiar pensar, no tanto como para que
los otros no se puedan jugar.

### Bloqueo: de una tirada segura a una que puede fallar

**Antes.** `ESPERAR` reducía el golpe al 20% *siempre*, y el contraataque tenía
su propia tirada al 90% por 15 de daño. Dos tiradas separadas para una sola
acción: imposible de leer en pantalla.

**Preocupación.** Que bloquear fuera siempre la mejor opción y el combate se
volviera repetir un botón.

**Medición.** Bloquear y nada más muere el **99,6%** de las veces: en los turnos
en que el enemigo no ataca, bloquear no hace nada y nunca lo matás. La
preocupación no se sostenía, pero el bloqueo garantizado igual era poco
interesante.

**Ahora.** Una sola tirada al **90%** decide todo. Si sale, deja pasar el 40%
del golpe **y** devuelve 3. Si no sale, entra de lleno y no devolvés nada.

*Espejo*, el pasivo del sueño, cambia ese trato: sube la devolución a **20** y
baja el bloqueo a **80%**. Es la única forma de que devolver valga la pena, y
cuesta puntería.

### El puño débil, que es lo que sostiene el pasillo

**Problema encontrado.** Con `DAÑO_ATAQUE = 12`, ir derecho al profesor era
**más seguro** (50,9%) que limpiar las aulas (53,4%). O sea: lo óptimo era
saltearse la exploración entera.

**Causa.** No era que las aulas fueran peligrosas —18 peleas sumaban 2,5 puntos
de muerte— sino que el arma aportaba apenas el 15% del daño de una pelea. El
botín no cambiaba nada.

**Lo que no funcionó.** Subir la vida de los profesores ×1.6, ×1.9 y ×2.3.
Endurece todo sin mover cuál estrategia conviene: la brecha se mantuvo en cero.

**Lo que funcionó.** Bajar el puño de **12 a 6**. Sin arma, los turnos en que no
te cubrís no valen nada, así que el equipo pasa a importar. La relación se dio
vuelta: 58,8% limpiando contra 71,2% corriendo al fondo.

> **Este es el número más delicado del juego.** Si se toca `DAÑO_ATAQUE`, hay
> que volver a medir limpiar-contra-correr antes de darlo por bueno.

### Progresión de daño del jugador

**Problema.** Los enemigos escalan por ciclo pero el jugador no: sus números se
quedaban atrás y el ciclo 5 era imposible.

**Medición sin progresión:** todos los estilos mueren 85-91%.

**Ahora.** Cada profesor vencido suma **+40% de daño a todo** lo que hace el
jugador —puño, armas, items, contraataque—. Multiplicar todo por igual mantiene
las proporciones entre las opciones mientras la escala crece.

| Por profesor | Muertes (calculador) |
|---|---|
| +0% | 85,4% |
| +30% | 55,3% |
| **+40%** | **51,1%** |
| +50% | 46,7% |

### Escalado de los enemigos

**Problema.** Los enemigos eran fijos mientras el jugador se fortalecía, así que
el ciclo 5 era más fácil que el 1.

**Primer intento.** Escalar vida y daño juntos: mataba a todo el mundo el 100%.

**Ahora.** Separados, y el daño escala mucho más despacio que la vida
(`EV 0.10` / `ED 0.04`). Las peleas tardías son más largas y tensas en vez de
matarte de dos golpes.

### Modelo de recursos

**Se probó atomicidad total** —que nada se gastara entre combates— y se
descartó: sin una reserva escasa desaparece la estrategia larga de la run.

**Quedó en tres capas:**
- **Vida**: se restaura en cada aula, siempre. Es lo único atómico.
- **Armas y poderes**: los usos se recargan en cada pelea.
- **Items y sombras**: se consumen de verdad. Guardarlos o quemarlos es la
  decisión que sostiene la partida larga.

10 invariantes automáticas verifican esto sobre 1500 partidas.

### Precisión

Se agregó puntería a todo: armas, items, poderes y ataques enemigos. La regla
que lo mantiene justo es que **el número esté siempre a la vista**. Con miedo
encima los botones muestran el producto de las dos tiradas, no los factores.

**Orden importante:** la pérdida de la pelota se tira **sólo si el golpe entró**.
Errar no puede costarte el arma, porque no hubo rebote. Verificado sobre 61.177
golpes: cero pérdidas después de errar.

### Profesores con dos efectos

Antes ningún enemigo aplicaba más de un tipo de efecto, así que dos estados
simultáneos eran imposibles. Tres profesores ahora aplican dos tipos distintos.

**Costo medido:** subió las muertes de 44-49% a 50-57%. Se aceptó porque hace
que el equipo importe más y ensancha la brecha contra saltearse el pasillo.

---

## Cómo volver atrás

Cada bloque de arriba tiene los valores viejos. Para recuperar un estado:

1. Poné las perillas en los valores que dice la sección.
2. Corré la medición de estilos y comparalo contra la tabla de esa época.
3. Si no coinciden, algo más cambió en el medio — revisá el historial de git.

**Combinaciones que no hay que romper:**

- `DAÑO_ATAQUE` bajo ↔ el pasillo tiene sentido. Suben juntos o no suben.
- `EFECTIVIDAD_BLOQUEO` < 1 ↔ `DAÑO_CONTRA` alto. Si el bloqueo vuelve a ser
  seguro, la devolución tiene que bajar.
- `EV` > `ED`. Si el daño escala más rápido que la vida, el ciclo 5 mata de dos
  golpes y las peleas dejan de leerse.
