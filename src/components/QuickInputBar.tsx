interface QuickInputBarProps {
  token: string;
  text: string;
  loading: boolean;
  recording: boolean;
  notice: string;
  error: string;
  onTokenChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
  onRefresh: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function QuickInputBar(props: QuickInputBarProps) {
  return (
    <section className="panel panel-wide">
      <div className="panel-heading">
        <h2>快速记账</h2>
        <button className="ghost-button" type="button" onClick={props.onRefresh} disabled={props.loading || !props.token.trim()}>
          刷新
        </button>
      </div>

      <label className="field-label" htmlFor="passkey">
        APP_PASSKEY
      </label>
      <input
        id="passkey"
        className="text-field"
        type="password"
        value={props.token}
        placeholder="Cloudflare Pages 环境变量 APP_PASSKEY"
        onChange={(event) => props.onTokenChange(event.target.value)}
      />

      <label className="field-label" htmlFor="entry-text">
        文本输入
      </label>
      <div className="field-row">
        <textarea
          id="entry-text"
          rows={3}
          value={props.text}
          placeholder="例如：中午吃牛肉面 28 块，微信支付"
          onChange={(event) => props.onTextChange(event.target.value)}
        />
        <div className="button-stack">
          <button type="button" onClick={props.onSubmit} disabled={props.loading || props.recording}>
            {props.loading ? '提交中' : '提交'}
          </button>
          <button
            className={props.recording ? 'record-button active' : 'record-button'}
            type="button"
            onClick={props.recording ? props.onStopRecording : props.onStartRecording}
            disabled={props.loading}
          >
            {props.recording ? '停止' : '录音'}
          </button>
        </div>
      </div>

      {props.recording ? <p className="notice recording">正在录音，点停止后上传解析</p> : null}
      {props.notice ? <p className="notice success">{props.notice}</p> : null}
      {props.error ? <p className="notice error">{props.error}</p> : null}
    </section>
  );
}
