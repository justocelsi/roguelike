# VIGILIA

> Hace tres días que no dormís bien. El colegio es la pesadilla y el sueño es
> el único lugar que tiene sentido.

---

## La premisa

El protagonista es un estudiante con **insomnio**. No duerme hace días, así que
la vigilia y el sueño se le mezclaron: el colegio al que va todos los días ya no
es del todo real. Eso explica todo lo demás sin necesidad de explicarlo — por
qué las aulas son lo que son, por qué los profesores son lo que son, y por qué
el título del juego es lo que le pasa al personaje.

**La inversión:** el colegio es el lugar feo y el sueño es claro, ordenado y
casi hermoso. Lo que da miedo no es dormirse: es despertarse.

## Origen

- **Ciencia ficción de ideas** (Lem, Le Guin, Matheson, Asimov): lo que se
  corrompe no son tus stats sino lo que creías saber.
- **NO-SKIN**: minimalismo de terror, probabilidades declaradas, combate por
  turnos donde cada acción consume un turno.
- **Shadow Slave**: el poder no se gana, se compra, y el precio te lo bancás el
  resto de la run.

---

## El bucle

1. **Caminás el pasillo.** Movimiento libre en 2D, WASD o flechas.
2. **Las puertas se leen al acercarte**: la materia y los porcentajes de qué
   puede haber adentro.
3. **Entrás a un aula.** Casi siempre hay un combate por turnos; a veces no hay
   nadie, y a veces hay un minijuego. Ganás un arma o un item.
4. **Al fondo del pasillo está el profesor.** Siempre está abierto: podés ir
   derecho o limpiar aulas antes para juntar equipo. Esa es la decisión.
5. **Vencido el profesor, dormís.** En el sueño te ofrecen tres pares de
   **poder + defecto**, con el precio a la vista.
6. Despertás. El colegio se deformó un escalón más.
7. **5 ciclos.** La muerte es permanente.

---

## Los tres recursos

Lo único que se restaura solo es **la vida**: entrás entero a cada aula, así
que ninguna pelea se pierde por lo que pasó en la anterior. Lo demás se
reparte en tres capas que se sienten distintas a propósito:

| | Qué es | Cuándo se recarga |
|---|---|---|
| **Vida** | tu condición | en cada aula, siempre |
| **Armas y poderes** | tu kit fijo | los usos, en cada pelea |
| **Items y sombras** | tu reserva escasa | nunca: se gastan de verdad |

El kit es lo que sabés que vas a tener; la reserva es lo que decidís si quemás
ahora o guardás para el profesor. Esa segunda decisión —y no otra— es la que
sostiene la estrategia larga de la run.

Verificado con 32 invariantes automáticas y 47 comprobaciones de números
exactos. El banco de pruebas vive en `scripts/balance.ts`.

## Nada aparece de un frame al otro

Es la regla que ordena todo lo visual. Si algo entró despacio y sale en un
frame, el corte se siente aunque lo que quede atrás sea correcto — y se siente
más fuerte justamente después de un rato de todo gradual, que es donde el ojo ya
se acostumbró a que las cosas tomen su tiempo.

Así que todo lo que tapa la pantalla se apaga con un fundido antes de irse: el
umbral, el texto de la entrada, el estado que te agarra. Y toda pantalla nueva
entra con uno corto, porque ganar una pelea te lleva a la recompensa en el mismo
despacho y ese salto era lo único seco que quedaba en el turno.

## El umbral

Abrir una puerta no muestra el aula de golpe. La pantalla arranca negra, la luz
sube sola, y recién después lo que hay adentro toma forma.

**El suspenso no está en lo que hay adentro, sino en el rato en que todavía no
sabés qué hay.** Por eso las tres clases de aula comparten la misma caja, el
mismo ritmo y la misma luz hasta el momento de revelar: si el aula vacía se
viera distinta desde el primer frame, no habría suspenso, habría un cartel.

El aula vacía tiene un beat de más. Primero ves que no hay nadie —que es el
momento en que aflojás— y recién ahí aparece lo que había.

