interface AppUpdateBannerProps {
  updateReady: boolean;
  onRefresh: () => void;
}

export function AppUpdateBanner({
  updateReady,
  onRefresh,
}: AppUpdateBannerProps) {
  if (!updateReady) return null;

  return (
    <aside className="app-update-banner" aria-label="アプリ更新">
      <span role="status" aria-live="polite">
        新しいバージョンを利用できます
      </span>
      <button type="button" onClick={onRefresh}>
        更新して再読み込み
      </button>
    </aside>
  );
}
