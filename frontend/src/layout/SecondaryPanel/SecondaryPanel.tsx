import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { subCategoryById } from '../../core/categories/subCategories';
import type { LayoutMode } from '../../core/device/layoutMode';
import { fetchStoreDetail, groupMenus, type StoreDetail } from '../../core/source/storeDetail';
import { groupBusinessHours } from '../../core/utils/hours';
import { STORE_SECTIONS } from '../../features/storeSections';
import Icon from '../../shared/Icon';
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
  /** 전화·층 같은 짧은 정보 */
  facts: { label: string; value: string }[];
}

interface SecondaryPanelProps {
  place: SecondaryPlace | null;
  layout: LayoutMode;
  onClose: () => void;
  /** 처음 보여줄 카테고리(항목). seq 가 바뀔 때마다 다시 스크롤한다 */
  focus: (SecondaryFocus & { seq: number }) | null;
}

type DetailState = { id: string; detail: StoreDetail | null } | null;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
/** 스크롤할 곳이 늦게 그려질 수 있어서(각 묶음이 따로 불러온다) 이 시간 동안 찾고, 찾은 뒤에도 잠깐 위치를 맞춘다 */
const FOCUS_WAIT_MS = 4000;
const FOCUS_SETTLE_MS = 1200;

/**
 * 2차 탭 = 가게 화면. 1차 탭이나 지도에서 가게를 고르면 열린다.
 * - PC·태블릿 가로, 모바일 가로: 지도 내 좌측 / 모바일·태블릿 세로: 지도 내 하단
 *
 * 순서: ① 가게 정보 (이름·업종·주소·전화·영업시간·메뉴)
 *       ② 카테고리 묶음 — 1차 탭에서 항목을 누르면 보던 상세 화면들 (features/storeSections.tsx 순서)
 * 1차 탭에서 열면(focus) 그 카테고리(항목)가 맨 위에 오도록 스크롤한다. 내용이 길면 이 탭 안에서 스크롤된다.
 */
const SecondaryPanel = forwardRef<HTMLElement, SecondaryPanelProps>(function SecondaryPanel({ place, layout, onClose, focus }, ref) {
  const id = place?.id ?? null;
  const [loaded, setLoaded] = useState<DetailState>(null);
  const panelRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => panelRef.current as HTMLElement, [place]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchStoreDetail(id).then((detail) => { if (!cancelled) setLoaded({ id, detail }); });
    return () => { cancelled = true; };
  }, [id]);

  // 1차 탭에서 연 경우: 그 항목(없으면 카테고리 묶음)을 탭 맨 위로. 사용자가 직접 스크롤하면 멈춘다
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!focus) { panel.scrollTop = 0; return; }
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
        panel.scrollTop += target.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8;
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
  const hours = detail ? groupBusinessHours(detail.hours) : [];
  const sections = detail ? STORE_SECTIONS.filter((section) => section.has(detail)) : [];
  // 제휴 혜택 묶음에 단과대 할인과 함께 메뉴가 나오므로, 그때는 가게 정보의 메뉴를 겹쳐 보여주지 않는다
  const showMenus = !!detail?.menus.length && !sections.some((section) => section.id === 'partner-stores');

  return (
    <aside ref={panelRef} className="secondary-panel" data-layout={layout} aria-label={`${name} 정보`}>
      <div className="secondary-panel__head">
        {detail?.isMock ? <span className="secondary-panel__badge is-mock">예시 가게</span> : <span />}
        <button type="button" className="secondary-panel__close" aria-label="가게 정보 닫기" onClick={onClose}>✕</button>
      </div>

      {/* ① 가게 정보 */}
      {detail?.thumbnailUrl && <img className="secondary-panel__photo" src={detail.thumbnailUrl} alt={`${name} 대표 사진`} loading="lazy" />}
      <h2 className="secondary-panel__name">{name}</h2>
      {place.category && <p className="secondary-panel__category">{place.category}</p>}
      <p className="secondary-panel__meta">
        <Icon name="pin" /> {address || '주소 정보 없음'}
      </p>
      {place.facts.length > 0 && (
        <dl className="secondary-panel__facts">
          {place.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      )}
      {!current && <p className="sd-empty" aria-live="polite">가게 정보를 불러오는 중…</p>}
      {current && !detail && <p className="sd-empty">가게 정보를 불러오지 못했어요.</p>}
      {hours.length > 0 && (
        <section className="sd-section" aria-label="영업시간">
          <h3>영업시간</h3>
          <dl className="sd-hours">
            {hours.map((h) => <div key={h.label} className={h.text === '휴무' ? 'is-closed' : undefined}><dt>{h.label}</dt><dd>{h.text}</dd></div>)}
          </dl>
        </section>
      )}
      {showMenus && detail && (
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
      )}
      {detail && !hours.length && !detail.menus.length && !sections.length && <p className="sd-empty">아직 사장님이 등록한 정보가 없어요.</p>}

      {/* ② 카테고리 묶음 (1차 탭의 상세 화면) */}
      {sections.map((section) => (
        <section key={section.id} className="sd-cat" data-sd-target={`cat-${section.id}`} aria-label={section.label}>
          <h3 className="sd-cat-title">{section.label}</h3>
          <div className="sd-cat-body">{section.render(place.id)}</div>
        </section>
      ))}
    </aside>
  );
});

export default SecondaryPanel;
