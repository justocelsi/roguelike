# VIGILIA

> Un roguelike de terror onírico. Sos un estudiante, las aulas son pesadillas,
> y cada vez que dormís elegís un poder y aceptás el defecto que viene con él.

---

## Origen

**Ciencia ficción de ideas**: *Solaris* (Lem), *La rueda celeste* (Le Guin),
*Soy leyenda* (Matheson), *Fundación* y *Yo, Robot* (Asimov). De ahí viene que
lo que se corrompe no sean tus stats sino **lo que creías saber**.

**NO-SKIN** (No-Eye Soft): el formato de elegir entre salas con probabilidades
declaradas, el combate por turnos donde cada acción consume un turno, y el
minimalismo de terror.

**Shadow Slave** (Guiltythree): ascender exige aceptar un **Defecto**
permanente. El poder no se gana, se compra, y el precio te lo bancás el resto
de la run.

---

## El bucle

1. **Se te ofrecen 3 aulas.** Cada una es una materia, con su tabla de
   eventos y sus probabilidades declaradas. Lo único incierto del juego es
   **qué vas a encontrar antes de entrar**.
2. **Entrás con la vida llena.** Adentro no hay información oculta: ves al
   enemigo, ves sus intenciones, ves tus opciones.
3. **Combate por turnos.** Cada acción consume un turno, incluidas usar un
   item y usar el arma.
4. **Ganás XP.** Al subir de nivel elegís qué atributo subir.
5. Después de **6 aulas** se termina el ciclo y **dormís**.
6. **El sueño es un lugar**, no un menú: un mini-dungeon corto que se recorre,
   y al fondo está la oferta de **poder + defecto**.
7. Despertás. El colegio se deformó un escalón más. Repetís.
8. **La muerte es permanente.**

**5 ciclos** por run. Todos los números son de arranque y se afinan jugando.

### Qué es lo escaso

Nada se acumula entre aulas: la vida vuelve al máximo al entrar. Eso quiere
decir que **cada combate es un desafío letal autocontenido** — morís adentro de
una pelea o no morís. La dificultad tiene que salir del combate en sí, nunca
del desgaste.

La decisión al elegir aula no es "cuánta vida me queda" sino **qué atributo
expongo**, porque cada materia lastima de una manera distinta.

---

## Atributos

Tres, y una sola barra de vida.

| Atributo | Potencia el verbo | Resiste el efecto |
|---|---|---|
| **Conocimiento** | RESOLVER | Confusión |
| **Nervio** | AGUANTAR | Miedo |
| **Reflejos** | ESQUIVAR | Torpeza |

Los atributos **no son barras**: son stats. La vida es una sola y morís cuando
llega a cero.

### Los tres efectos

No son números, son **reglas que cambian mientras dure el estado**:

- **Confusión** — los textos y los números de la interfaz se muestran mal.
- **Miedo** — tu acción puede fallar directamente.
- **Torpeza** — el enemigo actúa dos veces por turno tuyo.

---

## Combate

Por turnos. **Toda acción consume un turno**, incluidas item y arma.

| Acción | Qué hace |
|---|---|
| **RESOLVER** | Ataque basado en Conocimiento |
| **AGUANTAR** | Reduce el daño de este turno, basado en Nervio |
| **ESQUIVAR** | Evita el ataque y contraatacás, basado en Reflejos |
| **ARMA** | Usa el arma equipada |
| **ITEM** | Usa un consumible |
| **PODER** | Habilidad ganada en un sueño, usos limitados |
| **HUIR** | Salís vivo, perdés la recompensa del aula |

- Cada enemigo tiene una **debilidad**: hay un verbo que le funciona mejor que
  los otros, y descubrirlo es el juego.
- Cada enemigo **telegrafía su intención** un turno antes.
- La vida del enemigo **se ve**.

---

## Las 6 materias

