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
| `MULT_ENEMIGO` | **1.65** | `engine.ts` | Perilla global del daño enemigo |
| `POR_PROFESOR` | **0.40** | `engine.ts` | Daño extra del jugador por profesor vencido |
| `PRECISION_ATAQUE` | **0.90** | `engine.ts` | Puntería del golpe a mano limpia |
| `RESTA_MIEDO` | **0.20** | `engine.ts` | Puntería que te saca el miedo, restando |
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
| Guarda los items para el profesor | **51,2%** | 3,2 |
| Calculador: decide turno a turno | 53,3% | 3,1 |
| Pasivo: bloquea siempre que sirve | 58,7% | 3,0 |
| Media pasada del pasillo | 60,1% | 2,9 |
| A lo bruto: el arma que más pegue | 63,4% | 2,6 |
| Luchador: nunca bloquea | 64,3% | 2,6 |
| **Derecho al profesor** | **87,7%** | 1,9 |

Los cuatro estilos que piensan quedan en 51–60 y los dos que van a lo bruto en
63–64. Saltearse el pasillo sigue siendo un error de 24 puntos.

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

### Cuatro cosas que el combate resolvía sin mostrar

Reportado jugando: *"morí sin ver las acciones del enemigo ser ejecutadas,
simplemente hizo el cálculo y perdí"*. Buscando alrededor aparecieron cuatro
del mismo tipo — el motor hacía lo correcto y la pantalla no lo contaba, o lo
contaba distinto de como lo hacía.

**1. La muerte se comía el turno del enemigo.** El motor pasa a `muerto` en el
mismo despacho en que resuelve el turno, así que la interfaz desmontaba el aula
con toda la mano encolada. Hacías tu acción y lo siguiente que veías era la
pantalla del final: lo que el enemigo decidió, lo que ejecutó y cuánto te sacó
no llegaban a existir. Lo mismo pasaba al ganar y al huir.

Ahora el aula no se abandona hasta que la secuencia terminó. Se guarda el último
estado en combate y se lo sigue mostrando; como durante la secuencia los botones
ya estaban bloqueados, no se pierde ninguna interacción. Y morir tiene su propia
línea —*"Se te apaga todo"*— para que la secuencia termine en algo legible en
vez de cortarse.

Había además un hueco de un frame: la cola de eventos se arma en un efecto, o
sea después de pintar, así que en el render en que llega el log nuevo todavía
estaba vacía. Ese frame alcanzaba para irse de la pantalla.

**2. Un bloqueo que salía dejaba pasar 1 de daño.** `Math.max(1, daño × 0)` da
1, no 0. La pantalla decía "lo bloqueás" y la barra bajaba igual, mientras que
bloquear un estado no te tocaba nada. Ahora para el golpe entero de verdad.

**3. Los anteojos se gastaban en golpes que ya habías parado.** El escudo se
resolvía antes que el bloqueo, así que un bloqueo que salía bien igual te
consumía el único. Ahora el bloqueo va primero y los anteojos sólo se gastan si
queda daño por comer.

**4. Un enemigo muerto seguía moviéndose.** El contraataque del bloqueo puede
ser el golpe final, pero la torpeza le daba un segundo turno igual: lo matabas y
te comías un golpe suyo después. **133 casos sobre 1200 partidas.** La lata
hacía algo parecido: te cobraba su parte en el turno en que ganaste, y podía
matarte en una pelea que ya había terminado.

Las cuatro quedaron como invariantes, y las cuatro se verificaron rompiendo el
arreglo a propósito para confirmar que la prueba no era vacía.

### USAR es una sola regla, o no es ninguna

El diseño decía desde siempre que USAR no gasta el turno. En el código valía
sólo para los items: **la sombra —cuya única función es sacarte los estados de
encima— te cobraba el turno del enemigo**, o sea que limpiarte la confusión te
costaba un golpe. Los poderes, igual.

Los tres salen del mismo menú y se ven igual, así que la excepción no se aprende
como una regla sino como una trampa.

