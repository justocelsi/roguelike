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

## El principio: capacidades persisten, condiciones se restauran

Todo el modelo de recursos sale de una sola regla:

> **Entre combates persiste lo que *tenés*. Se restaura lo que *gastaste*.**

Lo que tenés —el arma, los items, los poderes, las sombras— es una
**capacidad** y te acompaña toda la run. Lo gastado —vida, usos, filo del
arma, efectos— es una **condición**, vive adentro del combate y muere con él.
Nada de eso cruza la puerta del aula.

Consecuencias, todas verificadas con invariantes automáticas:

- Entrás a cada aula **entero y con todo cargado**.
- Las armas **no se rompen**: tienen usos *por pelea*.
- Los poderes son **habilidades por combate**, no un recurso de la run.
- Los items no se consumen para siempre: repetidos = más usos por pelea.
- Las sombras se cargan igual, pero **sólo se puede gastar una por combate**
  (si no, con quince encima los efectos dejarían de existir).

En este colegio nada de lo que llevás se termina. El único que se gasta sos
vos, y eso se arregla cuando salís del aula. **El único costo de pelear es el
riesgo de morir.**

## Combate

Cinco acciones y **ninguna estadística detrás**. La decisión no es "cuál pega
más" sino "qué corresponde ahora".

| Acción | Qué hace |
|---|---|
| **ATACAR** | 6 de daño. A mano limpia no le hacés gran cosa a esto |
| **ESPERAR** | Te cubrís. Si el golpe llega, **contraatacás por 15** |
| **ARMA** | Daño alto y usos contados **por pelea**. Es lo que hacés en los turnos en que no te cubrís |
| **USAR** | Item, sombra o poder |
| **HUIR** | Salís al pasillo. Contra un profesor la puerta no abre |

El puño es débil a propósito, y esa es la pieza que sostiene el pasillo: sin
arma, los turnos en que no te cubrís no valen nada. Ver el balance abajo.

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

Sorteados por separado: 6 × 6 = 36 ofertas con la mitad del contenido escrito.
**Los defectos se acumulan y son permanentes.** Se implementan como
interceptores sobre el motor — agregar uno es agregar un objeto a un catálogo.

---

## Estética

Oscuro con verde agua, híbrido pixel/brutalista. Los sprites son grillas de
texto renderizadas en CSS: pixel art sin un solo archivo de imagen.

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

### La decisión del pasillo, medida

Con nada que se gaste entre aulas, el único costo de pelear es el riesgo de
morir — así que hay que verificar que limpiar el pasillo siga valiendo la pena:

| Estrategia | Muertes | Items | Con arma |
|---|---|---|---|
| Limpia el pasillo | 58,8% | 4,9 | 97% |
| Va derecho al profesor | 71,2% | 1,0 | 0% |

La primera vez que se midió esto el resultado estaba **invertido**: saltearse
las aulas era más seguro, porque el botín no cambiaba nada. La causa no era que
las aulas fueran peligrosas —18 peleas sumaban 2,5 puntos de muerte— sino que
el ataque a mano limpia era demasiado bueno y el arma aportaba apenas el 15% del
daño de una pelea. Bajar el puño de 12 a 6 es lo que hizo existir la decisión.

Subir la vida de los profesores no servía: endurecía todo sin cambiar cuál
estrategia convenía.

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

## Stack

TypeScript · Next.js 16 · React 19 · Tailwind v4 · Canvas 2D · Vercel
