export function QuickInputBar() {
  return (
    <section className="panel">
      <h2>Quick Input</h2>
      <div className="field-row">
        <textarea rows={2} placeholder="输入文本或语音转写内容" />
        <button type="button">提交</button>
      </div>
    </section>
  );
}