La puerta del profesor es la única que se tiñe distinto, porque es la única que
se lee desde el pasillo: ya sabías lo que ibas a cruzar.

Se puede adelantar tocando o con cualquier tecla. En la run número diez el
suspenso ya lo viste, y hacerlo obligatorio lo convertiría en un peaje.

## Qué hay detrás de una puerta

Lo único incierto es lo que pasa **antes** de entrar. Adentro no se esconde
nada: los porcentajes están escritos en la puerta, son **enteros y suman 100**,
y son exactamente los números contra los que se sortea. Un "37% 33% 31%" que no
cierra no le sirve a nadie para decidir.

Las puertas vienen en **cuatro formas reconocibles**, la misma idea que las
salas icónicas: en la run número diez tenés que poder mirar una puerta y saber
qué clase de puerta es sin leer los números uno por uno.

| Puerta | Pelea | No hay nadie | Minijuego |
|---|---|---|---|
| Normal | 70% | 20% | 10% |
| Peligrosa | 90% | — | 10% |
| Tranquila | 50% | 40% | 10% |
| Rara | 60% | 10% | 30% |
| Incierta | 34% | 33% | 33% |

**Todos los porcentajes son múltiplos de 10.** No es cosmético: un riesgo que se
piensa en décimos se calcula de cabeza mientras caminás, y uno que dice 37%
obliga a leer el número entero para no entender nada mejor. La única excepción
es *la incierta*, que reparte parejo — y que se lee igual de rápido, porque lo
que dice es "acá puede pasar cualquiera".

Ponderado por lo seguido que aparece cada una, **el 68% de las aulas son
peleas**. El juego es pelear; lo demás está para que mirar los números antes de
entrar sea una decisión y no un trámite.

- **No hay nadie.** Un item común, sin riesgo. Sale gratis, así que da lo básico.
- **Minijuego.** Tres, y cada uno prueba algo distinto para que caer en uno no
  se sienta siempre igual:

| Juego | Qué te pide | Paga |
|---|---|---|
| **El pizarrón** | Acordarte de cuatro símbolos que se borraron | 4/4 → 2 items · 3/4 → 1 |
| **La apuesta** | Saber cuándo irte: cada paso que sale bien vuelve el próximo más difícil | Lo que juntaste, o nada |
| **El examen** | Qué anuncia un enemigo que ya venciste | Acertar → 2 items |

El examen sólo aparece cuando ya venciste al menos tres cosas: preguntarte por
algo que no viste no es atención, es una moneda. Y es el único lugar donde
prestarle atención a los avisos del combate te paga fuera del combate.

### Salas icónicas

Cada materia da **siempre lo suyo**. No es una limitación: es lo que hace que en
la run número diez sepas que Biología cura y Química lastima, y elijas el
pasillo con esa información. La primera partida es a ciegas; de ahí en más lo
que sabés es una herramienta.

| Materia | Armas | Items |
|---|---|---|
| Matemática | la regla, el compás | la tiza, el café, **el borrador** |
| Literatura | el diccionario | el apunte, **los anteojos de alguien** |
| Historia | el puntero | el caramelo, **la regla de otro** |
| Biología | el bisturí | la venda, la botella |
| Química | el mechero, el ácido | el alcohol, la tiza |
| Ed. Física | la pelota | la botella, el caramelo, **la lata del quiosco** |

Los items no son todos del mismo tipo. Además de los instantáneos hay tres
formas distintas, tomadas de NO-SKIN:

- **El café** suma daño **por el resto de la pelea** y se acumula. Se decide
  temprano, que es cuando menos sabés contra qué estás.
- **Los anteojos** absorben el próximo golpe entero. Es la respuesta a un
  golpe imparable: te dejan atacar en el turno en que cubrirse no sirve.
  Mientras estén puestos hay una marca arriba —**CUBIERTO**— porque un escudo
  que espera sin decirlo es un escudo que te olvidás que tenés; y cuando frenan
  un golpe se ganan la pantalla entera y se rompen píxel por píxel, con la misma
  animación con la que se caen los enemigos. Un único que se gasta tiene que
  verse gastar.
