import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { subCategoryById } from '../../core/categories/subCategories';
import type { LayoutMode } from '../../core/device/layoutMode';
import { getCurrentPoint, kakaoWalkingDirectionsUrl, locationErrorMessage } from '../../core/navigation/kakaoDirections';
import { findKakaoPlace, type KakaoPlace } from '../../core/source/kakaoPlace';
import { fetchStoreDetail, groupMenus, type StoreDetail } from '../../core/source/storeDetail';
import type { GeoPoint } from '../../core/types/place';
import { groupBusinessHours } from '../../core/utils/hours';
import { STORE_SECTIONS } from '../../features/storeSections';
import Icon from '../../shared/Icon';
import { useToast } from '../../shared/toast/ToastContext';
import type { SecondaryFocus } from '../AppShell/ShellContext';
import './SecondaryPanel.css';

/** 2차 탭에 보여줄 가게 요약. (카테고리 가게·지도 가게 모두 이 모양으로 바꿔서 넘긴다) */
export interface SecondaryPlace {
  /** DB stores.id. 이 id 로 가게에 딸린 정보를 더 읽어 온다 */
  id: string;
  /** 비어 있으면 DB 에서 읽은 이름을 쓴다 */
  name: string;
  /** 업종 (예: 한식 · 백반/한정식) */
  category: string;
  address: string;
  /** 지도에서 이미 아는 좌표. 없으면 상세 정보의 lat/lng를 사용한다. */
  location?: GeoPoint;
  /** 전화·층 같은 짧은 정보 */
  facts: { label: string; value: string }[];
}

interface SecondaryPanelProps {
  place: SecondaryPlace | null;
  layout: LayoutMode;
  onClose: () => void;
  /** 처음 보여줄 카테고리(항목). 새 객체가 올 때마다 다시 스크롤한다 */
  focus: SecondaryFocus | null;
}

type DetailState = { id: string; detail: StoreDetail | null } | null;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
/** 스크롤할 곳이 늦게 그려질 수 있어서(각 묶음이 따로 불러온다) 이 시간 동안 찾고, 찾은 뒤에도 잠깐 위치를 맞춘다 */
const FOCUS_WAIT_MS = 4000;
const FOCUS_SETTLE_MS = 1200;

/** 가게 화면의 기본 목록 탭. 그 뒤에 가게에 등록된 카테고리(공간대여·원데이클래스·마감세일·제휴 혜택)가 탭으로 붙는다 */
const BASE_TABS = [
  { id: 'home', label: '홈' },
  { id: 'menu', label: '가격' },
  { id: 'photos', label: '사진' },
] as const;
/** 세로 화면 시트: 반쯤 열린 높이 (지도 영역 대비) / 이보다 낮게 끌어 내리면 닫는다 (반 높이 대비) / 빠르게 튕긴 것으로 보는 속도 (px/ms) */
const SHEET_HALF = 0.55;
const SHEET_CLOSE_RATIO = 0.55;
const SHEET_FLING = 0.6;
/** 위쪽 사진 줄에 보여 줄 최대 장수 (나머지는 사진 탭에서) */
const STRIP_PHOTOS = 6;

/**
 * 2차 탭 = 가게 화면. 1차 탭이나 지도에서 가게를 고르면 열린다.
 * - PC·태블릿 가로, 모바일 가로: 지도 내 좌측 / 모바일·태블릿 세로: 지도 내 하단
 *
 * 구성: 사진 줄 · 이름 · 업종 · 주소
 *       목록 탭 [홈 | 가격 | 사진 | (등록된 카테고리들 — features/storeSections.tsx 순서)]
 *       - 홈: 단골(스탬프) 혜택 · 전화 등 · 영업시간 · 이 가게 소식 바로가기
 *       - 가격: 메뉴 / 사진: 가게·글 사진 / 카테고리 탭: 1차 탭에서 항목을 누르면 보던 상세 화면
 * 사장님이 원데이클래스·마감세일 등을 등록하면 그 카테고리 탭이 생긴다.
 * 1차 탭에서 열면(focus) 그 카테고리 탭을 열고, 누른 항목이 탭 줄 바로 아래에 오도록 스크롤한다.
 */
