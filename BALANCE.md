# Estado del balance

Registro de las perillas del juego, sus valores actuales y por qué están donde
están. Sirve para volver atrás: cada cambio grande queda anotado con la
medición de antes y de después, así se puede recuperar un estado anterior aunque
el código ya no exista.

**Todas las cifras salen de bots simulando miles de partidas.** El banco vive
en `scripts/balance.ts`:

```
npx tsx scripts/balance.ts            estilos + invariantes
npx tsx scripts/balance.ts estilos    sólo el balance
CORRIDAS=5000 npx tsx scripts/balance.ts   más corridas, menos ruido
```

Los bots juegan sólo con lo que la pantalla muestra: si un defecto tapa el
aviso, el bot tampoco lo ve. Un bot que hace trampa da números que no sirven.

---

## Perillas actuales

| Perilla | Valor | Dónde | Qué toca |
|---|---|---|---|
| `DAÑO_ATAQUE` | **6** | `engine.ts` | Golpe a mano limpia |
| `DAÑO_CONTRA` | **5** | `engine.ts` | Lo que devuelve un bloqueo que salió |
| `EFECTIVIDAD_BLOQUEO` | **0.90** | `engine.ts` | Chance de que el bloqueo funcione |
| `PASA_BLOQUEANDO` | **0** | `engine.ts` | Un bloqueo que sale no deja pasar nada |
| `MULT_ENEMIGO` | **1.35** | `engine.ts` | Perilla global del daño enemigo |
| `POR_PROFESOR` | **0.40** | `engine.ts` | Daño extra del jugador por profesor vencido |
| `PRECISION_ATAQUE` | **0.92** | `engine.ts` | Puntería del golpe a mano limpia |
| `FALLA_POR_MIEDO` | **0.30** | `engine.ts` | Chance de que una acción no salga con miedo |
| `EV` (escala de vida) | **0.10** | `engine.ts` | Vida enemiga por ciclo |
| `ED` (escala de daño) | **0.04** | `engine.ts` | Daño enemigo por ciclo |
| `MAX_ARMAS` | **3** | `engine.ts` | Tope de la mochila |
| `VIDA_BASE` | **45** | `engine.ts` | Vida inicial |
| `CICLOS` | **5** | `engine.ts` | Duración de una run |
| `AULAS` por pasillo | **5** | `mundo.ts` | Aulas antes del profesor |
| `FORMAS_PUERTA` | 4 formas | `mundo.ts` | Qué puede haber detrás de cada puerta |
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

2000 corridas por estilo, con las puertas repartiendo peleas, bendiciones y
minijuegos.

| Estilo | Muertes | Ciclo |
|---|---|---|
| Calculador: decide turno a turno | **48,1%** | 3,6 |
| Guarda los items para el profesor | 51,9% | 3,4 |
| Pasivo: bloquea siempre que sirve | 54,3% | 3,4 |
| Media pasada del pasillo | 58,5% | 3,1 |
| Luchador: nunca bloquea | 61,1% | 2,8 |
| A lo bruto: el arma que más pegue | 61,8% | 2,7 |
| **Derecho al profesor** | **94,6%** | 1,9 |

Seis estilos entre 48% y 62%, y el que piensa turno a turno gana por 4 puntos
sobre el segundo. Saltearse el pasillo sigue siendo un error de 33 puntos.

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

### El bug de la torpeza, y por qué movió todo el balance

La torpeza le daba al enemigo un segundo turno **en el mismo turno en que te
la aplicaba**. Ese segundo movimiento era la intención siguiente del patrón —
una que nunca se había anunciado. Desde el lado del jugador: atacabas y
aparecía un estado de la nada.

Medido antes de tocar nada: **195 de 11.030 apariciones de estado (1,8%) no
eran la intención anunciada.**

El arreglo tiene dos partes:
1. La torpeza se cobra **desde el turno siguiente**, no desde el que te agarra.
2. Cuando tenés torpeza, la interfaz muestra **los dos avisos**, porque el
   enemigo va a actuar dos veces y todo lo que te pasa tiene que estar avisado.

Verificado: **0 estados sin anunciar** sobre 11.334 apariciones.

**Costo de balance:** el arreglo le sacó al enemigo un turno gratis por cada
aplicación de torpeza y las muertes cayeron de ~55% a ~30%. Sumado a tres
pasivos nuevos en el pool, hizo falta subir el daño enemigo un 25% global
(`MULT_ENEMIGO = 1.25`) para volver a la banda.

### Golpes imparables

Tomado de Darkest Dungeon, donde el daño por tiempo ignora la protección. Una
bandera en la intención: el bloqueo no la reduce ni deja devolver. Cinco golpes
la tienen, tres de ellos son el remate de un profesor.

