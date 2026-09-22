import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStoresByMenu } from './menuStoreSource';
import {
  MENUS,
  MENU_PRESETS,
  WHEEL_COLORS,
  menusForPreset,
  type MenuStore,
  type WheelMenu,
} from './rouletteData';
import './roulette.css';

const SPIN_MS = 4200;
const STORAGE_KEY = 'wol-roulette-menus';

function loadMenus(): WheelMenu[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return menusForPreset('all');
    const saved = JSON.parse(raw) as WheelMenu[];
    return Array.isArray(saved) ? saved : menusForPreset('all');
  } catch {
    return menusForPreset('all');
  }
}

function saveMenus(menus: WheelMenu[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
  } catch {
    /* 저장 실패해도 이번 세션 동작에는 지장 없음 */
  }
}

/** 룰렛 칸 이름을 원판 위 제자리에 놓기 위한 위치(%) */
function labelPosition(index: number, count: number) {
  const midAngle = (((index + 0.5) * 360) / count) * (Math.PI / 180);
  const radius = 35;
  return {
    left: `${50 + radius * Math.sin(midAngle)}%`,
    top: `${50 - radius * Math.cos(midAngle)}%`,
  };
}

/** 칸이 많아지면 이름이 서로 겹치지 않게 글자를 줄인다 */
function labelFontSize(count: number) {
  if (count > 14) return '0.62rem';
  if (count > 10) return '0.72rem';
  return '0.82rem';
}

/** "쌀국수를 / 국밥을" 처럼 받침에 맞는 목적격 조사 */
function objectParticle(word: string) {
  const last = word.charCodeAt(word.length - 1);
  const hasFinalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return hasFinalConsonant ? '을' : '를';
}

/** 직접 추가한 메뉴에는 아직 안 쓴 색을 먼저 준다 */
function nextColor(current: WheelMenu[]) {
  const used = new Set(current.map((m) => m.color));
  return (
    WHEEL_COLORS.find((color) => !used.has(color)) ??
    WHEEL_COLORS[current.length % WHEEL_COLORS.length]
  );
}

function menuSetKey(menus: WheelMenu[]) {
  return menus
    .map((m) => m.id)
    .sort()
    .join('|');
}

