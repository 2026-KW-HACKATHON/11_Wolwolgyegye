import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUserLocation } from '../../core/source/storeSource';
import type { GeoPoint } from '../../core/types/place';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import ExtraIcon from '../../shared/ExtraIcon';
import Icon from '../../shared/Icon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import StoreMap, { directionText } from '../../shared/map/StoreMap';
import Sheet from '../../shared/sheet/Sheet';
import { HISTORY_PREVIEW, currentCycleDates, initialOf, isReady, kindOf, longDate, remainingOf, shortDate, tiltOf, withRo, rewardsOf, progressOf, MAX_STAMP_SLOTS } from './constants';
import { STAMP_CODE_TTL_SECONDS, issueStampCode } from './source';
import StampSeal from './StampSeal';
import type { StampView } from './types';

interface Props {
  view: StampView;
  onBack: () => void;
}

export default function StampDetail({ view: v, onBack }: Props) {
  const active = usePageActive();
  const { isFavorite, toggle } = useFavoriteStores();
  const [sheet, setSheet] = useState<'code' | 'reward' | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (!active) setSheet(null); }, [active]);
  useEffect(() => { setSheet(null); }, [v.requiredStamps, v.reward, v.unit, v.condition]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    let cancelled = false;
    getUserLocation().then((here) => { if (!cancelled) setOrigin(here); });
    return () => { cancelled = true; };
  }, []);

  const done = isReady(v);
  const remaining = remainingOf(v);
  const dates = currentCycleDates(v);
  const fav = isFavorite(v.storeId);
  const initial = initialOf(v.store.name);
  const history = showAll ? v.history : v.history.slice(0, HISTORY_PREVIEW);
  const percent = progressOf(v);
  const available = rewardsOf(v);

  return (
    <>
      <button type="button" className="st-back" onClick={onBack}><ExtraIcon name="arrowLeft" />스탬프 지갑</button>

      <div className="st-detail">
        {/* 적립판 */}
        <section className={`st-paper${done ? ' is-done' : ''}`} aria-labelledby="st-paper-name">
          <header className="st-paper-head">
            <span className="st-avatar st-avatar--lg" aria-hidden="true">{initial}</span>
            <div className="st-paper-title">
              <p>{v.store.cuisineType ?? '생활·문화'} · 도보 {v.walkMinutes}분</p>
              <h1 id="st-paper-name" ref={heading} tabIndex={-1}>{v.store.name}</h1>
            </div>
            <p className="st-paper-count" aria-label={`보유 ${v.count}개, 선물 1개당 ${v.requiredStamps}개 필요`}><b>{v.count}</b><span>{v.count > v.requiredStamps ? '개 보유' : `/${v.requiredStamps}`}</span></p>
          </header>

          <p className="st-paper-status" aria-live="polite">
            {done ? `선물 ${available}개를 받을 수 있어요` : v.count === 0 ? '첫 도장을 찍어보세요' : <>선물까지 <b>{remaining}개</b> 남았어요</>}
          </p>

          {v.requiredStamps <= MAX_STAMP_SLOTS ? <ol className="st-slots" style={{ gridTemplateColumns: `repeat(${Math.min(v.requiredStamps, 5)}, minmax(0, 1fr))` }} aria-label={`적립판 ${v.requiredStamps}칸 중 ${Math.min(v.count, v.requiredStamps)}칸에 도장`}>
            {Array.from({ length: v.requiredStamps }, (_, i) => {
              const on = i < v.count;
              const gift = i === v.requiredStamps - 1;
              return (
                <li key={i} className={`${on ? 'is-on' : ''}${gift ? ' is-gift' : ''}`}>
                  {on ? (
                    <StampSeal initial={initial} date={dates[i] ? shortDate(dates[i]) : undefined} tilt={tiltOf(v.storeId, i)} seed={i + 2} fresh={false} />
                  ) : (
                    <span className="st-slot-empty" aria-hidden="true">{gift ? <Icon name="gift" /> : i + 1}</span>
                  )}
                  <span className="st-sr">{i + 1}번째 칸 {on ? `적립${dates[i] ? ` (${shortDate(dates[i])})` : ''}` : gift ? '선물 칸, 비어 있음' : '비어 있음'}</span>
                </li>
              );
            })}
          </ol> : <div className="st-large-goal"><b>{v.count}개 적립</b><span>선물 1개당 {v.requiredStamps}개</span><div className="st-progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div></div>}

          <footer className="st-paper-foot">
            <span>{v.unit} 1회당 1개</span>
            <span aria-hidden="true">·</span>
            <span>직원 확인 후 적립</span>
          </footer>
          {done && <span className="st-paper-ribbon" aria-hidden="true">COMPLETE</span>}
        </section>

        {/* 선물·버튼 */}
        <div className="st-actions">
          <div className={`st-reward${done ? ' is-ready' : ''}`}>
            <span className="st-reward-label"><Icon name="gift" />{v.requiredStamps}개 모으면 받는 선물</span>
            <strong>{v.reward}</strong>
            <div className="st-progress" role="progressbar" aria-label="선물까지 진행률" aria-valuemin={0} aria-valuemax={v.requiredStamps} aria-valuenow={Math.min(v.count, v.requiredStamps)} aria-valuetext={`보유 ${v.count}개, 선물 1개당 ${v.requiredStamps}개 필요`}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="st-reward-sub">
              {done ? `${available}개 교환 가능 · 1회 교환 시 ${v.requiredStamps}개 차감` : `${remaining}개 더 모으면 받아요`}
              {v.redeemedTimes > 0 && ` · 지금까지 ${v.redeemedTimes}번 받았어요`}
            </span>
          </div>

          <button type="button" className="st-btn st-btn--primary st-btn--block" onClick={() => setSheet(done ? 'reward' : 'code')}>
            {done ? <><Icon name="gift" />선물 교환권 열기</> : <><ExtraIcon name="qr" />적립 코드 보여주기</>}
          </button>
          <button type="button" className={`st-btn st-btn--line st-btn--block st-like${fav ? ' is-on' : ''}`} aria-pressed={fav} onClick={() => toggle(v.storeId)}>
            <Icon name="heart" />{fav ? '찜한 가게' : '가게 찜하기'}
          </button>

          {v.store.supports['partner-stores'] && (
            <Link className="st-crosslink" to={`/partner-stores?store=${encodeURIComponent(v.storeId)}`}>
              <span className="st-crosslink-icon"><Icon name="ticket" /></span>
              <span><b>광운대 학생 제휴 혜택도 있어요</b><small>단과대별 혜택과 가게 위치 보기</small></span>
              <Icon name="chevronRight" />
            </Link>
          )}
        </div>

        {/* 적립 내역 */}
        <section className="st-section st-history" aria-labelledby="st-history-title">
          <div className="st-section-head">
            <h2 id="st-history-title"><ExtraIcon name="history" />적립 내역</h2>
            <span>{v.history.length}건</span>
          </div>
          {v.history.length === 0 ? (
            <p className="st-muted">아직 적립 내역이 없어요. 결제할 때 적립 코드를 보여주면 첫 도장이 찍혀요.</p>
          ) : (
            <ol className="st-timeline">
              {history.map((t) => {
                const kind = kindOf(t);
                return (
                  <li key={t.id} className={`is-${kind}`}>
                    <span className="st-tl-dot" aria-hidden="true">{kind === 'earn' ? <ExtraIcon name="check" /> : <Icon name="gift" />}</span>
                    <div className="st-tl-body">
                      <b>{kind === 'earn' ? '스탬프 적립' : '선물 교환'}</b>
                      <span>{t.reason}</span>
                      <time dateTime={t.createdAt}>{longDate(t.createdAt)}</time>
                    </div>
                    <div className="st-tl-amount">
                      <b>{t.delta > 0 ? `+${t.delta}` : t.delta}</b>
                      <span>잔액 {t.balanceAfter}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {v.history.length > HISTORY_PREVIEW && (
            <button type="button" className="st-more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? '최근 내역만 보기' : `전체 ${v.history.length}건 보기`}
              <Icon name={showAll ? 'chevronUp' : 'chevronDown'} />
            </button>
          )}
        </section>

        {/* 가게 정보 + 지도 */}
        <section className="st-section st-info" aria-labelledby="st-info-title">
          <div className="st-section-head"><h2 id="st-info-title"><Icon name="storefront" />가게 정보</h2></div>
          <dl className="st-facts">
            <div><dt><Icon name="pin" /><span className="st-sr">주소</span></dt><dd>{v.store.address}</dd></div>
            <div><dt><ExtraIcon name="clock" /><span className="st-sr">영업시간</span></dt><dd>{v.store.businessHours}</dd></div>
            <div><dt><ExtraIcon name="phone" /><span className="st-sr">전화</span></dt><dd>{v.store.phone} <small>예시 번호</small></dd></div>
            {origin && <div><dt><Icon name="compass" /><span className="st-sr">방향</span></dt><dd>기준점에서 {directionText(origin, v.store.location)}</dd></div>}
          </dl>
          {origin && <StoreMap key={v.storeId} store={v.store} origin={origin} />}
          <details className="st-terms">
            <summary>적립·교환 안내</summary>
            <ul>
              <li>{v.condition}</li>
              <li>{v.requiredStamps}개를 모으면 {withRo(v.reward)} 교환할 수 있어요.</li>
              <li>적립과 교환은 직원이 확인한 뒤 완료돼요.</li>
              <li>다른 가게의 스탬프와 합칠 수 없어요.</li>
            </ul>
          </details>
        </section>
      </div>

      <Sheet open={sheet === 'code' && active} title="적립 코드" onClose={() => setSheet(null)}>
        {sheet === 'code' && <CodePanel view={v} />}
      </Sheet>

      <Sheet open={sheet === 'reward' && active} title="선물 교환권" onClose={() => setSheet(null)}>
        {sheet === 'reward' && (
          <div className="st-sheet">
            <div className="st-voucher">
              <span className="st-voucher-store">{v.store.name}</span>
              <strong>{v.reward}</strong>
              <span className="st-voucher-sub">스탬프 {v.requiredStamps}개 사용</span>
              <span className="st-voucher-code">교환 번호 <b>{v.storeId.replace(/\D/g, '').padStart(3, '0')}-{String(v.redeemedTimes + 1).padStart(2, '0')}</b></span>
            </div>
            <p className="st-sheet-copy">선물 1개 교환 시 스탬프 {v.requiredStamps}개가 차감되고, {Math.max(0, v.count - v.requiredStamps)}개가 남아요.</p>
            <p className="st-sheet-copy">직원이 사장님 화면에서 확인하면 DB의 적립 잔액에 반영됩니다.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
/* 직원에게 보여주는 적립 코드 (3분마다 새 번호) */
function CodePanel({ view }: { view: StampView }) {
  const [code, setCode] = useState(issueStampCode);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (now >= code.expiresAt) setCode(issueStampCode()); }, [now, code.expiresAt]);
  const left = Math.max(0, Math.ceil((code.expiresAt - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const ratio = left / STAMP_CODE_TTL_SECONDS;

  return (
    <div className="st-sheet">
      <p className="st-sheet-lead">결제할 때 직원에게 이 화면을 보여주세요</p>
      <div className="st-code" aria-label={`적립 코드 ${code.code.split('').join(' ')}`}>
        <span>{code.code.slice(0, 3)}</span><span>{code.code.slice(3)}</span>
      </div>
      <div className="st-code-timer">
        <div className="st-code-bar"><span style={{ width: `${ratio * 100}%` }} /></div>
        <span>{mm}:{ss} 후 새 번호로 바뀌어요</span>
      </div>
      <ol className="st-steps">
        <li><b>1</b>{view.unit} 후 코드를 보여줘요</li>
        <li><b>2</b>직원이 사장님 화면에 번호를 입력해요</li>
        <li><b>3</b>적립판에 도장이 찍혀요</li>
      </ol>
      <p className="st-sheet-copy">코드는 직원 확인용입니다. 이 화면에서 직접 잔액을 변경할 수는 없어요.</p>
    </div>
  );
}
