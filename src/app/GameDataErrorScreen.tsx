interface GameDataErrorScreenProps {
  message: string;
}

export function GameDataErrorScreen({ message }: GameDataErrorScreenProps) {
  return (
    <main className="diagnostic-screen">
      <section className="diagnostic-card" role="alert">
        <p className="section-kicker">STARTUP DIAGNOSTIC</p>
        <h1>ゲームデータを読み込めません</h1>
        <p>
          ゲームを開始せずに停止しました。データ定義または参照関係を確認してください。
        </p>
        <pre>{message}</pre>
      </section>
    </main>
  );
}
