import { useEffect, useMemo, useRef, useState } from 'react';
import { useShell } from '../../layout/AppShell/ShellContext';
import { CUISINES, DEFAULT_PRESET, MENUS, MENU_PRESETS, menusForPreset } from './constants';
import { fetchStoresByMenu } from './source';
import type { Cuisine, RouletteStoreView, WheelMenu } from './types';
import './roulette.css';

const SPIN_MS = 4200;
const STORAGE_KEY = 'wol-roulette-menus';

function loadMenus(): WheelMenu[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return menusForPreset(DEFAULT_PRESET);
    const saved = JSON.parse(raw) as WheelMenu[];
    // 저장해 둔 건 id 만 믿고 지금 기본 메뉴로 바꾼다 (가게 찾는 기준이 바뀌어도 따라가도록).
    // 파는 가게가 없어 목록에서 뺀 메뉴(예: 예전 쌀국수·마라탕)는 버린다
    return Array.isArray(saved)
      ? saved.flatMap((m) => MENUS.find((d) => d.id === m.id) ?? [])
      : menusForPreset(DEFAULT_PRESET);
  } catch {
    return menusForPreset(DEFAULT_PRESET);
  }
}

function saveMenus(menus: WheelMenu[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(menus.map(({ id, name }) => ({ id, name }))));
  } catch {
    /* 저장 실패해도 이번 세션 동작에는 지장 없음 */
  }
}

const WHEEL_COLOR_COUNT = 8;

/**
 * 원판 위 index 번째 칸 색 (theme.css 의 --wheel-N). 밝은 색이라 글자는 항상 짙은 색으로 올린다.
 * 자리로 정해야 어떤 메뉴를 골라도 옆 칸끼리 색이 겹치지 않는다. 마지막 칸이 첫 칸과 같은 색이 되면 다른 색으로 바꾼다.
 */
