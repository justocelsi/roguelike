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

## Combate

Cinco acciones y **ninguna estadística detrás**. La decisión no es "cuál pega
más" sino "qué corresponde ahora".

| Acción | Qué hace |
|---|---|
| **ATACAR** | 12 de daño, fijo |
| **ESPERAR** | Te cubrís. Si el golpe llega, **contraatacás por 15** |
| **ARMA** | Daño alto, usos limitados; cuando se acaban se rompe |
| **USAR** | Item, sombra o poder |
| **HUIR** | Salís al pasillo. Contra un profesor la puerta no abre |

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
permanente de vida es vencer profesores (+6 máximo cada uno).

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

Verificado con 2000 partidas simuladas por bot:

| Bot | Muertes | Muere en el ciclo |
|---|---|---|
| Al azar | 99,2% | 2,1 |
| Leyendo los avisos | 50,0% | 4,0 |

Los enemigos escalan por ciclo (vida +10%, daño +4%) para que el ciclo 5 no sea
más blando que el 1.

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
