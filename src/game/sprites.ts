/**
 * Sprites como texto. Se renderizan en CSS como una grilla de bloques, así que
 * tenemos pixel art sin depender de un solo archivo de imagen.
 *
 * Dos tonos: `#` es el color pleno y `+` una versión apagada del mismo color.
 * Con eso alcanza para que las formas tengan contorno y relleno, que es lo que
 * las hace leerse como una figura y no como una mancha.
 *
 * Uno por materia. Abstractos y no literales: el terror onírico funciona mejor
 * cuando la forma casi se reconoce.
 */

/** Íconos de 5×5 para las puertas del pasillo. */
export const ICONOS: Record<string, string[]> = {
  matematica: ["..#..", "..#..", "#####", "..#..", "..#.."],
  literatura: [".....", "##.##", "#####", "##.##", "....."],
  historia: ["#####", ".###.", "..#..", ".###.", "#####"],
  biologia: [".###.", "#####", "#.#.#", "#####", ".#.#."],
  quimica: [".###.", "..#..", "..#..", ".###.", "#####"],
  fisica: [".###.", "##.##", "#.#.#", "##.##", ".###."],
};

/** Íconos de los tres estados. Se ven al recibirlos y en la ficha de arriba. */
export const ICONOS_EFECTO: Record<string, string[]> = {
  // Un signo de pregunta: dejaste de entender.
  confusion: [".###.", "#...#", "...#.", ".....", "..#.."],
  // Un ojo abierto de más.
  miedo: [".###.", "#+++#", "#+#+#", "#+++#", ".###."],
  // Un aspa: el cuerpo no va donde lo mandás.
  torpeza: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
};

/**
 * Íconos de 7×7 para las acciones del combate. Al lado del texto, no en lugar
 * de él: el dibujo se reconoce de reojo y la palabra confirma.
 */
export const ICONOS_ACCION: Record<string, string[]> = {
  // Un impacto.
  atacar: ["..#.#..", ".#.#.#.", "..###..", ".#####.", "..###..", ".#.#.#.", "..#.#.."],
  // Un escudo.
  bloquear: ["#######", "#+++++#", "#+++++#", "#+++++#", ".#+++#.", "..#+#..", "...#..."],
  // Un filo.
  arma: [".....##", "....##+", "...##+.", "..##+..", ".##+...", "##+....", "#+....."],
  // Una bolsita.
  usar: [".#####.", "#+++++#", "#+++++#", "#+++++#", "#+++++#", ".#####.", "..###.."],
  // Salir por donde viniste.
  huir: ["...#...", "..##...", ".###...", "#######", ".###...", "..##...", "...#..."],
};

/** Íconos de 7×7 para cada cosa que se puede llevar en el bolsillo. */
export const ICONOS_ITEM: Record<string, string[]> = {
  agua: ["..###..", "..#+#..", ".#####.", ".#+++#.", ".#####.", ".#####.", "..###.."],
  caramelo: [".......", "#.....#", "##.#.##", ".#####.", "##.#.##", "#.....#", "......."],
  venda: ["..###..", "..#+#..", "#######", "#++#++#", "#######", "..#+#..", "..###.."],
  apunte: ["#######", "#+++++#", "#+###+#", "#+++++#", "#+###+#", "#+++++#", "#######"],
  tiza: [".....##", "....##+", "...##+.", "..##+..", ".##+...", ".......", "......."],
  alcohol: ["..###..", "...#...", "...#...", ".#####.", ".#+++#.", ".#####.", "..###.."],
  cafe: ["..#.#..", ".......", "######.", "#++++##", "#++++#+", "#++++#.", ".####.."],
  anteojos: [".......", ".......", "##.#.##", "#+#.#+#", "##.#.##", ".......", "......."],
  energizante: [".#####.", ".#+++#.", ".#.#.#.", ".#.#.#.", ".#.#.#.", ".#+++#.", ".#####."],
  // Un bloque de fieltro con el mango arriba: lo que borra lo que iba a pasar.
  borrador: [".......", "..###..", ".#####.", "#######", "#+++++#", "#######", "......."],
  // Una regla con sus marcas.
  regla_ajena: ["#######", "#+#+#+#", "#######", ".......", "#######", "#+#+#+#", "#######"],
};

export const SPRITES: Record<string, string[]> = {
  // Un símbolo que se partió y quedó mirándote.
  matematica: [
    "....####....",
    "...#++++#...",
    "..#+#++#+#..",
    "..#..##..#..",
    "..#++++++#..",
    "..##....##..",
    "...#.##.#...",
    "....####....",
    ".....##.....",
    "....#..#....",
  ],
  // El cráneo del rincón, con las cuencas vacías.
  biologia: [
    "...######...",
    "..#++++++#..",
    ".#+#....#+#.",
    ".#+#....#+#.",
    ".#++++++++#.",
    "..#++..++#..",
    "...#++++#...",
    "...#.##.#...",
    "...#.##.#...",
    "....####....",
  ],
  // Algo que sube por el vidrio.
  quimica: [
    ".....##.....",
    ".....##.....",
    "....#++#....",
    "....#++#....",
    "...#++++#...",
    "..#++..++#..",
    ".#++....++#.",
    ".#++++++++#.",
    ".##########.",
    "..########..",
  ],
  // Un arco que vuelve al mismo lugar.
  historia: [
    "..########..",
    ".#++++++++#.",
    "#+#......#+#",
    "#+#..##..#+#",
    "#+#..##..#+#",
    "#+#......#+#",
    ".#++++++++#.",
    "..########..",
    "...#....#...",
    "..##....##..",
  ],
  // Un libro abierto que no se cierra.
  literatura: [
    "............",
    ".##......##.",
    ".#+#....#+#.",
    ".#++#..#++#.",
    ".#+++##+++#.",
    ".#+++##+++#.",
    ".#++#..#++#.",
    ".#+#....#+#.",
    ".##......##.",
    "............",
  ],
  // Algo redondo que viene rebotando.
  fisica: [
    "....####....",
    "...#++++#...",
    "..#+#..#+#..",
    ".#++#..#++#.",
    ".#+#....#+#.",
    ".#+#....#+#.",
    ".#++#..#++#.",
    "..#+#..#+#..",
    "...#++++#...",
    "....####....",
  ],
};
