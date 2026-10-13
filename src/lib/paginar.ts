// Supabase (PostgREST) devuelve como mucho 1000 filas por pedido ("Max rows"): si una lista es más larga,
// corta sin avisar. traerTodo() la pide de a 1000 con .range() hasta que llega una página incompleta.
//
// Uso:
//   const filas = await traerTodo<Fila>((desde, hasta) =>
//     supabase.from('progreso_gondola').select('user_id,gondola').order('user_id').order('gondola').range(desde, hasta));
//
// La consulta tiene que tener un orden fijo (por la clave de la tabla): si no, entre una página y otra
// las filas se pueden repetir o saltear.

export const FILAS_POR_PAGINA = 1000;
/** Tope de seguridad: si la base ignorara el .range(), no se queda pidiendo para siempre. */
const MAX_PAGINAS = 200;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Trae todas las filas de una consulta, de a 1000. Si algún pedido falla, tira el error (no devuelve a medias). */
export async function traerTodo<T>(consulta: (desde: number, hasta: number) => Pagina<T>): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const desde = pagina * FILAS_POR_PAGINA;
    const { data, error } = await consulta(desde, desde + FILAS_POR_PAGINA - 1);
    if (error) throw error;
    const parte = data ?? [];
    filas.push(...parte);
    if (parte.length < FILAS_POR_PAGINA) return filas;
  }
  throw new Error(`traerTodo: más de ${MAX_PAGINAS * FILAS_POR_PAGINA} filas`);
}
