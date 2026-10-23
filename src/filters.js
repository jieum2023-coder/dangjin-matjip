import { useSearchParams } from 'react-router-dom'

const KEYS = ['c', 'w', 'a', 'd']

/** 필터 상태를 주소창(?c=한식,중식&w=kids...)에 둬서 상세 화면에서 돌아와도 유지되게 한다 */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const f = {
    q: params.get('q') ?? '',
    hint: params.get('hint') === '1',
    view: params.get('v') === 'map' ? 'map' : 'list',
  }
  for (const k of KEYS) f[k] = params.get(k) ? params.get(k).split(',') : []

  const update = (patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (Array.isArray(v)) v.length ? next.set(k, v.join(',')) : next.delete(k)
      else if (k === 'hint') v ? next.set('hint', '1') : next.delete('hint')
      else if (k === 'view') v === 'map' ? next.set('v', 'map') : next.delete('v')
      else v ? next.set(k, v) : next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const toggle = (key, value) => {
    const cur = f[key]
    update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] })
  }
  const reset = () => update({ c: [], w: [], a: [], d: [], q: '', hint: false })
  const count = f.c.length + f.w.length + f.a.length + f.d.length
  return { f, update, toggle, reset, count }
}