const SecondaryPanel = forwardRef<HTMLElement, SecondaryPanelProps>(function SecondaryPanel({ place, layout, onClose, focus }, ref) {
  const id = place?.id ?? null;
  const [loaded, setLoaded] = useState<DetailState>(null);
  const [tab, setTab] = useState<string>('home');
  /** 사장님이 정보를 등록하지 않은 가게: 카카오맵에서 찾은 결과 (place 가 null 이면 못 찾음, 이 가게 결과가 아직 없으면 찾는 중) */
  const [kakao, setKakao] = useState<{ id: string; place: KakaoPlace | null } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabIdBase = useId();
  /** 세로 화면 시트: 지도 영역 전체까지 올렸는지 / 끄는 중인 높이(px) */
  const [sheetFull, setSheetFull] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);
  const showToast = useToast();
  const dragStart = useRef<{ y: number; height: number; time: number; moved: boolean } | null>(null);
  const portrait = layout === 'portrait';

  // 다른 가게를 열면 시트는 반 높이부터
  useEffect(() => { setSheetFull(false); setDragHeight(null); setRouting(false); }, [id]);

  /** 시트가 올라올 수 있는 최대 높이 = 지도 영역 높이 - 위쪽 여백 */
  const stageHeight = () => panelRef.current?.parentElement?.clientHeight ?? window.innerHeight;
  const maxSheet = () => stageHeight() - 8;

  // 세로 화면: 위쪽 손잡이 줄을 위아래로 끌어 크기를 바꾼다. 놓으면 반 / 전체로 붙고, 많이 내리면 닫힌다. 손잡이를 누르면 반 <-> 전체
  function onSheetPointerDown(event: PointerEvent<HTMLDivElement>) {
    // 닫기(✕) 버튼은 끌기에서 뺀다. 손잡이(.sd-grip)는 끌기·누르기 모두 여기서 처리한다
    if (!portrait || (event.target as HTMLElement).closest('button:not(.sd-grip)')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragStart.current = { y: event.clientY, height: panelRef.current?.offsetHeight ?? 0, time: performance.now(), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onSheetPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.abs(dy) < 5) return;
    start.moved = true;
    setDragHeight(Math.min(maxSheet(), Math.max(60, start.height - dy)));
  }
  function onSheetPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    if (!start.moved) { setSheetFull((full) => !full); return; }
    const dy = event.clientY - start.y;
    const speed = dy / Math.max(1, performance.now() - start.time);
    const height = Math.min(maxSheet(), Math.max(60, start.height - dy));
    const half = stageHeight() * SHEET_HALF;
    setDragHeight(null);
    if (speed > SHEET_FLING) { if (sheetFull) setSheetFull(false); else onClose(); return; }
    if (speed < -SHEET_FLING) { setSheetFull(true); return; }
    if (height < half * SHEET_CLOSE_RATIO) { onClose(); return; }
    setSheetFull(height > (half + maxSheet()) / 2);
  }
  // 손잡이 키보드: Enter·Space 는 반 <-> 전체, 위·아래 화살표는 전체 / 반
  function onSheetKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSheetFull((full) => !full); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSheetFull(true); }
    if (event.key === 'ArrowDown') { event.preventDefault(); setSheetFull(false); }
  }
  useImperativeHandle(ref, () => panelRef.current as HTMLElement, [place]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchStoreDetail(id).then((detail) => { if (!cancelled) setLoaded({ id, detail }); });
    return () => { cancelled = true; };
  }, [id]);

  // 사장님이 등록한 정보(영업시간·스탬프·글)가 하나도 없으면 카카오맵에서 같은 가게를 찾아 홈을 채운다
  const loadedDetail = loaded?.id === id ? loaded.detail : null;
  const ownerEmpty = !!loadedDetail && !loadedDetail.hours.length && !loadedDetail.stamp
    && !STORE_SECTIONS.some((section) => section.count(loadedDetail) > 0);
  useEffect(() => {
    if (!loadedDetail || !ownerEmpty) return;
    let cancelled = false;
    void findKakaoPlace(loadedDetail).then((place) => { if (!cancelled) setKakao({ id: loadedDetail.id, place }); });
    return () => { cancelled = true; };
  }, [loadedDetail, ownerEmpty]);

  // 다른 가게를 열거나 1차 탭에서 열면: 그 카테고리 탭(없으면 홈)부터
  useEffect(() => { setTab(focus?.category ?? 'home'); }, [focus, id]);

  // 1차 탭에서 연 경우: 그 항목(없으면 카테고리 탭 첫머리)이 탭 줄 바로 아래에 오게. 사용자가 직접 스크롤하면 멈춘다
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!focus) { panel.scrollTop = 0; return; }
    // 위에 붙어 있는 닫기 줄 + 탭 줄 아래 = 보이는 내용의 시작
    const contentTop = () => (headRef.current?.getBoundingClientRect().bottom ?? panel.getBoundingClientRect().top) + (tabsRef.current?.offsetHeight ?? 0) + 8;
    let foundAt = 0;
    let stopped = false;
    const started = Date.now();
    const stop = () => { stopped = true; };
    panel.addEventListener('wheel', stop, { passive: true });
    panel.addEventListener('touchstart', stop, { passive: true });
    const timer = window.setInterval(() => {
      const section = panel.querySelector<HTMLElement>(`[data-sd-target="cat-${focus.category}"]`);
      const item = focus.target ? panel.querySelector<HTMLElement>(`[data-sd-target="${focus.target}"]`) : null;
      // 고른 항목이 묶음의 첫 항목이면 묶음 제목부터 보이게, 아래쪽 항목이면 그 항목을 맨 위로
      const target = item && section && item.getBoundingClientRect().top - section.getBoundingClientRect().top > 80 ? item : section ?? item;
      if (target && !stopped) {
        foundAt ||= Date.now();
        panel.scrollTop += target.getBoundingClientRect().top - contentTop();
      }
      if (stopped || (foundAt && Date.now() - foundAt > FOCUS_SETTLE_MS) || Date.now() - started > FOCUS_WAIT_MS) window.clearInterval(timer);
    }, 120);
    return () => {
      window.clearInterval(timer);
      panel.removeEventListener('wheel', stop);
      panel.removeEventListener('touchstart', stop);
    };
  }, [focus, id]);

  if (!place) return null;
  // 다른 가게로 바뀐 직후에는 이전 가게 정보를 보여주지 않는다
  const current = loaded?.id === place.id ? loaded : null;
  const detail = current?.detail ?? null;
  const name = place.name || detail?.name || '가게';
  const address = place.address || detail?.address || '';
  const destination = place.location ?? (detail?.lat !== null && detail?.lat !== undefined && detail.lng !== null && detail.lng !== undefined
    ? { lat: detail.lat, lng: detail.lng }
    : null);
  const hours = detail ? groupBusinessHours(detail.hours) : [];
  const sections = detail ? STORE_SECTIONS.filter((section) => section.count(detail) > 0) : [];
  const photos = detail?.photos ?? [];
  const tabs = [...BASE_TABS, ...sections.map((section) => ({ id: section.id, label: section.label }))];
  // 가게 정보를 읽기 전이거나 그 카테고리 글이 없으면 홈
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'home';
  const activeSection = sections.find((section) => section.id === activeTab);
  const tabId = (id: string) => `${tabIdBase}-tab-${id}`;
  const panelId = `${tabIdBase}-panel`;

  function chooseTab(next: string) {
    setTab(next);
    // 탭을 바꾸면 내용 첫머리부터 (탭 줄이 위에 붙은 상태면 그 바로 아래로)
    const panel = panelRef.current;
    const tabsEl = tabsRef.current;
    if (panel && tabsEl && headRef.current) {
      const stuck = tabsEl.getBoundingClientRect().top <= headRef.current.getBoundingClientRect().bottom + 1;
      if (stuck) panel.scrollTop = tabsEl.offsetTop - headRef.current.offsetHeight;
    }
  }

  // 탭 줄: 좌우 화살표 키로 옮겨 다닌다
  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = tabs.findIndex((t) => t.id === activeTab);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    chooseTab(next.id);
    document.getElementById(tabId(next.id))?.focus();
  }

  async function openDirections() {
    if (routing) return;
    if (!destination) {
      showToast('이 가게의 위치 좌표가 없어 길찾기를 시작할 수 없어요.');
      return;
    }

    // 클릭 순간 탭을 열어 두어, GPS 확인 뒤 브라우저가 새 창을 차단하지 않게 한다.
    const routeWindow = window.open('', '_blank');
    if (routeWindow) {
      routeWindow.opener = null;
      routeWindow.document.title = '길찾기 준비 중';
      routeWindow.document.body.textContent = '현재 위치를 확인하고 있어요…';
    }

    setRouting(true);
    try {
      const current = await getCurrentPoint();
      const url = kakaoWalkingDirectionsUrl(current, destination, name);
      if (routeWindow) routeWindow.location.replace(url);
      else window.location.assign(url);
    } catch (error) {
      routeWindow?.close();
      showToast(locationErrorMessage(error));
    } finally {
      setRouting(false);
    }
  }

  return (
    <aside
      ref={panelRef}
      className="secondary-panel"
      data-layout={layout}
      data-dragging={dragHeight !== null || undefined}
      aria-label={`${name} 정보`}
      style={portrait ? { height: dragHeight ?? (sheetFull ? `calc(100% - 8px)` : `${SHEET_HALF * 100}%`) } : undefined}
    >
      <div
        ref={headRef}
        className="secondary-panel__head"
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={onSheetPointerUp}
        onPointerCancel={() => { dragStart.current = null; setDragHeight(null); }}
      >
        {portrait && (
          <button type="button" className="sd-grip" aria-label={sheetFull ? '가게 정보 줄이기' : '가게 정보 크게 보기'} aria-expanded={sheetFull} onKeyDown={onSheetKey}>
            <span aria-hidden="true" />
          </button>
        )}
        {detail?.isMock ? <span className="secondary-panel__badge is-mock">예시 가게</span> : <span />}
        <button type="button" className="secondary-panel__close" aria-label="가게 정보 닫기" title="닫기" onClick={onClose}>✕</button>
      </div>

      {/* 가게 요약 */}
      {photos.length > 0 && (
        <div className="sd-strip" aria-label="가게 사진 미리보기">
          {photos.slice(0, STRIP_PHOTOS).map((photo, i) => (
            <img key={photo.url} src={photo.url} alt={photo.caption ? `${photo.caption} 사진` : `${name} 사진 ${i + 1}`} loading="lazy" />
          ))}
        </div>
      )}
      <h2 className="secondary-panel__name">{name}</h2>
      {place.category && <p className="secondary-panel__category">{place.category}</p>}
      <p className="secondary-panel__meta">
        <Icon name="pin" /> {address || '주소 정보 없음'}
      </p>
      <button type="button" className="sd-directions" disabled={routing || !destination} onClick={() => void openDirections()}>
        <Icon name="compass" />
        <span>{routing ? '현재 위치 확인 중…' : '현 위치에서 길찾기'}</span>
      </button>

      {/* 목록 탭 */}
      <div ref={tabsRef} className="sd-tabs" role="tablist" aria-label={`${name} 정보 목록`} onKeyDown={onTabKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={t.id === activeTab}
            aria-controls={panelId}
            tabIndex={t.id === activeTab ? 0 : -1}
            onClick={() => chooseTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={panelId} className="sd-tabpanel" role="tabpanel" aria-labelledby={tabId(activeTab)}>
        {!current && <p className="sd-empty" aria-live="polite">가게 정보를 불러오는 중…</p>}
        {current && !detail && <p className="sd-empty">가게 정보를 불러오지 못했어요.</p>}

        {/* 홈 */}
        {detail && activeTab === 'home' && <>
          {detail.stamp && (
            <p className="sd-perk">
              <strong>단골 혜택</strong>
              <span>스탬프 {detail.stamp.requiredStamps}개 모으면 {detail.stamp.reward}</span>
            </p>
          )}
          {place.facts.length > 0 && (
            <dl className="secondary-panel__facts">
              {place.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
            </dl>
          )}
          {hours.length > 0 && (
            <section className="sd-section" aria-label="영업시간">
              <h3>영업시간</h3>
              <dl className="sd-hours">
                {hours.map((h) => <div key={h.label} className={h.text === '휴무' ? 'is-closed' : undefined}><dt>{h.label}</dt><dd>{h.text}</dd></div>)}
              </dl>
            </section>
          )}
          {sections.length > 0 && (
            <section className="sd-section" aria-label="이 가게 소식">
              <h3>이 가게 소식</h3>
              <ul className="sd-shortcuts">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button type="button" onClick={() => chooseTab(section.id)}>
                      <span className="sd-shortcut-label">{section.label}</span>
                      <b>{section.count(detail)}개</b>
                      <Icon name="chevronRight" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {ownerEmpty && (() => {
            const found = kakao?.id === place.id ? kakao.place : undefined;
            if (found === undefined) return <p className="sd-empty" aria-live="polite">카카오맵에서 가게 정보를 찾는 중…</p>;
            if (!found) return !place.facts.length ? <p className="sd-empty">아직 사장님이 등록한 정보가 없어요.</p> : null;
            return (
              <section className="sd-section sd-kakao" aria-label="카카오맵 정보">
                <h3>카카오맵 정보</h3>
                <dl className="secondary-panel__facts">
                  {found.phone && <div><dt>전화</dt><dd><a href={`tel:${found.phone}`}>{found.phone}</a></dd></div>}
                  {found.category && <div><dt>업종</dt><dd>{found.category.split(' > ').slice(1).join(' · ') || found.category}</dd></div>}
                  {(found.roadAddress || found.address) && <div><dt>주소</dt><dd>{found.roadAddress || found.address}</dd></div>}
                </dl>
                <a className="sd-kakao-link" href={found.url} target="_blank" rel="noreferrer">카카오맵에서 영업시간·후기 보기 <Icon name="chevronRight" /></a>
                <p className="sd-source">사장님이 아직 정보를 등록하지 않아 카카오맵의 정보를 보여 드려요. 실제와 다를 수 있어요.</p>
              </section>
            );
          })()}
        </>}

        {/* 가격 */}
        {detail && activeTab === 'menu' && (detail.menus.length > 0 ? (
          <section className="sd-section" aria-label="메뉴">
            <h3>메뉴 <span>{detail.menus.length}</span></h3>
            {groupMenus(detail.menus).map((group) => (
              <div key={group.label} className="sd-menu-group">
                {group.label && <h4>{group.label}</h4>}
                <ul className="sd-list">
                  {group.items.map((m) => (
                    <li key={m.id} className="sd-row">
                      <span>
                        {m.name}{m.typeId && <small>{subCategoryById(m.typeId)?.label}</small>}
                        {m.description && <em className="sd-row-desc">{m.description}</em>}
                      </span>
                      <b>{won(m.price)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : <p className="sd-empty">아직 등록된 메뉴·가격이 없어요.</p>)}

        {/* 사진 */}
        {detail && activeTab === 'photos' && (photos.length > 0 ? (
          <ul className="sd-photos">
            {photos.map((photo, i) => (
              <li key={photo.url}>
                <a href={photo.url} target="_blank" rel="noreferrer">
                  <img src={photo.url} alt={photo.caption ? `${photo.caption} 사진` : `${name} 사진 ${i + 1}`} loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="sd-empty">아직 등록된 사진이 없어요.</p>)}

        {/* 등록된 카테고리 (1차 탭의 상세 화면) */}
        {activeSection && (
          <section className="sd-cat" data-sd-target={`cat-${activeSection.id}`} aria-label={activeSection.label}>
            <div className="sd-cat-body">{activeSection.render(place.id)}</div>
          </section>
        )}
      </div>
    </aside>
  );
});

export default SecondaryPanel;
