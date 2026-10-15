// ─── Roles ───────────────────────────────────────────────────────────────────
//  estudiante : responde y ve su propio progreso.
//  docente    : gestiona SUS grupos, asigna pruebas, propone preguntas/recursos.
//  admin      : el jefe ("super admin"): todo lo anterior sobre todos los grupos,
//               usuarios, ciclos, taxonomía, reglas y respaldo.
//  revisor    : admin de SOLO LECTURA: ve todos los grupos, estudiantes,
//               estadísticas, banco y biblioteca, pero no puede crear, editar,
//               aprobar ni borrar nada. En la nube lo garantizan las políticas
//               RLS (supabase/migracion-008-revisor.sql); en la app se ocultan
//               los botones de edición.
export const ROLES = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  admin: 'Admin (jefe)',
  revisor: 'Revisor (solo lectura)',
}

export const esRevisor = (u) => u?.rol === 'revisor'
export const esGestor = (u) => u?.rol === 'docente' || u?.rol === 'admin' || u?.rol === 'revisor'
export const veTodosLosGrupos = (u) => u?.rol === 'admin' || u?.rol === 'revisor'
// Puede crear/editar cosas de docente (grupos, asignaciones, banco, recursos).
export const puedeEditar = (u) => u?.rol === 'docente' || u?.rol === 'admin'