Enriquece la lectura sin agregar sistemas: ya no leés sólo *"¿viene un
golpe?"* sino *"¿viene un golpe, y se puede bloquear?"*.

**Nota para medir:** los bots bloqueaban también contra golpes imparables, cosa
que un jugador no haría al leer "NO SE PUEDE BLOQUEAR" en pantalla. Con los
bots corregidos el estilo pasivo pasó de 17 a 8 puntos por debajo del luchador.

### Sin aviso: el defecto que quita información en vez de restar

Tomado del Runic Dome de Slay the Spire. Todos los defectos anteriores eran
numéricos —25% menos de daño, 35% más recibido— y ese castigo se siente como
una resta. Éste tapa el aviso del enemigo, que es la información sobre la que
está construido todo el combate.

**Medición del efecto por estilo**, con el defecto en el pool:

| Estilo | Sin él | Con él |
|---|---|---|
| Luchador, nunca lee el aviso | 53,6% | 51,1% |
| Calculador, su ventaja es leer | 51,6% | 58,6% |
| Pasivo, bloquea al ver el golpe | 56,5% | 61,5% |

Castiga exactamente a quien depende de leer y deja intacto a quien nunca leyó.
La banda se ensancha de 5 a 10 puntos, y eso es deseable: tomarlo debería
empujarte a cambiar de estilo, no sólo a jugar peor.

**Nota para medir:** los bots leen el patrón del enemigo desde los datos, no
desde la pantalla. Para que la medición fuera honesta hubo que hacerlos
consultar `veElAviso()` y apostar a ciegas cuando corresponde.

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

### Tres formas nuevas de item

Tomadas de NO-SKIN, elegidas porque agregan **formas** que no teníamos, no más
efectos del mismo tipo:

| Item | De dónde sale | Qué agrega |
|---|---|---|
| El café de la sala | *Nightshade* | Buff que dura toda la pelea y se acumula |
| Los anteojos | *Heart Glasses* | Escudo que come el próximo golpe |
| La lata del quiosco | *Liquor Bottle* | Te desangra pero te cura por lo que hacés |

Los anteojos existen sobre todo como respuesta a los golpes imparables: te
dejan atacar en el turno en que cubrirse no sirve de nada.

**Lo que encontró el test:** el cobro por turno de la lata nunca se había
conectado — el parche apuntaba a un texto que ya no estaba en el archivo. En
el juego se veía como un item que sólo curaba y nunca cobraba. También estaba
desconectada la red de seguridad de *Segundo aire*, por la misma razón. Nueve
chequeos sobre los tres items nuevos, verificando el número exacto y no sólo
que "pasa algo".

### Bloquear pasó a bloquear todo, y también los estados

Antes dejaba pasar el 40% y no servía contra los estados: sólo se podía
responder a un golpe. Ahora **un bloqueo que sale para el golpe entero y
también lo que te quiere dejar algo encima**.

Lo que impide que bloquear sea siempre la respuesta ya no es que deje pasar
algo, sino dos reglas más limpias: **hay golpes imparables** y **bloquear casi
no hace daño**. Un pasivo puro sobrevive pero no avanza.

**Costo medido:** con la devolución en 3 el pasivo quedaba 20 puntos por
debajo del luchador. Subirla a 5 —el techo que permite la regla de que nunca
supere al ataque, que hace 6— cerró la brecha a 4 puntos.

### Los consumibles no gastan turno

Tomado de NO-SKIN. Cambia de raíz qué decidís sobre un item: ya no es "¿vale
la pena perder un turno?" sino "¿lo quemo ahora o lo guardo?". Es la pregunta
que queríamos que existiera.

**Costo medido:** buffeó fuerte a los estilos agresivos, que ahora se curan sin
perder tempo. Los estilos de ataque cayeron a 42% de muertes y hubo que subir
el daño enemigo de ×1.25 a ×1.40.

### El bug de la duración cero

Cuando se hizo que los estados duraran la mitad contra profesores, la duración
quedó en **1 turno** — y el descuento ocurre al final del mismo turno en que se
aplica. El estado nacía y moría sin llegar a existir: se veía el cartel de "te
agarró confusión" y no aparecía ninguna etiqueta.

Medido: **1020 de 12.339 estados anunciados (8%) nunca quedaban marcados.**

Arreglado aplicándolos con un turno de más, así sobreviven al descuento del
turno en que caen. Ahora la duración declarada es la real.

Esto explicaba también el reporte de que "el miedo actúa aunque se haya
quitado": el motor nunca lo hacía —0 casos sobre 2000 partidas— pero ver el
aviso sin ver la marca hacía que cualquier fallo posterior pareciera miedo
invisible.

### Rareza de items

Tres niveles con peso de aparición 6 / 3 / 1:

