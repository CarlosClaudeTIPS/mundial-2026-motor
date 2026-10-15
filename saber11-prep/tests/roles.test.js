import { describe, it, expect } from 'vitest'
import { esRevisor, esGestor, veTodosLosGrupos, puedeEditar } from '../src/lib/roles'

describe('roles', () => {
  const u = (rol) => ({ rol })
  it('el revisor ve todo pero no edita', () => {
    expect(esRevisor(u('revisor'))).toBe(true)
    expect(esGestor(u('revisor'))).toBe(true)
    expect(veTodosLosGrupos(u('revisor'))).toBe(true)
    expect(puedeEditar(u('revisor'))).toBe(false)
  })
  it('el admin es el jefe: ve todo y edita', () => {
    expect(veTodosLosGrupos(u('admin'))).toBe(true)
    expect(puedeEditar(u('admin'))).toBe(true)
  })
  it('el docente edita solo lo suyo y el estudiante nada', () => {
    expect(veTodosLosGrupos(u('docente'))).toBe(false)
    expect(puedeEditar(u('docente'))).toBe(true)
    expect(esGestor(u('estudiante'))).toBe(false)
    expect(puedeEditar(u('estudiante'))).toBe(false)
    expect(puedeEditar(null)).toBe(false)
  })
})
