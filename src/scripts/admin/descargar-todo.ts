// "Descargar todo": un solo Excel con toda la información del panel, en hojas, para trabajarla aparte.
// Horas y fichadas del mes elegido; el equipo y el avance en la guía, completos.
import { supabase } from '../../lib/supabase';
import { duracion } from '../../lib/fichador';
import { descargarXlsx, type Celda, type Hoja } from '../../lib/xlsx';
import { cargarAprendizaje, eventos, porUsuario, promedioRepasos, type InfoGuia } from './aprendizaje-datos';
import { DIAS, METODO, fichadasEntre, nombreDe, q, tramosPorPersona, type Horario, type Persona } from './comun';

/** mes: "AAAA-MM". */
export async function descargarTodo(mes: string, info: InfoGuia) {
  const [a, m] = mes.split('-').map(Number);
  const primero = `${mes}-01`;
  const siguiente = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  const diasDelMes = new Date(a, m, 0).getDate();

  const [fs, horarios, ajustes, apr] = await Promise.all([
    fichadasEntre(primero, siguiente),
    q<Horario[]>(supabase!.from('horarios').select('email,dia,entrada,salida')),
    q<{ horas_max_turno: number }[]>(supabase!.from('ajustes_fichador').select('horas_max_turno')),
    cargarAprendizaje(),
  ]);
  const personas: Persona[] = [...apr.equipo, ...apr.bajas].sort((x, y) => nombreDe(x).localeCompare(nombreDe(y)));
  const nombre = (email: string) => {
    const p = personas.find((x) => x.email === email);
    return p ? nombreDe(p) : email.split('@')[0];
  };
  const fecha = (iso: string | null | undefined): Celda => ({ fecha: iso ?? null });

  // Horas del mes, por persona
  const ts = tramosPorPersona(
    fs.filter((f) => !f.anulada),
    ajustes[0]?.horas_max_turno ?? 16,
  );
  const horas: Celda[][] = [
    ['Nombre', 'Mail', 'Días trabajados', 'Horas', 'Horas (h:mm)', 'Carga horaria semanal', 'Horas esperadas en el mes (aprox.)', 'Tramos sin salida o sin entrada', 'Fichadas para revisar'],
  ];
  for (const p of personas) {
    const mios = ts.filter((t) => t.email === p.email);
    if (!mios.length && !(p.activo && p.horas_semana)) continue;
    const ms = mios.reduce((s, t) => s + t.ms, 0);
    const carga = p.horas_semana ? Number(p.horas_semana) : null;
    horas.push([
      nombreDe(p),
      p.email,
      new Set(mios.map((t) => t.dia)).size,
      Math.round((ms / 3600000) * 100) / 100,
      duracion(ms),
      carga,
      carga ? Math.round(((carga * diasDelMes) / 7) * 10) / 10 : null,
      mios.filter((t) => !t.entrada || !t.salida).length,
      fs.filter((f) => f.email === p.email && !f.anulada && f.revisar && !f.revisada_el).length,
    ]);
  }

  // Cada fichada del mes
  const fichadas: Celda[][] = [
    ['Nombre', 'Mail', 'Tipo', 'Fecha y hora', 'Cómo fichó', 'Parecido (%)', 'Para revisar', 'Revisada por', 'Cargada por', 'Nota', 'Hora original', 'Corregida por', 'Anulada', 'Motivo'],
  ];
  for (const f of fs)
    fichadas.push([
      nombre(f.email),
      f.email,
      f.tipo === 'entrada' ? 'Entrada' : 'Salida',
      fecha(f.hora),
      METODO[f.metodo],
      f.similitud != null ? Math.round(f.similitud * 100) : null,
      f.revisar,
      f.revisada_por,
      f.creada_por,
      f.nota,
      fecha(f.hora_original),
      f.corregida_por,
      f.anulada ? 'Sí' : '',
      [f.motivo, f.anulada_motivo].filter(Boolean).join(' · '),
    ]);

  // El equipo
  const horarioTexto = (email: string) =>
    [1, 2, 3, 4, 5, 6, 0]
      .map((d) => horarios.find((h) => h.email === email && h.dia === d))
      .filter(Boolean)
      .map((h) => `${DIAS[h!.dia].slice(0, 3)} ${h!.entrada.slice(0, 5)}–${h!.salida.slice(0, 5)}`)
      .join(' · ');
  const equipo: Celda[][] = [
    ['Nombre', 'Mail', 'Rol', 'Estado', 'Cara registrada', 'Carga horaria semanal', 'Horario fijo', 'Agregada', 'Primer ingreso', 'Último ingreso', 'De baja desde'],
  ];
  for (const p of personas)
    equipo.push([
      nombreDe(p),
      p.email,
      p.rol === 'admin' ? 'Admin' : 'Empleada',
      p.activo === false ? 'De baja' : 'Activa',
      apr.conCara.has(p.email) ? 'Sí' : 'No',
      p.horas_semana ? Number(p.horas_semana) : null,
      p.horario_fijo ? horarioTexto(p.email) : '',
      fecha(p.agregado_el),
      fecha(p.primer_ingreso),
      fecha(p.ultimo_ingreso),
      fecha(p.baja_el),
    ]);

  // Avance en la guía, una fila por persona
  const total = info.gondolas.length;
  const avance: Celda[][] = [
    [
      'Nombre',
      'Mail',
      `Góndolas leídas (de ${total})`,
      `Góndolas completadas (de ${total})`,
      'Promedio en repasos (%)',
      `Temas de Bienvenida leídos (de ${info.secciones.length})`,
      ...info.niveles.map((n) => `Nivel ${n.numero} ${n.nombre}`),
      'Exámenes hechos',
      'Mejor nota de examen (%)',
    ],
  ];
  for (const p of apr.equipo) {
    const gs = porUsuario(apr.gondolas, p.user_id);
    const its = porUsuario(apr.intentos, p.user_id);
    const prom = promedioRepasos(gs);
    avance.push([
      nombreDe(p),
      p.email,
      gs.filter((x) => x.vista_el).length,
      gs.filter((x) => x.completada_el).length,
      prom === null ? null : Math.round(prom * 100),
      new Set(porUsuario(apr.leidas, p.user_id).map((x) => x.seccion)).size,
      ...info.niveles.map((n) => {
        const ap = its.filter((x) => x.nivel === n.numero && x.aprobado).sort((x, y) => x.hecho_el.localeCompare(y.hecho_el))[0];
        return ap ? `Aprobado (${ap.nota}%)` : its.some((x) => x.nivel === n.numero) ? 'No aprobado todavía' : 'Sin hacer';
      }),
      its.length,
      its.length ? Math.max(...its.map((x) => x.nota)) : null,
    ]);
  }

  // Toda la actividad en la guía
  const quien = new Map(personas.filter((p) => p.user_id).map((p) => [p.user_id!, p]));
  const actividad: Celda[][] = [['Nombre', 'Mail', 'Tipo', 'Qué', 'Resultado', 'Fecha']];
  for (const e of eventos(apr, info)) {
    const p = quien.get(e.user_id);
    actividad.push([p ? nombreDe(p) : '(ya no tiene acceso)', p?.email ?? '', e.tipo, e.que, e.resultado, fecha(e.fecha)]);
  }

  const hojas: Hoja[] = [
    { nombre: 'Horas del mes', filas: horas, anchos: [22, 30, 10, 10, 12, 12, 14, 14, 12] },
    { nombre: 'Fichadas del mes', filas: fichadas, anchos: [22, 30, 9, 17, 24, 10, 40, 26, 26, 30, 17, 26, 9, 30] },
    { nombre: 'Equipo', filas: equipo, anchos: [22, 30, 10, 9, 10, 12, 50, 17, 17, 17, 17] },
    { nombre: 'Avance en la guía', filas: avance, anchos: [22, 30, 12, 12, 12, 12, ...info.niveles.map(() => 20), 10, 12] },
    { nombre: 'Actividad en la guía', filas: actividad, anchos: [22, 30, 18, 40, 30, 17] },
  ];
  descargarXlsx(`lola-todo-${mes}.xlsx`, hojas);
}
