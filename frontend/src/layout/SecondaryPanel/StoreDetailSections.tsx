import { subCategoryById } from '../../core/categories/subCategories';
import type { StoreDetail } from '../../core/source/storeDetail';
import { groupBusinessHours } from '../../core/utils/hours';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const pct = (rate: number) => `${Math.round(rate * 100)}%`;
const dateTime = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

function saleLabel(s: StoreDetail['sales'][number]): string {
  if (s.discountType === 'rate' && s.discountRate !== null) return `${pct(s.discountRate)} 할인`;
  if (s.discountType === 'amount' && s.discountAmount !== null) return `${won(s.discountAmount)} 할인`;
  return '무료 제공';
}
function benefitLabel(b: StoreDetail['benefits'][number]): string {
  return b.discountRate !== null ? `${pct(b.discountRate)} 할인` : b.discountAmount !== null ? `${won(b.discountAmount)} 할인` : '';
}

/**
 * 2차 탭 아래쪽: 가게에 딸린 표들을 한 줄로 쭉 이어서 보여준다.
 * 내용이 없는 묶음은 그리지 않는다. 순서: 영업시간 → 메뉴 → 마감세일 → 제휴 혜택 → 공간대여 → 원데이클래스 → 스탬프
 */
export default function StoreDetailSections({ detail }: { detail: StoreDetail }) {
  const hours = groupBusinessHours(detail.hours);
  const empty = !hours.length && !detail.menus.length && !detail.sales.length && !detail.benefits.length
    && !detail.spaceRentals.length && !detail.classes.length && !detail.stamp;
  if (empty) return <p className="sd-empty">아직 사장님이 등록한 정보가 없어요.</p>;

  return (
    <div className="sd">
      {hours.length > 0 && (
        <section className="sd-section" aria-label="영업시간">
          <h3>영업시간</h3>
          <dl className="sd-hours">
            {hours.map((h) => <div key={h.label} className={h.text === '휴무' ? 'is-closed' : undefined}><dt>{h.label}</dt><dd>{h.text}</dd></div>)}
          </dl>
        </section>
      )}

      {detail.menus.length > 0 && (
        <section className="sd-section" aria-label="메뉴">
          <h3>메뉴 <span>{detail.menus.length}</span></h3>
          <ul className="sd-list">
            {detail.menus.map((m) => (
              <li key={m.id} className="sd-row">
                <span>{m.name}{m.typeId && <small>{subCategoryById(m.typeId)?.label}</small>}</span>
                <b>{won(m.price)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.sales.length > 0 && (
        <section className="sd-section" aria-label="마감세일">
          <h3>마감세일 <span>{detail.sales.length}</span></h3>
          <ul className="sd-list">
            {detail.sales.map((s) => (
              <li key={s.id} className="sd-card sd-card--sale">
                <strong>{saleLabel(s)}</strong>
                {s.offer && <p>{s.offer}</p>}
                {s.condition && <small>{s.condition}</small>}
                <small>{timeOnly(s.endsAt)} 마감</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.benefits.length > 0 && (
        <section className="sd-section" aria-label="제휴 혜택">
          <h3>제휴 혜택 <span>{detail.benefits.length}</span></h3>
          <ul className="sd-list">
            {detail.benefits.map((b) => (
              <li key={b.id} className="sd-card">
                <strong>{benefitLabel(b)}</strong>
                {b.partners.length > 0 && <p>{b.partners.join(' · ')}</p>}
                {b.condition && <small>{b.condition}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.spaceRentals.length > 0 && (
        <section className="sd-section" aria-label="공간대여">
          <h3>공간대여 <span>{detail.spaceRentals.length}</span></h3>
          <ul className="sd-list">
            {detail.spaceRentals.map((r) => (
              <li key={r.id} className="sd-card">
                {r.category && <em>{r.category}</em>}
                <strong>{r.title}</strong>
                {r.summary && <p>{r.summary}</p>}
                <small>{won(r.price)} / 시간 · 최대 {r.capacity}명{r.minHours ? ` · ${r.minHours}시간부터` : ''}</small>
                {r.availableHours && <small>{r.availableHours}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.classes.length > 0 && (
        <section className="sd-section" aria-label="원데이클래스">
          <h3>원데이클래스 <span>{detail.classes.length}</span></h3>
          <ul className="sd-list">
            {detail.classes.map((c) => (
              <li key={c.id} className="sd-card">
                {c.category && <em>{c.category}</em>}
                <strong>{c.title}</strong>
                {c.summary && <p>{c.summary}</p>}
                <small>{dateTime(c.startsAt)} · {c.durationMinutes}분 · {won(c.price)} / 1인</small>
                <small className={c.currentCount >= c.maxCount ? 'is-full' : undefined}>
                  {c.currentCount >= c.maxCount ? '모집 마감' : `신청 ${c.currentCount} / ${c.maxCount}명`}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.stamp && (
        <section className="sd-section" aria-label="스탬프">
          <h3>스탬프</h3>
          <div className="sd-card">
            <strong>{detail.stamp.requiredStamps}개 모으면 {detail.stamp.reward}</strong>
            <small>{detail.stamp.unit}마다 1개{detail.stamp.condition ? ` · ${detail.stamp.condition}` : ''}</small>
          </div>
        </section>
      )}
    </div>
  );
}
