"""In dashboard chi phí (G6.5) từ .cost-dashboard.json (scripts/cost-dashboard.sh).

Giá gói và phí cửa hàng đặt ở đây (không nằm trong DB). Biên gộp = 1 − (chi phí LLM/người/tháng
+ phí cửa hàng) / doanh thu ròng tháng. Số liệu chi phí là THẬT (usage_costs); doanh thu là ước tính
theo giá niêm yết cho tới khi RevenueCat có giao dịch thật (G6.1).
"""

from __future__ import annotations

import json
import os

DAYS = int(os.environ.get("DAYS", "7"))
# Giá niêm yết (USD, vùng Mỹ; RevenueCat định giá theo vùng — VN thấp hơn). Sửa khi chốt bảng giá.
PRICES_USD = {"monthly": 4.99, "yearly": 29.99, "lifetime": 59.99}
STORE_FEE = 0.15  # Apple/Google Small Business Program (< 1M USD/năm)
LIFETIME_AMORTIZE_MONTHS = 24

with open(".cost-dashboard.json", encoding="utf-8") as fh:
    rows = json.load(fh)

print(f"== Chi phí LLM {DAYS} ngày gần nhất (usage_costs) ==")
if not rows:
    print("(chưa có lời gọi nào)")
for r in rows:
    print(
        f"{r['tier']:<5} người hoạt động {r['active_users']:>4} · lời gọi {r['calls']:>6} · "
        f"chi phí ${float(r['cost_usd']):.4f} · /người ${float(r['cost_per_active_user']):.4f}"
    )
    for k, v in sorted((r.get("by_feature") or {}).items(), key=lambda kv: -float(kv[1])):
        print(f"      {k:<8} ${float(v):.4f}")

pro = next((r for r in rows if r["tier"] == "pro"), None)
if pro and pro["active_users"]:
    per_user_month = float(pro["cost_per_active_user"]) * 30 / DAYS
    print(f"\n== Biên gộp ước tính (pro: ${per_user_month:.4f} LLM/người/tháng) ==")
    for plan, price in PRICES_USD.items():
        monthly_rev = (
            price if plan == "monthly" else price / 12 if plan == "yearly" else price / LIFETIME_AMORTIZE_MONTHS
        )
        net = monthly_rev * (1 - STORE_FEE)
        margin = 1 - per_user_month / net if net else 0
        flag = "✓" if (plan != "yearly" or margin >= 0.70) else "✗ (< 70 %, tiêu chí G6)"
        print(f"{plan:<8} ${price:>6.2f} → ròng ${net:.2f}/tháng · biên gộp {margin * 100:5.1f} % {flag}")
else:
    print("\n(chưa có người dùng pro hoạt động → chưa tính được biên gộp)")
