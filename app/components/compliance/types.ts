// Contest-period code. UI-side types mirror the action results (type-only imports, no server code bundled).
export type { IssueView, ListingView, RewriteView } from "../../../server/compliance/store";
export type { MarketSummary } from "../../../server/compliance/analyze";
export type { DiffOp } from "../../../server/compliance/diff";

export const MARKET_ZH: Record<string, string> = { TH: "泰国", PH: "菲律宾", MY: "马来西亚", ALL: "所有市场" };
export const MARKET_FLAG: Record<string, string> = { TH: "🇹🇭", PH: "🇵🇭", MY: "🇲🇾", ALL: "🌏" };
export const SEVERITY_ZH: Record<string, string> = { high: "高", medium: "中", low: "低" };
export const STATUS_ZH: Record<string, string> = { open: "待处理", approved: "已确认", ignored: "已忽略", fixed: "已解决" };
export const KIND_ZH: Record<string, string> = {
  prohibited: "禁售", counterfeit: "仿冒词", brand: "品牌词", wording: "兼容措辞", claim: "宣称风险",
  cert: "必须认证", cert_maybe: "可能需认证", display: "标签/展示", platform: "平台规则", customs: "物流/关税", review: "待复核",
};
export const CATEGORY_OPTIONS = [
  ["auto", "自动识别品类"], ["appliance", "小家电"], ["power", "充电器/电源/充电宝"], ["toy", "玩具"], ["cosmetic", "化妆品"],
] as const;

export const SAMPLES = [
  { label: "充电宝（品牌词+仿冒词）", title: "蓝牙无线充电宝 20000mAh 苹果同款 全网最低价", description: "适用于 iPhone 华为 小米，100%安全无副作用。双USB输出，22.5W快充，自带磁吸无线充。", category: "auto" },
  { label: "美白面霜（功效宣称）", title: "美白祛斑面霜 50g 大牌平替", description: "7天淡斑美白，含氢醌配方，药用级修护，无副作用。适合所有肤质。", category: "cosmetic" },
  { label: "遥控玩具车（儿童+无线）", title: "儿童遥控越野车 2.4G 充电款", description: "适合3岁以上儿童，内置锂电池，USB充电，最强抓地力，顶级品质。", category: "toy" },
] as const;