- **La lata** te cobra 4 por turno pero te devuelve la mitad de lo que hacés.
  Riesgo puro; premia al que corre a terminar la pelea.
- **El borrador** le borra el próximo movimiento: se queda con la mano en el
  aire. No cura ni pega — te compra un turno.
- **La regla de otro** hace que tu próximo golpe no pueda fallar. Es la única
  forma de tirar el arma más cara sin pagar su puntería, y el reloj muestra
  100%.

**El apunte saca un estado, no todos.** Era el item raro más común del juego
—17,9% de todo lo que aparecía, el único que salía en dos materias— y salir de
los tres estados a la vez no puede costar lo mismo que salir de uno. Quitarlos
todos quedó como lo que hace *Lucidez*, que es un poder del sueño: los poderes
tienen que poder más que los items.

### Armas

Hasta **3 a la vez**. Cada una con sus usos por pelea, su precisión, su
desgaste dentro del combate y su chance de crítico. Hay armas **infinitas**
—la pelota, el puntero— que pegan menos pero están siempre: son el piso de tu
daño. Las de usos contados son picos que hay que elegir cuándo gastar.

Con la mochila llena, encontrar una cuarta obliga a soltar una. No se sale del
aula sin decidir.

**La pelota** es infinita pero no eterna: cada golpe que *entra* tiene un 5% de
que rebote mal y la pierdas para siempre. Si el golpe erró no se tira esa
chance — no hubo rebote que perder. Esa regla de orden es lo que hace que la
pérdida se sienta justa en vez de arbitraria.

## Combate

Cinco acciones y **ninguna estadística detrás**. La decisión no es "cuál pega
más" sino "qué corresponde ahora".

| Acción | Qué hace |
|---|---|
| **ATACAR** | 6 de daño. A mano limpia no le hacés gran cosa a esto |
| **BLOQUEAR** | 90% de que salga. Si sale, **no te toca nada** — ni el golpe ni el estado |
| **ARMA** | Daño alto y usos contados **por pelea**. Es lo que hacés en los turnos en que no te cubrís |
| **USAR** | Item, sombra o poder. **Ninguno de los tres gasta el turno** |
| **HUIR** | Salís al pasillo. Contra un profesor la puerta no abre |

**Bloquear te protege de todo, pero sólo devolvés lo que te tiraron.** Contra un
golpe le devolvés 5; contra algo que te quería dejar un estado encima, no hay
golpe que redirigir y no devolvés nada. Es una regla que se dice en una línea, y
es lo que impide que cubrirse sea la respuesta a todos los turnos: medido con
devolución también contra los estados, el estilo pasivo se iba a 22% de muertes
contra 51% del que nunca bloquea.

El puño es débil a propósito, y esa es la pieza que sostiene el pasillo: sin
arma, los turnos en que no te cubrís no valen nada.

**Cubrirse te protege de todo, pero sólo devolvés lo que te tiraron.** Contra un
golpe le devolvés; contra algo que te quería dejar un estado encima no hay golpe
que redirigir. Por eso el botón dice, mirando el aviso, si va a haber
devolución o no: **la mitad de los bloqueos que salen son contra un estado**, y
enterarte recién en el resultado hace que el contraataque parezca roto.

**Bloquear nunca devuelve más que un ataque.** Si devolviera más, no habría
razón para atacar cuando ves venir un golpe. Lo que impide que bloquear sea la
respuesta a todo son dos reglas: hay **golpes imparables** que lo atraviesan, y
bloquear casi no hace daño — sobrevivís, pero no avanzás.

**Nada de lo que sale por USAR gasta el turno.** Ni el item, ni la sombra, ni el
poder: usar algo no cuesta tiempo, cuesta el recurso. La pregunta deja de ser
"¿vale la pena perder un turno?" y pasa a ser "¿lo quemo ahora o lo guardo para
el profesor?".