export default function RoulettePage() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<WheelMenu[]>(loadMenus);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelMenu | null>(null);
  const [stores, setStores] = useState<MenuStore[] | null>(null);

  const isEmpty = menus.length === 0;
  const segmentAngle = isEmpty ? 360 : 360 / menus.length;
  const wheelBackground = useMemo(
    () =>
      menus.length === 0
        ? 'var(--color-surface-alt, #f3ece3)'
        : `conic-gradient(${menus
            .map((m, i) => `${m.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
            .join(', ')})`,
    [menus, segmentAngle],
  );

  const activePreset = useMemo(() => {
    const current = menuSetKey(menus);
    return MENU_PRESETS.find((p) => menuSetKey(menusForPreset(p.key)) === current)?.key ?? null;
  }, [menus]);

  const addableMenus = MENUS.filter((m) => !menus.some((picked) => picked.id === m.id));

  useEffect(() => {
    if (!result) {
      setStores(null);
      return;
    }

    let cancelled = false;
    setStores(null);
    fetchStoresByMenu(result.name).then((list) => {
      if (!cancelled) setStores(list);
    });

    return () => {
      cancelled = true;
    };
  }, [result]);

  function applyMenus(next: WheelMenu[]) {
    setMenus(next);
    saveMenus(next);
    setResult(null);
  }

  function handleAddCustom(event: FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    setDraft('');
    if (!name || menus.some((m) => m.name === name)) return;

    const preset = MENUS.find((m) => m.name === name);
    applyMenus([
      ...menus,
      preset ?? { id: `custom-${name}`, name, emoji: '🍽️', color: nextColor(menus) },
    ]);
  }

  function handleSpin() {
    if (spinning || isEmpty) return;

    const idx = Math.floor(Math.random() * menus.length);
    const within = segmentAngle * 0.15 + Math.random() * segmentAngle * 0.7;
    const targetFromTop = idx * segmentAngle + within;
    const desiredMod = (360 - targetFromTop + 360) % 360;
    const extraSpins = 360 * (5 + Math.floor(Math.random() * 2));
    const delta = (((desiredMod - (rotation % 360)) % 360) + 360) % 360;

    setSpinning(true);
    setResult(null);
    setRotation(rotation + extraSpins + delta);

    window.setTimeout(() => {
      setSpinning(false);
      setResult(menus[idx]);
    }, SPIN_MS);
  }

  return (
    <div className="rl-page">
      <header className="rl-hero">
        <div>
          <p className="rl-eyebrow">오늘의 점심 메이트</p>
          <h1 className="rl-heading">
            고민은 줄이고, <em>맛있는 한 끼</em>를 고르세요.
          </h1>
        </div>
        <div className="rl-filters">
          {MENU_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`rl-chip${activePreset === preset.key ? ' is-on' : ''}`}
              aria-pressed={activePreset === preset.key}
              onClick={() => !spinning && applyMenus(menusForPreset(preset.key))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      <section className="rl-card">
        <div className="rl-intro">
          <span className="rl-badge">✦ 30초면 결정 끝</span>
          <h2 className="rl-card-title">오늘 뭐 먹지?</h2>
          <p className="rl-card-desc">
            룰렛에 올릴 메뉴는 직접 고를 수 있어요. 돌리고 나면 그 메뉴를 파는 동네 가게를 함께
            추천해 드려요.
          </p>

          <div className="rl-editor">
            <div className="rl-editor-head">
              <span className="rl-editor-count">내 룰렛 {menus.length}칸</span>
              <button type="button" className="rl-editor-toggle" onClick={() => setEditing((v) => !v)}>
                {editing ? '편집 닫기' : '메뉴 편집'}
              </button>
            </div>

            {editing && (
              <div className="rl-editor-body">
                <p className="rl-editor-label">룰렛에 올린 메뉴</p>
                {isEmpty ? (
                  <p className="rl-editor-none">아직 올린 메뉴가 없어요.</p>
                ) : (
                  <ul className="rl-menu-chips">
                    {menus.map((menu) => (
                      <li key={menu.id}>
                        <span className="rl-menu-chip">
                          <i className="rl-menu-dot" style={{ background: menu.color }} />
                          {menu.name}
                          <button
                            type="button"
                            className="rl-menu-remove"
                            aria-label={`${menu.name} 빼기`}
                            onClick={() => applyMenus(menus.filter((m) => m.id !== menu.id))}
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {addableMenus.length > 0 && (
                  <>
                    <p className="rl-editor-label">추천 메뉴 더하기</p>
                    <ul className="rl-menu-chips">
                      {addableMenus.map((menu) => (
                        <li key={menu.id}>
                          <button
                            type="button"
                            className="rl-add-chip"
                            onClick={() => applyMenus([...menus, menu])}
                          >
                            + {menu.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <form className="rl-add-form" onSubmit={handleAddCustom}>
                  <input
                    className="rl-add-input"
                    value={draft}
                    maxLength={6}
                    placeholder="직접 입력 (예: 초밥)"
                    aria-label="룰렛에 추가할 메뉴"
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit" className="rl-add-submit" disabled={!draft.trim()}>
                    추가
                  </button>
                </form>

                <button
                  type="button"
                  className="rl-editor-reset"
                  disabled={isEmpty}
                  onClick={() => applyMenus([])}
                >
                  룰렛 초기화
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rl-wheel-zone">
          <div className="rl-wheel-frame">
            <span className="rl-pointer" aria-hidden="true" />
            <div
              className={`rl-wheel${isEmpty ? ' is-empty' : ''}`}
              style={{ transform: `rotate(${rotation}deg)`, background: wheelBackground }}
            >
              {menus.map((menu, i) => (
                <span
                  key={menu.id}
                  className="rl-wheel-label"
                  style={{
                    ...labelPosition(i, menus.length),
                    fontSize: labelFontSize(menus.length),
                    // 원판이 돌아도 글자는 똑바로 서 있도록 같은 각도만큼 되돌린다
                    transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                  }}
                >
                  {menu.name}
                </span>
              ))}
            </div>

            {isEmpty ? (
              <p className="rl-wheel-empty">
                메뉴가 없어요
                <span>메뉴 편집에서 추가해 주세요</span>
              </p>
            ) : (
              <button type="button" className="rl-spin" onClick={handleSpin} disabled={spinning}>
                SPIN
              </button>
            )}

            {result && (
              <div className="rl-result-pop">
                <span className="rl-result-emoji">{result.emoji}</span>
                <p className="rl-result-label">오늘의 추천 메뉴</p>
                <p className="rl-result-headline">
                  {result.headline ?? `오늘은 ${result.name} 어때요?`}
                </p>
                <button type="button" className="rl-respin" onClick={handleSpin} disabled={spinning}>
                  다시 돌리기
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {result && (
        <section className="rl-stores">
          <div className="rl-stores-head">
            <div>
              <h2 className="rl-stores-title">
                {result.name}
                {objectParticle(result.name)} 파는 가까운 가게
              </h2>
              <p className="rl-stores-sub">선택한 메뉴와 비슷한 메뉴를 즐길 수 있는 곳이에요.</p>
            </div>
            <button type="button" className="rl-map-link" onClick={() => navigate('/recommend')}>
              지도에서 보기 →
            </button>
          </div>

          {stores === null && <p className="rl-stores-empty">가게를 찾는 중이에요…</p>}

          {stores !== null && stores.length === 0 && (
            <p className="rl-stores-empty">
              아직 <b>{result.name}</b> 가게 정보가 없어요. 동네 가게 정보가 연결되면 여기에
              보여드릴게요.
            </p>
          )}

          {stores !== null && stores.length > 0 && (
            <ul className="rl-store-grid">
              {stores.map((store) => (
                <li key={store.id} className="rl-store-card">
                  <div
                    className="rl-store-thumb"
                    style={{
                      background: `linear-gradient(160deg, ${result.color} 0%, ${result.color}55 100%)`,
                    }}
                  >
                    {store.emoji}
                  </div>
                  <div className="rl-store-body">
                    <span className="rl-store-tag">{store.tagLabel}</span>
                    <h3 className="rl-store-name">{store.name}</h3>
                    <p className="rl-store-desc">{store.desc}</p>
                    <div className="rl-store-foot">
                      <span className="rl-store-rating">★ {store.rating}</span>
                      <span className="rl-store-meta">리뷰 {store.reviews}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="rl-tip">
        <b>💡 친구와 함께라면?</b> 룰렛을 한 번 더 돌려 메뉴 후보를 2개로 좁혀보세요.
      </p>
    </div>
  );
}