Aparte, el chequeo del miedo corría **antes** de mirar qué acción era, así que
un USAR que fallaba por miedo también regalaba el turno. Y peor: la pantalla ya
mostraba `precisión × miedo` como un solo número, pero el motor lo resolvía con
dos tiradas de consecuencias distintas —fallar por miedo no gastaba el item y
costaba el turno; fallar por precisión gastaba el item y no costaba el turno—.
Ahora el miedo entra dentro de la tirada propia de cada cosa: un número, un
resultado.

**Nota para medir:** los bots nunca usaban poderes de daño ni sombras. Con USAR
gratis, un jugador que mira la pantalla vacía el cargador antes de pegar —los
usos vuelven en la próxima pelea, guardarlos no compra nada—. Sin corregir eso
la medición habría dado un buff mucho más chico que el real.

### Lo que costaron los arreglos

| | Banda de los seis estilos | Derecho al profesor |
|---|---|---|
| Antes | 49,4% – 60,3% | 94,8% |
| Con los arreglos, `MULT 1.35` | 33,7% – 51,0% | 82,3% |
| Con devolución también contra estados | **20,0% – 52,5%** | 61,4% |
| **Final, `MULT 1.65`** | **52,1% – 61,4%** | 86,2% |

La fila del medio es la que se descartó. Hacer que bloquear devolviera daño
también contra los estados era más "consistente" en un sentido barato —una
tirada, un resultado— pero volvía a poner a cubrirse como la respuesta a todos
los turnos: 22% para el pasivo contra 51% del que nunca bloquea. La regla que
quedó se dice igual de rápido y no rompe nada: **te protege de todo, pero sólo
devolvés lo que te tiraron.**

El resto de los arreglos le devolvió al jugador unos 15 puntos, y el daño
enemigo subió de **1,35 a 1,65** para compensarlos:

| `MULT_ENEMIGO` | Banda | Derecho al profesor |
|---|---|---|
| 1.45 | 38,5% – 54,4% | 84,3% |
| 1.55 | 40,8% – 58,6% | 85,0% |
| **1.65** | **48,9% – 62,6%** | 88,3% |

### Los porcentajes van de a 10

Pedido jugando: *"que sean múltiplos de 10, salvo en el caso de una sala con 33%
para cada posibilidad, así se simplifica el riesgo a tomar"*.

Un riesgo en décimos se calcula de cabeza caminando el pasillo. La excepción es
*la incierta* —34/33/33— que se lee igual de rápido porque lo que dice no es un
número sino "acá puede pasar cualquiera": es la única puerta donde nada es más
probable que otra cosa.

Con la incierta en el reparto, las peleas ponderadas bajan de 70% a **68%**.

### El reloj, y las dos mentiras que encontró

La ruleta del combate obligó a que el motor dijera, por cada evento, **cuál fue
la tirada y de qué lado cayó**. Eso permitió una prueba que antes no se podía
escribir: agrupar miles de tiradas por el porcentaje que declaran y comparar con
lo que salió de verdad.

Encontró dos cosas que ya estaban rotas y que nadie podía ver:

**1. El botón de BLOQUEAR mostraba 90% aunque tuvieras miedo.** El miedo se
cobraba aparte, como un chequeo antes de la acción, así que tu chance real de
cubrirte era 63% y la pantalla decía 90.

**2. Y esa tirada del miedo sólo se anotaba cuando fallaba.** Cubrirse es la
única acción que no se resuelve al apretarla: el éxito no genera ningún evento,
sólo te deja cubierto. Así que el arco de 63% caía del lado bueno **el 4,9% de
las veces**.

El arreglo unifica: **una sola tirada, con el miedo adentro, resuelta cuando
llega el golpe**. Es el mismo número en el botón y en el reloj, y da la misma
probabilidad total que antes (0,7 × 0,9 = 0,63), así que el balance no se movió.

**Nota sobre el umbral de la prueba.** La primera versión pedía 400 muestras y
6% de margen, y el caso del bloqueo tenía 266 muestras: se escapaba por poco. El
margen ahora se calcula —cuatro errores estándar de una binomial, con un piso
para los grupos grandes— así que un grupo chico exige una desviación grande y
uno grande detecta desviaciones finas. `RULETA=1` imprime todos los arcos.