function wheelColor(index: number, count: number) {
  const n = count > 1 && index === count - 1 && index % WHEEL_COLOR_COUNT === 0 ? 3 : index % WHEEL_COLOR_COUNT;
  return `var(--wheel-${n + 1})`;
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

function menuSetKey(menus: WheelMenu[]) {
  return menus
    .map((m) => m.id)
    .sort()
    .join('|');
}

export default function RoulettePage() {
  const { openStore } = useShell();
  const [menus, setMenus] = useState<WheelMenu[]>(loadMenus);
  const [editing, setEditing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [stores, setStores] = useState<RouletteStoreView[] | null>(null);
  const [cuisine, setCuisine] = useState<Cuisine>(CUISINES[0].key);
  const wheelZoneRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const storesRef = useRef<HTMLElement>(null);

  const result = resultIndex === null ? null : menus[resultIndex] ?? null;
  const resultColor = resultIndex === null ? '' : wheelColor(resultIndex, menus.length);
  const isEmpty = menus.length === 0;
  const segmentAngle = isEmpty ? 360 : 360 / menus.length;
  const wheelBackground = useMemo(
    () =>
      menus.length === 0
        ? 'var(--color-surface-alt)'
        : `conic-gradient(${menus
            .map((_, i) => `${wheelColor(i, menus.length)} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
            .join(', ')})`,
    [menus, segmentAngle],
  );

  const activePreset = useMemo(() => {
    const current = menuSetKey(menus);
    return MENU_PRESETS.find((p) => menuSetKey(menusForPreset(p.key)) === current)?.key ?? null;
  }, [menus]);

  const addableMenus = MENUS.filter((m) => !menus.some((picked) => picked.id === m.id));
  const addableInCuisine = addableMenus.filter((m) => m.cuisine === cuisine);

  useEffect(() => {
    if (!result) {
      setStores(null);
      return;
    }

    let cancelled = false;
    setStores(null);
    fetchStoresByMenu(result).then((list) => {
      if (!cancelled) setStores(list);
    });

    return () => {
      cancelled = true;
    };
  }, [result]);

  // 편집기를 열면 원판 아래에 펼쳐진 편집 영역이 화면에 들어오도록 내려준다
  useEffect(() => {
    if (editing) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [editing]);

  function finishEditing() {
    setEditing(false);
    wheelZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyMenus(next: WheelMenu[]) {
    setMenus(next);
    saveMenus(next);
    setResultIndex(null);
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
    setResultIndex(null);
    setRotation(rotation + extraSpins + delta);

    window.setTimeout(() => {
      setSpinning(false);
      setResultIndex(idx);
    }, SPIN_MS);
  }

  return (
    <div className="rl-page">
      <section className="rl-card">
        <div className="rl-intro">
          <span className="rl-badge">✦ 30초면 결정 끝</span>
          <h2 className="rl-card-title">오늘 뭐 먹지?</h2>
          <p className="rl-card-desc">
            룰렛에 올릴 메뉴는 직접 고를 수 있어요.
            <br />그 메뉴를 파는 동네 가게를 추천해드려요.
          </p>
        </div>

        <div className="rl-wheel-zone" ref={wheelZoneRef}>
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
                    // PC에서는 CSS 변수로 원판 크기에 맞게 글자를 함께 키운다
                    fontSize: `calc(${labelFontSize(menus.length)} * var(--rl-label-scale, 1))`,
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
          </div>

          {/* 결과는 원판을 가리지 않도록 원판 아래에 띄운다 */}
          {result && (
            <div className="rl-result" role="status">
              <span className="rl-result-emoji">{result.emoji}</span>
              <div className="rl-result-text">
                <p className="rl-result-label">오늘의 추천 메뉴</p>
                <p className="rl-result-headline">
                  {result.headline ?? `오늘은 ${result.name} 어때요?`}
                </p>
              </div>
              <button
                type="button"
                className="rl-see-stores"
                onClick={() => storesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                추천 가게 보기
              </button>
            </div>
          )}
        </div>

        <div className="rl-editor" ref={editorRef}>
          <div className="rl-editor-head">
            <span className="rl-editor-count">내 룰렛 {menus.length}칸</span>
            <button
              type="button"
              className="rl-editor-toggle"
              onClick={() => (editing ? finishEditing() : setEditing(true))}
            >
              {editing ? '편집 닫기' : '메뉴 편집'}
            </button>
          </div>

          {editing && (
            <div className="rl-editor-body">
              <p className="rl-editor-label">메뉴 묶음으로 채우기</p>
              <div className="rl-filters">
                {MENU_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`rl-chip${activePreset === preset.key ? ' is-on' : ''}`}
                    aria-pressed={activePreset === preset.key}
                    disabled={spinning}
                    onClick={() => applyMenus(menusForPreset(preset.key))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <p className="rl-editor-label">룰렛에 올린 메뉴</p>
              {isEmpty ? (
                <p className="rl-editor-none">아직 올린 메뉴가 없어요.</p>
              ) : (
                <ul className="rl-menu-chips">
                  {menus.map((menu, i) => (
                    <li key={menu.id}>
                      <span className="rl-menu-chip">
                        <i className="rl-menu-dot" style={{ background: wheelColor(i, menus.length) }} />
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
                  <div className="rl-cuisine-tabs" role="tablist" aria-label="메뉴 분류">
                    {CUISINES.map((c) => {
                      const left = addableMenus.filter((m) => m.cuisine === c.key).length;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          role="tab"
                          className={`rl-cuisine-tab${cuisine === c.key ? ' is-on' : ''}`}
                          aria-selected={cuisine === c.key}
                          onClick={() => setCuisine(c.key)}
                        >
                          {c.label}
                          <span className="rl-cuisine-count">{left}</span>
                        </button>
                      );
                    })}
                  </div>
                  {addableInCuisine.length === 0 && (
                    <p className="rl-editor-none">이 분류의 메뉴는 모두 룰렛에 올렸어요.</p>
                  )}
                  <ul className="rl-menu-chips" role="tabpanel">
                    {addableInCuisine.map((menu) => (
                      <li key={menu.id}>
                        <button
                          type="button"
                          className="rl-add-chip"
                          onClick={() => applyMenus([...menus, menu])}
                        >
                          + {menu.emoji} {menu.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="rl-editor-foot">
                <button
                  type="button"
                  className="rl-editor-reset"
                  disabled={isEmpty}
                  onClick={() => applyMenus([])}
                >
                  룰렛 초기화
                </button>
                <button type="button" className="rl-editor-done" onClick={finishEditing}>
                  설정 완료
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {result && (
        <section className="rl-stores" ref={storesRef}>
          <div className="rl-stores-head">
            <h2 className="rl-stores-title">
              {result.name}
              {objectParticle(result.name)} 파는 가까운 가게
            </h2>
            <p className="rl-stores-sub">전문점을 먼저, 그다음 메뉴판에 있는 가게를 가까운 순으로 보여드려요. 누르면 지도에서 보여드려요.</p>
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
                <li key={store.id}>
                  <button type="button" className="rl-store-card" onClick={() => openStore(store.storeId)}>
                  <div
                    className="rl-store-thumb"
                    style={{
                      background: `linear-gradient(160deg, ${resultColor} 0%, color-mix(in srgb, ${resultColor} 33%, transparent) 100%)`,
                    }}
                  >
                    {result.emoji}
                  </div>
                  <div className="rl-store-body">
                    <span className="rl-store-tag">{store.tagLabel}</span>
                    <h3 className="rl-store-name">{store.store.name}</h3>
                    <p className="rl-store-desc">{store.desc}</p>
                    <div className="rl-store-foot">
                      <span className="rl-store-meta">도보 {store.walkMinutes}분</span>
                    </div>
                  </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}