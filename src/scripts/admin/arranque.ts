// Cómo arranca cada pestaña del panel de admin: espera la sesión, deja pasar solo a las admins y trae
// los datos. Si la primera carga falla, en lugar del panel aparece el cartel de ErrorCarga.astro con
// "Reintentar"; si falla una actualización, queda a la vista lo que ya estaba y lo avisa abajo.
import { supabase } from '../../lib/supabase';
import { sesionLista, type Acceso } from '../sesion';
import { avisar } from '../aviso';
import { $ } from './comun';

export function arrancarPanel(o: {
  /** Trae los datos y los pinta. Si algo falla, tiene que tirar el error. */
  cargar: () => Promise<void>;
  /** Con la sesión ya confirmada, antes de la primera carga. */
  alEntrar?: (acceso: Acceso) => void;
  /** Una sola vez, cuando el panel aparece (enlaces profundos, actualizar cada minuto). */
  alMostrar?: () => void;
}) {
  let mostrado = false;
  const ver = (sel: string, si: boolean) => $(sel).classList.toggle('hidden', !si);

  /** Vuelve a traer los datos. Con manual = true (el botón "Actualizar datos") avisa cuando terminó. */
  async function refrescar(manual = false): Promise<boolean> {
    try {
      await o.cargar();
    } catch (e) {
      console.error('No se pudieron cargar los datos del panel:', e);
      if (mostrado) {
        avisar('No se pudieron actualizar los datos. Revisá la conexión.', { accion: { texto: 'Reintentar', alTocar: () => void refrescar(true) }, ms: 8000 });
      } else {
        ver('[data-cargando]', false);
        ver('[data-error-carga]', true);
      }
      return false;
    }
    if (!mostrado) {
      mostrado = true;
      ver('[data-cargando]', false);
      ver('[data-error-carga]', false);
      ver('[data-panel]', true);
      o.alMostrar?.();
    } else if (manual) avisar('Datos actualizados.');
    return true;
  }

  $('[data-recargar]').addEventListener('click', () => void refrescar(true));
  $('[data-reintentar]').addEventListener('click', () => {
    ver('[data-error-carga]', false);
    ver('[data-cargando]', true);
    void refrescar();
  });

  sesionLista.then((acceso) => {
    if (!acceso || acceso.rol !== 'admin' || !supabase) {
      ver('[data-cargando]', false);
      ver('[data-sin-permiso]', true);
      return;
    }
    o.alEntrar?.(acceso);
    void refrescar();
  });

  return refrescar;
}
