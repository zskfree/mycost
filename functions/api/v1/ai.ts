export function buildSystemPrompt(clientDateTime: string, weekday: string): string {
  return `你是一个专业严谨的记账助手。请从用户输入的文本或语音中提取财务交易信息，严格输出纯 JSON。

【当前基准时间】
- 客户端当前时间：${clientDateTime} (星期${weekday})
- 请根据此基准时间精准计算相对日期（如“昨天”、“前天”、“上周日”），输出交易发生的真实日期 (YYYY-MM-DD)。

【分类标准库】
餐饮(早餐/午餐/晚餐/咖啡饮料/零食水果), 交通(打车/地铁公交/加油/停车), 购物(超市买菜/日用品/服饰数码), 娱乐, 居家, 医疗, 人情, 收入(工资/理财/兼职), 其它。`;
}

export function cleanAndParseJSON<T>(rawContent: string): T {
  let cleaned = rawContent.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  return JSON.parse(cleaned) as T;
}

export function toAmountCents(amount: number): number {
  return Math.round(amount * 100);
}
