import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { show } from '../data'

/** 현재 필터 결과 안에서 한 곳을 골라 보여준다. 식당외(먹거리 가게)는 필터로 고르지 않는 한 제외된 상태다. */
export default function RandomPick({ list, search }) {
  const [pick, setPick] = useState(null)
  const dialog = useRef(null)

  const draw = () => {
    if (!list.length) return
    let next = list[Math.floor(Math.random() * list.length)]
    if (list.length > 1) while (next === pick) next = list[Math.floor(Math.random() * list.length)]
    setPick(next)
  }

  useEffect(() => {
    if (pick && !dialog.current.open) dialog.current.showModal()
  }, [pick])

  return (
    <>
      <button type="button" className="random-btn" onClick={draw} disabled={!list.length}>
        오늘 뭐 먹지? 🎲
      </button>
      <dialog ref={dialog} className="random-dialog" onClose={() => setPick(null)}>
        {pick && (
          <div>
            <p className="muted">지금 고른 조건의 {list.length}곳 중에서 골랐어요</p>
            <h2>{pick.name ?? '상호 확인 중'}</h2>
            <p><span className="pill">{pick.cuisine}</span> {show(pick.region ?? pick.area)}</p>
            <p className="intro">{pick.intro}</p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={draw}>다시 뽑기</button>
              <Link className="btn primary" to={`/r/${pick.id}${search}`}>자세히 보기</Link>
            </div>
            <button type="button" className="close" aria-label="닫기" onClick={() => dialog.current.close()}>✕</button>
          </div>
        )}
      </dialog>
    </>
  )
}
