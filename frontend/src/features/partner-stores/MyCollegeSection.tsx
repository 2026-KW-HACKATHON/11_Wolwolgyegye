import { useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { COLLEGES } from './colleges';
import { saveMyCollege, useMyCollege } from './myCollege';
import { saveAudience } from './PartnerSection';
import type { CollegeKey } from './types';
import './myCollege.css';

/** 유저 탭의 "내 단과대" 등록 (사장님 계정에는 보이지 않는다). 등록하면 제휴 가게 화면이 그 단과대 제휴 가게로 바로 걸러진다 */
export default function MyCollegeSection() {
  const { status, userId, refresh } = useAuth();
  const college = useMyCollege();
  const [saving, setSaving] = useState<CollegeKey | 'none' | null>(null);
  const [error, setError] = useState(false);

  // 사장님 계정은 학생이 아니라 가게 운영자라 단과대를 등록하지 않는다
  if (status === 'checking' || status === 'owner') return null;

  async function choose(next: CollegeKey | null) {
    if (!userId || saving || next === college) return;
    setSaving(next ?? 'none');
    setError(false);
    try {
      await saveMyCollege(userId, next);
      await refresh();
      saveAudience(next ?? 'all');
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mc-section" aria-labelledby="my-college-title">
      <div className="mc-head">
        <h2 id="my-college-title">내 단과대</h2>
        {college && userId && (
          <button type="button" className="mc-clear" disabled={!!saving} onClick={() => choose(null)}>
            {saving === 'none' ? '해제 중…' : '등록 해제'}
          </button>
        )}
      </div>
      {!userId ? (
        <p className="mc-desc">로그인하면 소속 단과대를 등록할 수 있어요. 제휴 가게 화면에서 우리 단과대 제휴 가게를 바로 보여드려요.</p>
      ) : (
        <>
          <p className="mc-desc">
            {college
              ? '제휴 가게 화면에서 이 단과대 제휴 가게를 먼저 보여드려요.'
              : '소속 단과대를 고르면 제휴 가게 화면에서 우리 단과대 제휴 가게를 바로 보여드려요.'}
          </p>
          <div className="mc-grid" role="radiogroup" aria-label="소속 단과대">
            {COLLEGES.map((c) => {
              const on = college === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`mc-option${on ? ' is-on' : ''}`}
                  disabled={!!saving}
                  onClick={() => choose(c.key)}
                >
                  <span>{c.name}</span>
                  {saving === c.key ? <small>저장 중…</small> : on && <b aria-hidden="true">✓</b>}
                </button>
              );
            })}
          </div>
          {error && <p className="mc-error" role="alert">저장하지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        </>
      )}
    </section>
  );
}
