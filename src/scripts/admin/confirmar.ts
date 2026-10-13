// Confirmación propia del panel de admin (en vez de confirm()): muestra a quién afecta, explica qué
// pasa y deja el foco en "Cancelar", así un Enter apurado no da de baja a nadie.
let dialogo: HTMLDialogElement | null = null;

export function confirmar(o: { titulo: string; texto: string; si: string; peligro?: boolean }): Promise<boolean> {
  if (!dialogo) {
    dialogo = document.createElement('dialog');
    dialogo.className = 'm-auto w-[min(460px,calc(100%-24px))] rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-profundo/35 backdrop:backdrop-blur-sm';
    dialogo.innerHTML =
      '<form method="dialog" class="p-6">' +
      '<p class="text-xl font-bold text-profundo" data-c-titulo></p>' +
      '<p class="mt-2 text-texto-2" data-c-texto></p>' +
      '<div class="mt-6 flex flex-wrap justify-end gap-2">' +
      '<button value="no" class="boton boton-secundario" data-c-no>Cancelar</button>' +
      '<button value="si" data-c-si></button>' +
      '</div></form>';
    document.body.append(dialogo);
  }
  const d = dialogo;
  d.querySelector('[data-c-titulo]')!.textContent = o.titulo;
  d.querySelector('[data-c-texto]')!.textContent = o.texto;
  const si = d.querySelector<HTMLButtonElement>('[data-c-si]')!;
  si.textContent = o.si;
  si.className = `boton ${o.peligro ? 'bg-peligro text-white hover:opacity-90' : 'boton-principal'}`;
  d.returnValue = '';
  d.showModal();
  d.querySelector<HTMLButtonElement>('[data-c-no]')!.focus();
  return new Promise((ok) => d.addEventListener('close', () => ok(d.returnValue === 'si'), { once: true }));
}
