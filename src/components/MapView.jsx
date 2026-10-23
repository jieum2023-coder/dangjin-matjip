import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { show } from '../data'
import { cachedCoords, DANGJIN_CENTER, geocodable, geocode, KAKAO_KEY, loadKakao, triedGeocode } from '../kakao'

const coordsOf = (r) => (r.lat && r.lng ? { lat: r.lat, lng: r.lng } : cachedCoords(r.address))

export default function MapView({ list, search }) {
  const box = useRef(null)
  const map = useRef(null)
  const clusterer = useRef(null)
  const [kakao, setKakao] = useState(null)
  const [error, setError] = useState(KAKAO_KEY ? null : 'NO_KEY')
  const [selected, setSelected] = useState(null)
  const [pending, setPending] = useState(0)
  const [, rerender] = useState(0)

  useEffect(() => {
    if (!KAKAO_KEY) return
    loadKakao().then((k) => {
      map.current = new k.maps.Map(box.current, {
        center: new k.maps.LatLng(DANGJIN_CENTER.lat, DANGJIN_CENTER.lng),
        level: 9,
      })
      map.current.addControl(new k.maps.ZoomControl(), k.maps.ControlPosition.RIGHT)
      clusterer.current = new k.maps.MarkerClusterer({ map: map.current, averageCenter: true, minLevel: 6 })
      setKakao(k)
    }).catch((e) => setError(e.message))
  }, [])

  // 좌표가 없는 가게는 주소로 하나씩 찾아 지도에 추가한다
  useEffect(() => {
    if (!kakao) return
    let cancelled = false
    const todo = list.filter((r) => !coordsOf(r) && geocodable(r.address) && !triedGeocode(r.address))
    setPending(todo.length)
    ;(async () => {
      for (let i = 0; i < todo.length && !cancelled; i++) {
        await geocode(kakao, todo[i].address)
        setPending(todo.length - i - 1)
        if (i % 10 === 9) rerender((n) => n + 1)
      }
      if (!cancelled) rerender((n) => n + 1)
    })()
    return () => { cancelled = true }
  }, [kakao, list])

  const located = list.filter((r) => coordsOf(r))

  useEffect(() => {
    if (!kakao) return
    clusterer.current.clear()
    const markers = located.map((r) => {
      const c = coordsOf(r)
      const m = new kakao.maps.Marker({ position: new kakao.maps.LatLng(c.lat, c.lng), title: r.name ?? '' })
      kakao.maps.event.addListener(m, 'click', () => setSelected(r))
      return m
    })
    clusterer.current.addMarkers(markers)
    if (markers.length) {
      const bounds = new kakao.maps.LatLngBounds()
      markers.forEach((m) => bounds.extend(m.getPosition()))
      map.current.setBounds(bounds)
    }
  }, [kakao, located.length, list])

  const myLocation = () => {
    navigator.geolocation?.getCurrentPosition((p) => {
      const pos = new kakao.maps.LatLng(p.coords.latitude, p.coords.longitude)
      map.current.setCenter(pos)
      map.current.setLevel(5)
    })
  }

  if (error) {
    return (
      <div className="map-setup">
        {error === 'NO_KEY' ? (
          <>
            <p><b>지도를 보려면 카카오맵 키가 필요해요.</b></p>
            <ol>
              <li>developers.kakao.com 에서 애플리케이션을 만들고 <b>JavaScript 키</b>를 복사합니다.</li>
              <li>앱 설정 → 플랫폼 → Web 에 이 사이트 주소(예: http://localhost:5173, 배포 주소)를 등록합니다.</li>
              <li>프로젝트 폴더의 <code>.env</code> 파일에 <code>VITE_KAKAO_JS_KEY=복사한키</code> 를 넣고 다시 실행합니다.</li>
            </ol>
          </>
        ) : (
          <p>카카오 지도를 불러오지 못했어요. 키와 등록한 사이트 주소를 확인해 주세요.</p>
        )}
      </div>
    )
  }

  const missing = list.length - located.length
  return (
    <div className="map-wrap">
      <div ref={box} className="map" role="application" aria-label="식당 지도" />
      {kakao && (
        <button type="button" className="my-loc" onClick={myLocation}>내 위치</button>
      )}
      <p className="muted small map-note">
        지도에 {located.length}곳 표시
        {pending > 0 ? ` · 주소로 위치 찾는 중 ${pending}곳` : missing > 0 ? ` · 위치를 모르는 ${missing}곳은 목록에서 보세요` : ''}
      </p>
      {selected && (
        <div className="map-sheet">
          <button type="button" className="close" aria-label="닫기" onClick={() => setSelected(null)}>✕</button>
          <h3>{selected.name ?? '상호 확인 중'}</h3>
          <p className="meta"><span className="pill">{selected.cuisine}</span><span>{show(selected.region ?? selected.area)}</span></p>
          <p className="intro">{selected.intro}</p>
          <Link className="btn primary" to={`/r/${selected.id}${search}`}>자세히 보기</Link>
        </div>
      )}
    </div>
  )
}