- **Común:** el caramelo, la tiza, la botella
- **Raro:** el apunte, la venda, el alcohol, el café
- **Único:** los anteojos, la lata del quiosco

Los dos únicos son justamente los de forma nueva —el escudo y la sangría—, así
que encontrarlos cambia cómo jugás esa run.

### Las puertas dejaron de ser todas peleas

Antes toda puerta era un combate y el porcentaje que mostraba era sólo *contra
qué*. Ahora reparte entre tres cosas, con **porcentajes enteros que suman 100**
porque un "37% 33% 31%" que no cierra es una promesa que el jugador no puede
usar para decidir.

| Puerta | Peso | Pelea | No hay nadie | Minijuego |
|---|---|---|---|---|
| Normal | 5 | 70% | 20% | 10% |
| Peligrosa | 3 | 90% | — | 10% |
| Tranquila | 2 | 50% | 40% | 10% |
| Rara | 1 | 60% | 10% | 30% |

Ponderado, **el 70% de las aulas siguen siendo peleas**, que era el pedido: el
juego es pelear, y lo demás premia mirar los números antes de entrar.

**Costo medido.** Con un 30% de aulas sin combate se junta menos equipo, así
que el mismo `MULT_ENEMIGO = 1.40` dejaba a la mitad de los estilos arriba del
60%:

| `MULT_ENEMIGO` | Banda de los seis estilos |
|---|---|
| 1.30 | 45,1% – 57,8% |
| **1.35** | **48,0% – 61,1%** |
| 1.40 | 51,7% – 62,9% |

Quedó en **1.35**, que es el que deja más estilos dentro de 50-60 y mantiene la
media pasada compitiendo con la pasada completa.

### El bug que hacía mentir a todo el banco de pruebas

La primera medición con puertas repartidas dio muertes del 19% al 41% y ciclo
promedio 1,5. Parecía que el juego se había vuelto trivial.

No se había vuelto trivial: **el bot de estilos no sabía qué mandar en la fase
del minijuego**, salía del bucle, y esa partida entraba al promedio como si
hubiera terminado bien. **1581 de 5600 runs se cortaban en el ciclo 1** y
contaban como sobrevividas.

El parche que agregaba el minijuego al bot había entrado en el bot de
invariantes y no en el de estilos — la misma clase de error que ya había
desconectado en silencio la lata y el segundo aire.

**Lo que quedó, para que no vuelva a pasar.** Una partida sana termina en
`muerto` o en `fin`. Cualquier otra cosa se cuenta, se imprime con el motivo, y
devuelve código de salida 1. Los números de arriba ya no pueden mentir sin
avisar.

### La bendición no daba nada

El aula vacía armaba el botín para mostrarlo en pantalla y **nunca lo guardaba
en el bolsillo**: decía "no hay nadie, encontrás algo" y no encontrabas nada.

Se agregó la invariante *el botín que se muestra es el que se guarda* — mira el
bolsillo antes y después en vez de leer el código. Verificada rompiendo el
arreglo a propósito: **593 fallas** con el bug puesto, cero sin él.

Y el premio pasó a ponderarse por rareza como el botín de combate: repartía
uniforme, así que una bendición gratis soltaba únicos tan seguido como tizas.
La bendición además da **sólo comunes**, porque no cuesta nada.

### Los tres minijuegos

Cada uno prueba algo distinto para que caer en uno no se sienta siempre igual:

| Juego | Qué prueba | Paga |
|---|---|---|
| **El pizarrón** | Memoria: 4 símbolos que se muestran y se borran | 4/4 → 2 items · 3/4 → 1 · menos → 0 |
| **La apuesta** | Nervio: seguís o te vas con lo junto | Lo que juntaste, o nada si se cae |
| **El examen** | Atención: qué anuncia un enemigo que venciste | Acertar → 2 items |

La apuesta arranca en 1 juntado con 70% de suerte, y **cada paso que sale bien
baja la suerte 15 puntos** con piso en 25. Seguir siempre no conviene: el valor
esperado deja de subir cuando la suerte cae por debajo de `n / (n+1)`.

El examen sólo aparece con **3 sombras o más**, porque preguntar por algo que
todavía no viste no es una prueba de atención sino una moneda.

**34 comprobaciones de números exactos** cubren los tres juegos y el reparto de
las puertas. Exactos y no "algo cambió": ese es el único tipo de test que
agarró los parches que no se aplicaron.

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
- Peso de las peleas en `FORMAS_PUERTA` ↔ `MULT_ENEMIGO`. Menos peleas es menos
  equipo: si baja el porcentaje de combate, hay que bajar el daño enemigo.

**Antes de creerle a una medición:** que no haya runs cortadas. El banco las
imprime y devuelve error; si aparecen, los porcentajes de arriba no significan
nada.
