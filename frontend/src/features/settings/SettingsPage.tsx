import { PALETTES, setPalette, usePalette } from '../../core/theme/palette';
import { MARKER_STYLES, setMarkerStyle, useMarkerStyle } from '../../core/map/markerStyle';
import './settings.css';

/** 미리보기 점에 보여줄 팔레트 색 (각 버튼에 data-palette 를 달아 그 팔레트 값으로 칠한다) */
const SWATCHES = ['--base-50', '--primary-500', '--deep-900', '--accent-400', '--strong-500', '--support-400'];

/** 유저 탭 아래의 화면 설정. 고른 값은 이 기기에 저장한다. */
export default function SettingsPage() {
  const palette = usePalette();
  const markerStyle = useMarkerStyle();
  return (
    <section className="set-settings" aria-labelledby="settings-title">
      <h2 id="settings-title" className="set-settings__title">설정</h2>
      <div className="set-settings__group" role="radiogroup" aria-label="색상 테마">
        <h3>색상 테마</h3>
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={palette === p.id}
            data-palette={p.id}
            className={`set-palette${palette === p.id ? ' is-on' : ''}`}
            onClick={() => setPalette(p.id)}
          >
            <span className="set-palette__dots" aria-hidden="true">
              {SWATCHES.map((name) => <i key={name} style={{ background: `var(${name})` }} />)}
            </span>
            <span className="set-palette__text">
              <b>{p.name}</b>
              <small>{p.desc}</small>
            </span>
            {palette === p.id && <span className="set-palette__check" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
      <div className="set-settings__group set-settings__group--markers" role="radiogroup" aria-label="지도 가게 핀 모양">
        <h3>지도 가게 핀</h3>
        <p className="set-settings__help">지도에 표시되는 가게와 숫자 묶음의 모양을 골라보세요.</p>
        {MARKER_STYLES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={markerStyle === option.id}
            className={`set-marker${markerStyle === option.id ? ' is-on' : ''}`}
            onClick={() => setMarkerStyle(option.id)}
          >
            <span className={`set-marker__preview is-${option.id}`} aria-hidden="true"><i>12</i></span>
            <span className="set-palette__text"><b>{option.name}</b><small>{option.desc}</small></span>
            {markerStyle === option.id && <span className="set-palette__check" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