Que valga para los tres es la mitad del punto. Los tres salen del mismo menú y
se ven igual, así que una excepción no se aprende como una regla sino como una
trampa: sacarte la confusión de encima con una sombra te cobraba el turno del
enemigo, o sea que limpiarte te costaba un golpe. Por lo mismo el **miedo** no
puede quedarte duro en un USAR — ahí se cobra adentro de la tirada propia de
cada cosa, que es el número que la pantalla ya venía mostrando.

**Nada se resuelve fuera de pantalla.** Morir es un evento como cualquier otro:
tenés que ver al enemigo decidir, ejecutar y sacarte lo que te saca, y recién
después la pantalla del final. El aula no se cierra hasta que la secuencia
terminó de contarse.

**Cada profesor vencido suma +40% de daño a todo lo que hacés.** Y se ve: el
botón dice **8 (6 + 2)**, con el extra en oro —el mismo color con el que la
recompensa te lo anunció cuando lo ganaste—. El total es lo que le entra al
enemigo; el paréntesis es de dónde sale. Sin eso, la única progresión permanente
del juego era un número que se movía por atrás.

Lo mismo en las armas, en el contraataque, en los items que hacen daño y en la
comparación al canjear un arma: todos muestran lo que van a hacer **en tu mano**,
no lo que dice su ficha.
 Sin eso los
enemigos escalan por ciclo y tus números se quedan atrás: sin progresión, todos
los estilos mueren el 85-91% de las veces.

### El reloj del aula

Todo lo que podés hacer tiene una chance declarada, y hasta ahora esa chance se
resolvía en silencio y aparecía ya cocinada en una línea de texto. Ahora hay un
**reloj colgado en la pared del aula**: la aguja gira sobre el mismo arco que el
botón venía mostrando y cae del lado que tocó.

El número deja de ser una promesa y pasa a ser algo que mirás pasar. Es la misma
regla de siempre —el azar declarado es una apuesta que tomó el jugador, el azar
escondido se siente tramposo— llevada un paso más: ahora también se ve ocurrir.

Tres reglas lo sostienen:

- **La aguja nunca vuelve para atrás.** Un reloj que retrocede se lee como un
  error, no como suspenso.
- **Nunca cae sobre la línea** que separa los dos arcos, donde no se sabría de
  qué lado cayó.
- **El resultado escrito espera a que la aguja pare.** Si el texto llegara antes,
  el giro no serviría de nada.

Gira para lo que hacés vos: atacar, el arma, el item, el poder. Y para el
bloqueo, que es la más tensa de todas porque no se resuelve cuando la apretás
sino **cuando el golpe llega**.

Verificado con una prueba que agrupa miles de tiradas por el porcentaje que
declaran y compara con lo que salió de verdad. **Un arco que dice 63% tiene que
caer del lado bueno el 63% de las veces**, y si no, el reloj miente. Ya agarró
dos mentiras que estaban en el motor desde antes.

**El enemigo siempre telegrafía lo que va a hacer el turno siguiente.** Todo el
combate es leer ese aviso y decidir si pegás o te cubrís. Cubrirte en el momento
justo es la jugada más rentable del juego; cubrirte de más es perder el turno.

### Un golpe que no podés cubrir nunca pega más que uno que sí

El costo de un imparable es que cubrirse no sirve. Si además pegara más, el
turno en que aparece no tendría respuesta: ni bloquear, ni correr a matarlo.

Estaba al revés. El imparable más fuerte de los enemigos de pasillo era también
el golpe más fuerte del juego temprano —**23 en pantalla sobre 45 de vida, en el
ciclo 1**— y los remates de dos profesores llegaban a 40 sobre esos mismos 45.

Ahora, en el ciclo 1:

| | Se puede cubrir | No se puede |
|---|---|---|
| Enemigos de pasillo | hasta 25 | hasta 18 |
| Profesores | hasta 38 | hasta 32 |