Cada materia define sus enemigos, su arma y **qué atributo lastima**. Ese
vínculo es una regla generativa, no ambientación: si la sala es Matemática, la
regla es un arma y el enemigo es un teorema.

| Materia | Ataca | Efecto | Enemigos | Arma |
|---|---|---|---|---|
| **Matemática** | Conocimiento | Confusión | el teorema que no cierra, la demostración circular | la regla, el compás |
| **Literatura** | Conocimiento | Confusión | el libro que no termina, el narrador | el diccionario |
| **Historia** | Nervio | Miedo | algo que ya pasó y vuelve, la fecha | el puntero, el mapa |
| **Biología** | Nervio | Miedo | el esqueleto del aula, lo que está en formol | el bisturí |
| **Química** | Reflejos | Torpeza | algo que reacciona, la campana de gases | el mechero, el ácido |
| **Ed. Física** | Reflejos | Torpeza | el que elige último, la soga | la pelota, el silbato |

Dos materias por atributo: siempre hay una alternativa, pero nunca una salida
gratis.

---

## La deformación

El colegio arranca **reconocible** y se corrompe progresivamente, un escalón
por ciclo:

1. **Cambian los enemigos.** El aula sigue siendo Matemática, pero lo que
   aparece adentro es cada vez menos matemático.
2. **Cambia el nombre.** La materia pasa a llamarse otra cosa, con el nombre
   viejo tachado al lado. Sos el único que recuerda cómo se llamaba.
3. **Cambian las reglas.** Matemática deja de atacar Conocimiento y empieza a
   atacar Nervio. Lo que aprendiste sobre esa materia se vuelve falso.

El paso 3 es donde sobrevive el hilo epistemológico original: el castigo no es
que te peguen más fuerte, es que **tu modelo del mundo deje de servir**.

---

## Poder y Defecto

Al fondo del sueño hay una oferta. **Ves el precio antes de aceptar.**

- El **poder** y el **defecto** se sortean por separado, así que 6 poderes × 6
  defectos son 36 ofertas distintas con la mitad del contenido escrito.
- Los **defectos se acumulan** durante toda la run. Son permanentes.
- Se implementan como **interceptores** sobre el motor, no como `if`s: cada
  punto donde el juego decide algo consulta la lista activa. Agregar uno nuevo
  es agregar un objeto a un catálogo.

---

## Items

- **Un arma equipada.** Sale de la materia donde la conseguiste.
- **Consumibles**, pocos y con espacio limitado.
- **Sombras**: lo que derrotás se te queda. Como es algo que ya entendiste, se
  gasta en saber — revelar, anular un efecto. Un uso cada una.
- Todo se pierde al morir.

---

## Progresión entre runs

El nivel y los atributos **se reinician**. Lo que queda desbloqueado son
materias, items y poderes que pueden aparecer en runs futuras.

---

## Estética

**Oscuro con verde agua.** Híbrido entre pixel art y brutalismo: sprites y
barras de vida, pero con tipografía grande y bloques planos en vez de
ventanitas de JRPG.

**Tono: terror onírico.** Serio, inquietante, sin guiños ni chistes. El colegio
como pesadilla, no como parodia.

---

## Decisiones tomadas por default

Marcadas para poder vetarlas:

- 6 aulas por ciclo, 5 ciclos por run
- Se puede huir, perdiendo la recompensa del aula
- La vida del enemigo se ve en números
- Estás solo: sin compañeros ni profesores como personajes
- El estudiante no sabe que está soñando; lo descubre el jugador
- La misma materia puede repetirse en una misma oferta

## Sin decidir

- **¿Se puede morir dentro del sueño?** Por ahora no: el sueño es sólo el
  lugar donde se altera la realidad. Queda para más adelante.
- El catálogo concreto de poderes y defectos
- Qué hace exactamente el arma frente a los tres verbos de atributo
- Si hay jefes, y si los parciales o finales lo son

---

## Stack

TypeScript · Next.js 16 (App Router) · React 19 · Tailwind v4 · Vercel
