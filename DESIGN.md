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
3. **Entrás a un aula** y hay un combate por turnos. Ganás un arma o un item.
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

Verificado con 10 invariantes automáticas sobre 1500 partidas.

### Salas icónicas

Cada materia da **siempre lo suyo**. No es una limitación: es lo que hace que en
la run número diez sepas que Biología cura y Química lastima, y elijas el
pasillo con esa información. La primera partida es a ciegas; de ahí en más lo
que sabés es una herramienta.

| Materia | Armas | Items |
|---|---|---|
| Matemática | la regla, el compás | la tiza, **el café de la sala** |
| Literatura | el diccionario | el apunte, **los anteojos de alguien** |
| Historia | el puntero | el apunte, el caramelo |
| Biología | el bisturí | la venda, la botella |
| Química | el mechero, el ácido | el alcohol, la tiza |
| Ed. Física | la pelota | la botella, el caramelo, **la lata del quiosco** |

Los items no son todos del mismo tipo. Además de los instantáneos hay tres
formas distintas, tomadas de NO-SKIN:

- **El café** suma daño **por el resto de la pelea** y se acumula. Se decide
  temprano, que es cuando menos sabés contra qué estás.
- **Los anteojos** absorben el próximo golpe entero. Es la respuesta a un
  golpe imparable: te dejan atacar en el turno en que cubrirse no sirve.
- **La lata** te cobra 4 por turno pero te devuelve la mitad de lo que hacés.
  Riesgo puro; premia al que corre a terminar la pelea.

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
| **BLOQUEAR** | 90% de que salga. Si sale, sólo entra el 40% del golpe **y le devolvés 3** |
| **ARMA** | Daño alto y usos contados **por pelea**. Es lo que hacés en los turnos en que no te cubrís |
| **USAR** | Item, sombra o poder |
| **HUIR** | Salís al pasillo. Contra un profesor la puerta no abre |

El puño es débil a propósito, y esa es la pieza que sostiene el pasillo: sin
arma, los turnos en que no te cubrís no valen nada.

**Bloquear nunca devuelve más que un ataque**, y deja pasar el 40% del golpe.
Si devolviera más, no habría razón para atacar cuando ves venir un golpe; si
anulara todo, no existiría la opción de correr a matarlo antes. Esas dos reglas
son lo que hace que el turno sea una decisión y no un reflejo.

**Cada profesor vencido suma +40% de daño a todo lo que hacés.** Sin eso los
enemigos escalan por ciclo y tus números se quedan atrás: sin progresión, todos
los estilos mueren el 85-91% de las veces.

**El enemigo siempre telegrafía lo que va a hacer el turno siguiente.** Todo el
combate es leer ese aviso y decidir si pegás o te cubrís. Cubrirte en el momento
justo es la jugada más rentable del juego; cubrirte de más es perder el turno.

### Los tres efectos

No son números, son reglas que cambian mientras duran:

- **Confusión** — los números de la interfaz se muestran mal.
- **Miedo** — tu acción puede fallar directamente.
- **Torpeza** — el enemigo actúa dos veces por turno tuyo.

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
| Limpia todo, guarda los items para el profesor | 44,0% |
| Limpia todo a lo bruto, el arma que más pegue | 45,1% |
| Limpia la mitad del pasillo | 46,3% |
| Limpia todo, quema items apenas baja la vida | 49,2% |
| Va derecho al profesor | 65,9% |

Cuatro estilos distintos caen entre 44% y 49%. El único claramente peor es
saltearse el pasillo entero, que es lo correcto: renunciar a todo el equipo
tiene que costar. Y *cuánto* explorar sigue abierto — media pasada compite con
la pasada completa.

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