Lo que no podés bloquear es siempre la amenaza **menor**. Verificado con una
invariante, para las dos categorías por separado.

> Se probó también sacar los imparables del ciclo 1 entero, y se descartó: el
> profesor que cierra ese ciclo tiene un remate imparable, así que el primero
> que verías en tu vida sería el del jefe. Enseñaría que cubrirse siempre sirve
> para romper esa regla en el peor momento posible.

### Lo que hace que cubrirse no sea siempre la respuesta

Medido: cubrirse de un golpe gana el 98,2% de las peleas contra un profesor y no
cubrirse nunca gana el 95,1%. Tres puntos. El problema no era que cubrirse fuera
mejor —tiene que serlo— sino que **era gratis**: bloquear te mantenía vivo y no
te costaba nada. Dos cosas le pusieron precio.

**Hay enemigos que se recomponen.** Una intención nueva que no se puede cubrir
porque no hay nada que cubrir: si te tapás mientras se cura, perdés el turno y
encima lo ves recuperar vida. El aviso lo dice —*«se recompone ~10 · cubrirte no
lo frena»*— así que es información, no una trampa. Tres enemigos la tienen, uno
de ellos una profesora.

**Y ganar rápido paga.** Terminar una pelea en **3 turnos o menos** —la mediana
pegando siempre— te deja llevarte un item de más, y el aula te lo muestra
mientras peleás: *ANTES DEL TIMBRE · 2 turnos*. Va a la vista y no como sorpresa
al final; si te enterases recién al ganar sería un premio consuelo, no una
decisión.

| | Peleas ganadas antes del timbre |
|---|---|
| Pegando siempre | **72%** |
| Cubriéndose cuando conviene | 27% |

Cubrirse sigue siendo más seguro. Ahora también es más pobre.

### Los tres efectos

No son números, son reglas que cambian mientras duran:

- **Confusión** — los números de la interfaz se muestran mal.
- **Miedo** — todo lo que hagas apunta **20 puntos peor**. Resta, no
  multiplica: multiplicando, un 90% con miedo daba 63% y ningún número de la
  pantalla caía redondo.
- **Torpeza** — el enemigo actúa dos veces por turno tuyo, **desde el turno
  siguiente**. Mientras la tengas, la interfaz te muestra los dos avisos: todo
  lo que te pasa tiene que haber estado anunciado. Y cubrirte vale para las
  dos: una tirada, un resultado, todo el turno.

Se pueden bloquear, salvo que la intención sea imparable. Contra un profesor
duran la mitad.

### Vida

Una sola barra. **Se regenera entera al entrar a cada aula**: cada combate es un
desafío letal autocontenido, no una carrera de desgaste. La única progresión
permanente de vida es vencer profesores (+6 máximo cada uno), y es una
capacidad, no una condición: nunca hay que administrarla.

**Sin atributos, sin XP, sin niveles.** Todo lo que te hace más fuerte son
armas, items y poderes.

---

## Las 6 materias

La materia define enemigos y arma. Es una regla generativa, no ambientación.

| Materia | Enemigos | Arma |
|---|---|---|
| Matemática | un teorema que no cierra, una demostración circular | la regla, el compás |
| Literatura | un libro que no termina, el narrador | el diccionario |
| Historia | algo que ya pasó y vuelve, la fecha que no te acordás | el puntero |
| Biología | el esqueleto del aula, lo que está en formol | el bisturí |
| Química | algo que reacciona, la campana de gases | el mechero, el ácido |
| Ed. Física | el que elige último, la soga | la pelota |

## Los profesores

Uno cierra cada ciclo. No son profesores: son lo que ve un pibe que hace tres
días que no duerme.

*el que corrige en rojo · la que sabe cómo sos por dentro · el que no se saca
los guantes · el que estuvo ahí · la que te lee en voz alta · el que cuenta
hasta diez*

## La deformación

Un escalón por ciclo, sobre dos materias al azar:

