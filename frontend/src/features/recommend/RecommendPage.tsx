import { useShell } from '../../layout/AppShell/ShellContext';
import HomeScreen from './HomeScreen';
import './recommend.css';

/** 동네 소식 1차 탭. 지도는 앱 셸이 뒤에 깔아 두므로 여기서는 소식 목록만 그린다. */
export default function RecommendPage() {
  const { openStore, setActivePanelState } = useShell();
  return (
    <div className="rp-scope">
      <HomeScreen onShowNearby={() => setActivePanelState('closed')} onShowStore={(id) => openStore(id)} />
    </div>
  );
}