### Lo que no se veía, y lo que se veía mal

Reportado jugando: *"a veces la vida parece regenerarse en el enemigo cuando se
lo mata"* y *"los efectos parecen aplicarse en momentos incorrectos"*. Las dos
eran ciertas y las dos tenían la misma causa.

El motor resuelve el turno entero de un saque, así que cuando la secuencia
recién va por tu primera acción el estado ya tiene el final. Cada evento lleva
una foto de cómo quedaron las cosas justo después, y la interfaz dibuja esa foto
— pero sólo para las vidas, y sólo si el evento la traía.

**El enemigo revivía.** Las líneas de la victoria —"deja de estar", "guardás la
tiza"— no traían foto, así que la barra caía al combate congelado, que es el del
turno *anterior* al remate. Reproducido: la barra iba **0 → 4 → 4**.

**Y los estados se adelantaban.** La ficha de arriba leía el estado en vivo, así
que la etiqueta de CONFUSIÓN aparecía mientras la secuencia todavía mostraba tu
propio ataque, y se iba antes de que expirara. Los números de la pantalla se
desordenaban antes del evento que te confundía.

Ahora la foto incluye los estados, y todo evento del combate la lleva. Dos
invariantes lo sostienen: *cada evento del combate dice cómo quedó el enemigo* y
*el enemigo no revive*.

### Cubrirse tapaba medio turno

Con torpeza el enemigo se mueve dos veces. Cada movimiento consultaba el estado
de bloqueo por su cuenta y el primero lo apagaba, así que **el segundo entraba
siempre de lleno**. La pantalla muestra los dos avisos y un solo botón de
BLOQUEAR: no había forma de saberlo.

Medido con el arreglo puesto y sacado: **225 golpes de 1200 partidas** entraban
así. Ahora la tirada del bloqueo se hace una sola vez por turno y vale para todo
lo que el enemigo haga, que es lo que la regla decía desde el principio —una
tirada, un resultado—.

### El escudo se quemaba solo

`escudo` era un sí/no, así que usar unos anteojos teniendo otros puestos
consumía un item único sin que pasara nada y sin decir nada. Ahora es una cuenta
de golpes cubiertos.

### Todo de a 5

Pedido jugando: *"que los porcentajes dentro del combate también sean un poco
más simples de entender, lo ideal es que sean todos múltiplos de 5"*.

Eso obligó a dos cambios de fondo, los dos buenos por su cuenta:

**El miedo resta en vez de multiplicar.** Multiplicando, un 90% con miedo daba
63%. Ahora saca 20 puntos fijos y la regla se dice en una línea.

**Una acción, una tirada.** Atacar tiraba dos veces —una por el miedo, otra por
la puntería— y mostraba el producto. Ahora hay un solo número y una sola tirada,
y `conTirada` recibe la chance *ya calculada*: la misma variable contra la que se
tiró el dado, así que el reloj no puede declarar un arco y resolver con otro.

El resto fue redondear el contenido. El único con costo real es el desgaste de
las armas, que pasó de 0,03–0,04 a **0,05** por uso porque es el múltiplo de 5
más chico: eso solo subió las muertes unos 3 puntos.

| | Banda de los seis estilos |
|---|---|
| Antes de redondear | 48,4% – 61,9% |
| **Después** | **51,2% – 64,3%** |

Se aceptó sin tocar `MULT_ENEMIGO`: los cuatro estilos que piensan quedan en
51–60 y los dos que van a lo bruto en 63–64, que es la forma que se buscaba.

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
- Bloquear **no devuelve daño contra los estados**. Si vuelve a devolver,
  cubrirse pasa a ser la respuesta a todos los turnos y el pasivo se va a 22%.
- USAR no gasta el turno para **ninguna** de las tres cosas del menú. Una sola
  excepción y la regla deja de poder aprenderse.

**Antes de creerle a una medición:** que no haya runs cortadas. El banco las
imprime y devuelve error; si aparecen, los porcentajes de arriba no significan
nada.