1. Se cuelan enemigos de otras materias.
2. Cambia el nombre, con el viejo tachado al lado: Matemática → *Cálculo* →
   *Contar* → *Lo que no cierra*.

---

## Poder y Defecto

Hay poderes **activos** —se usan en combate, con usos que se recargan cada
pelea— y **pasivos**, que no se usan: cambian una regla mientras los tengas.
*Espejo* es pasivo: suma 14 al contraataque pero te baja 12 puntos la chance de
bloquear bien. Elegirlo es apostar a leer los avisos.

Sorteados por separado: 6 × 6 = 36 ofertas con la mitad del contenido escrito.
**Los defectos se acumulan y son permanentes.** Se implementan como
interceptores sobre el motor — agregar uno es agregar un objeto a un catálogo.

---

## Todos los porcentajes van de a 5

Igual que los de las puertas, y por la misma razón: un número en múltiplos de 5
se piensa de cabeza en el medio de un turno. **90% de acertar** se entiende; 82%
obliga a leerlo entero para no entender nada mejor.

Eso obligó a que el miedo **reste** en vez de multiplicar —multiplicando, un 90%
con miedo daba 63%— y a redondear todo el contenido: la puntería de las armas,
su desgaste por uso, los críticos, los items, los poderes y lo que apunta cada
enemigo.

Y obligó a algo mejor: **una acción, una tirada.** Antes atacar tiraba dos veces
—una por el miedo y otra por la puntería— y la pantalla mostraba el producto.
Ahora hay un solo número y una sola tirada, que es la que gira en el reloj.

## Qué hace que te quedes

Cuatro cosas, y ninguna agrega una mecánica. Todas trabajan sobre lo que ya
pasaba: lo hacen **sentir**.

### El sonido, sintetizado

Sin un solo archivo. Es la misma decisión que los sprites —pixel art como
grillas de texto en CSS— llevada al audio: cada sonido son cuatro osciladores y
una envolvente. El repo pesa lo mismo con sonido que sin él.

Todo es corto, seco y grave. El colegio está en silencio y lo que se escucha son
cosas puntuales pasando cerca tuyo; un sonido que dura más que su evento se
convierte en música, y la música acá taparía el silencio que hace que lo demás
se escuche. **No hay loop de fondo a propósito.**

Se lee de oído sin mirar: lo tuyo es seco y con cuerpo, lo del enemigo es más
grave y más sucio, el bloqueo es metal, lo que se rompe es cristal, y errar no
suena a casi nada —que es exactamente lo que pasó—. Cuanto más fuerte el golpe,
más abajo suena.

Y **suena con el evento que se muestra, no cuando el motor resuelve el turno**.
Es la misma regla que las barras de vida: el motor resuelve la mano entera de un
saque, así que sonar ahí sería escuchar el golpe que te mata mientras la pantalla
todavía muestra tu propio ataque.

### El reloj haciendo tic

El mejor recurso de tensión que existe es un resultado ya decidido que todavía
no te dijeron. La aguja arranca disparada y frena de a poco, así que los tics
empiezan pegados y se van separando hasta que queda **uno solo colgado justo
antes de que pare**. Ese último silencio es toda la tirada.

Los tiempos salen de la misma curva que mueve la aguja en el CSS, evaluada en
JavaScript. Si fueran dos curvas distintas se desfasarían, y un tic que no cae
con la aguja se nota enseguida.

### La agonía

Abajo de un cuarto de vida se escucha el corazón y el borde de la pantalla late
con él.

**Un roguelike se recuerda por las veces que zafaste por poco.** Para que zafar
por poco se sienta, antes tiene que sentirse que estabas por morir. Es lo único
de la interfaz que corre solo, sin que pase nada: el resto reacciona a eventos,
esto es un estado, y es el único que se gana serlo.

### El final, contado

Antes decía hasta dónde llegaste y nada más. Ahora dice **quién te alcanzó**,
con su sprite; cuántas aulas abriste; cuántos profesores tiraste; y —la línea
más incómoda a propósito— **cuántas cosas te quedaban sin usar**.

Morirte con tres items guardados es la lección más útil que da el juego y sólo
se aprende si te la dicen en la cara. Lo que hace apretar OTRA VEZ no es el botón
sino acordarte de algo puntual.

### Lo que se decidió no hacer

- **Puntaje, combos, rachas.** Convierten jugar con creatividad en optimizar un
  número, que es exactamente lo contrario de lo que se busca acá.
- **Música de fondo.** Aplana el silencio del que dependen los otros sonidos.
- **Sonido para todo.** Lo que suena siempre deja de escucharse.

## Estética

Oscuro con verde agua, híbrido pixel/brutalista. Los sprites son grillas de
texto renderizadas en CSS: pixel art sin un solo archivo de imagen.

**Cinco colores, con un rol fijo cada uno.** El color significa algo en vez de
sólo decorar, así se lee sin tener que pensarlo:

| Color | Qué señala |
|---|---|
| **agua** | la interfaz y vos |
| **oro** | lo que encontrás — armas e items valiosos |
| **salud** | lo que te cura |
| **sueño** | lo que viene del sueño — poderes, defectos, únicos |
| **malo** | el enemigo y el daño |

Todos medidos contra el fondo: pasan AA para texto normal.

El sueño invierte la paleta: fondo claro, todo ordenado, sin ruido.

**Tono: terror onírico.** Serio, sin guiños.

---

## Balance

Verificado con bots sobre miles de partidas:

| Bot | Muertes | Muere en el ciclo |
|---|---|---|
| Al azar | 99,7% | 1,6 |
| Leyendo los avisos | 58,1% | 3,6 |

Los enemigos escalan por ciclo (vida +10%, daño +4%) para que el ciclo 5 no sea
más blando que el 1.

### Cuántas formas de jugar son viables

La pregunta no es cuál estrategia es la correcta —eso lleva a un juego con una
sola línea óptima— sino **cuántas maneras distintas de encarar la run
sobreviven en una banda parecida**:

| Estilo | Muertes |
|---|---|
| Guarda los items para el profesor | 52,1% |
| Decide turno a turno | 52,3% |
| Bloquea siempre que sirve | 55,6% |
| Limpia la mitad del pasillo | 60,8% |
| A lo bruto, el arma que más pegue | 60,8% |
| Nunca bloquea | 61,4% |
| Va derecho al profesor | 86,2% |

Seis estilos distintos caen dentro de 9 puntos, entre 52% y 61%. El único
claramente peor es saltearse el pasillo entero, que es lo correcto: renunciar a
todo el equipo tiene que costar. Y *cuánto* explorar sigue abierto — media
pasada compite con la pasada completa.

Que esto funcione depende de un número: **el ataque a mano limpia hace 6**. La
primera vez que se midió, con el puño en 12, la relación estaba invertida y
saltearse las aulas era lo óptimo, porque el botín no cambiaba nada. Subir la
vida de los profesores no arreglaba nada: endurecía todo sin mover cuál estilo
convenía.

---

## Falta

- **El sueño como mini-dungeon recorrible.** Hoy es una pantalla de oferta.
- **Progresión entre runs**: no se desbloquea nada todavía.
- **Las sombras están flojas**: sólo limpian efectos.
- Cosas para encontrar caminando el pasillo, más allá de las puertas.
- **Los minijuegos no usan lo que llevás encima.** Son tres pruebas cerradas;
  ninguna cambia según tu equipo, tus poderes o tus defectos.

## Sin decidir

- ¿Se puede morir dentro del sueño?
- ¿Los enemigos se ven en el pasillo antes de entrar?
- ¿El colegio es siempre el mismo edificio o se genera cada ciclo?

## Balance

Las perillas, sus valores y la historia de cada cambio están en
[BALANCE.md](BALANCE.md), con las mediciones de antes y después de cada uno
para poder volver atrás.

## Stack

TypeScript · Next.js 16 · React 19 · Tailwind v4 · Canvas 2D · Vercel
