#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
feasibility.py - Tinh NPV / IRR / thoi gian hoan von cho mot du an dau tu (capex),
kem phan tich do nhay theo doanh thu (+-10%/+-20%) va lai suat chiet khau.

Cach dung:
    py -3.12 feasibility.py <input.json hoac input.yaml> [--out report.md]

File dau vao (JSON hoac YAML) co cac truong:
    capex                 : von dau tu ban dau (so duong, tru vao nam 0)
    years                 : so nam du an (khong tinh nam 0)
    discount_rate         : lai suat chiet khau (vd 0.12 = 12%/nam)
    tax_rate              : thue suat thue TNDN (vd 0.20)
    depreciation_years    : (tuy chon) so nam khau hao duong thang; mac dinh = years
    salvage_value         : (tuy chon) gia tri thu hoi cuoi du an, mac dinh 0
    working_capital_pct_revenue : (tuy chon) % von luu dong tren doanh thu, mac dinh 0

    # Cach 1 - liet ke truc tiep (uu tien neu co):
    revenue               : danh sach doanh thu tung nam [nam1, nam2, ...]
    opex                  : danh sach chi phi hoat dong tung nam

    # Cach 2 - sinh tu tang truong:
    revenue_year1, revenue_growth
    opex_year1, opex_growth

Khong dung numpy - IRR duoc tinh bang phuong phap chia doi (bisection) tren ham NPV.
"""
import argparse
import json
import sys
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def load_input(path):
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError:
            raise SystemExit(
                "File YAML can thu vien pyyaml (chua cai). Dung file .json, "
                "hoac cai: py -3.12 -m pip install pyyaml"
            )
        return yaml.safe_load(text)
    return json.loads(text)


def build_series(cfg, key_list, key_year1, key_growth, years):
    if key_list in cfg and cfg[key_list]:
        series = list(cfg[key_list])
        if len(series) < years:
            raise SystemExit(f"'{key_list}' co {len(series)} gia tri nhung 'years' = {years}")
        return series[:years]
    if key_year1 not in cfg:
        raise SystemExit(f"Thieu '{key_list}' hoac '{key_year1}' trong file dau vao.")
    v1 = cfg[key_year1]
    g = cfg.get(key_growth, 0.0)
    return [v1 * ((1 + g) ** t) for t in range(years)]


def cashflows_for(cfg, revenue, opex):
    years = cfg["years"]
    capex = cfg["capex"]
    tax_rate = cfg.get("tax_rate", 0.0)
    dep_years = cfg.get("depreciation_years", years)
    salvage = cfg.get("salvage_value", 0.0)
    wc_pct = cfg.get("working_capital_pct_revenue", 0.0)

    depreciation_per_year = capex / dep_years if dep_years else 0.0

    flows = [-capex]
    prev_wc = 0.0
    for t in range(years):
        rev = revenue[t]
        op = opex[t]
        ebitda = rev - op
        dep = depreciation_per_year if t < dep_years else 0.0
        ebit = ebitda - dep
        tax = max(ebit, 0.0) * tax_rate
        net_income = ebit - tax
        fcf = net_income + dep

        wc = rev * wc_pct
        fcf -= (wc - prev_wc)
        prev_wc = wc

        if t == years - 1:
            fcf += salvage + prev_wc  # thu hoi von luu dong + gia tri thu hoi cuoi du an

        flows.append(fcf)
    return flows


def npv(rate, flows):
    return sum(cf / ((1 + rate) ** t) for t, cf in enumerate(flows))


def irr_bisection(flows, lo=-0.9, hi=10.0, tol=1e-7, max_iter=300):
    f_lo = npv(lo, flows)
    f_hi = npv(hi, flows)
    if f_lo == 0:
        return lo
    if f_hi == 0:
        return hi
    if f_lo * f_hi > 0:
        return None
    for _ in range(max_iter):
        mid = (lo + hi) / 2
        f_mid = npv(mid, flows)
        if abs(f_mid) < tol:
            return mid
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def payback_period(flows):
    cum = flows[0]
    if cum >= 0:
        return 0.0
    for t in range(1, len(flows)):
        prev_cum = cum
        cum += flows[t]
        if cum >= 0:
            frac = (-prev_cum) / flows[t] if flows[t] != 0 else 0.0
            return (t - 1) + frac
    return None


def fmt(v, digits=1):
    if v is None:
        return "không hoàn vốn trong thời gian dự án"
    return f"{v:.{digits}f}"


def fmt_money(v):
    return f"{v:,.0f}".replace(",", ".")


def run_case(cfg, revenue_mult=1.0, rate_delta=0.0):
    years = cfg["years"]
    revenue = build_series(cfg, "revenue", "revenue_year1", "revenue_growth", years)
    opex = build_series(cfg, "opex", "opex_year1", "opex_growth", years)
    revenue = [r * revenue_mult for r in revenue]

    cfg2 = dict(cfg)
    flows = cashflows_for(cfg2, revenue, opex)

    rate = cfg["discount_rate"] + rate_delta
    n = npv(rate, flows)
    irr = irr_bisection(flows)
    pb = payback_period(flows)
    return n, irr, pb


def build_report(cfg, base_npv, base_irr, base_pb, sens_revenue, sens_matrix, rev_deltas, rate_deltas, src_path):
    lines = []
    lines.append("# Báo cáo khả thi dự án đầu tư (NPV / IRR / thời gian hoàn vốn)")
    lines.append("")
    lines.append(f"Nguồn dữ liệu đầu vào: `{src_path}`")
    lines.append(
        f"Vốn đầu tư (capex): {fmt_money(cfg['capex'])} | "
        f"Số năm dự án: {cfg['years']} | "
        f"Lãi suất chiết khấu cơ sở: {cfg['discount_rate']*100:.1f}%/năm | "
        f"Thuế suất TNDN: {cfg.get('tax_rate', 0.0)*100:.1f}%"
    )
    lines.append("")
    lines.append(
        "Đơn vị số liệu theo đơn vị nhập trong file cấu hình (ví dụ: triệu đồng hoặc tỷ đồng) — "
        "giữ nhất quán trên toàn bộ đầu vào."
    )
    lines.append("")

    lines.append("## Kết quả cơ sở (base case)")
    lines.append("")
    lines.append("| Chỉ tiêu | Giá trị |")
    lines.append("|---|---|")
    lines.append(f"| NPV (tại {cfg['discount_rate']*100:.1f}%/năm) | {fmt_money(base_npv)} |")
    lines.append(f"| IRR | {(base_irr*100):.1f}%/năm |" if base_irr is not None else "| IRR | không xác định được (dòng tiền không đổi dấu) |")
    lines.append(f"| Thời gian hoàn vốn | {fmt(base_pb)} năm |")
    lines.append("")
    if base_npv > 0 and (base_irr is None or base_irr > cfg["discount_rate"]):
        lines.append("**Nhận xét:** NPV dương và IRR cao hơn lãi suất chiết khấu — dự án khả thi về mặt tài chính ở kịch bản cơ sở.")
    elif base_npv <= 0:
        lines.append("**Nhận xét:** NPV âm hoặc bằng 0 ở kịch bản cơ sở — dự án chưa khả thi về mặt tài chính với các giả định hiện tại.")
    lines.append("")

    lines.append("## Độ nhạy theo doanh thu (NPV, giữ nguyên lãi suất chiết khấu cơ sở)")
    lines.append("")
    lines.append("| Kịch bản doanh thu | NPV | IRR | Thời gian hoàn vốn (năm) |")
    lines.append("|---|---|---|---|")
    for d, (n, irr, pb) in zip(rev_deltas, sens_revenue):
        label = f"{d*100:+.0f}%" if d != 0 else "Cơ sở (0%)"
        irr_s = f"{irr*100:.1f}%" if irr is not None else "n/a"
        lines.append(f"| {label} | {fmt_money(n)} | {irr_s} | {fmt(pb)} |")
    lines.append("")

    lines.append("## Ma trận độ nhạy NPV (doanh thu × lãi suất chiết khấu)")
    lines.append("")
    header = "| Doanh thu \\ Lãi suất | " + " | ".join(f"{cfg['discount_rate']*100 + rd*100:.1f}%" for rd in rate_deltas) + " |"
    sep = "|---|" + "---|" * len(rate_deltas)
    lines.append(header)
    lines.append(sep)
    for i, rd_rev in enumerate(rev_deltas):
        row_label = f"{rd_rev*100:+.0f}%" if rd_rev != 0 else "Cơ sở"
        row_vals = [fmt_money(sens_matrix[i][j]) for j in range(len(rate_deltas))]
        lines.append(f"| {row_label} | " + " | ".join(row_vals) + " |")
    lines.append("")
    lines.append(
        "_Ghi chú: các cột lãi suất là lãi suất chiết khấu cơ sở thay đổi tương đối ±10%/±20% "
        "(ví dụ cơ sở 12%/năm → 12% × 0.8 = 9.6%/năm ở cột đầu tiên), không phải cộng/trừ điểm phần trăm._"
    )
    lines.append("")

    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Tinh NPV/IRR/thoi gian hoan von va do nhay cho du an dau tu.")
    ap.add_argument("input", help="File cau hinh .json hoac .yaml")
    ap.add_argument("--out", default=None, help="Duong dan file bao cao markdown xuat ra")
    args = ap.parse_args()

    src_path = Path(args.input).resolve()
    if not src_path.exists():
        raise SystemExit(f"Khong tim thay file: {src_path}")

    cfg = load_input(src_path)
    for req in ("capex", "years", "discount_rate"):
        if req not in cfg:
            raise SystemExit(f"File dau vao thieu truong bat buoc: '{req}'")
    cfg.setdefault("tax_rate", 0.0)

    base_npv, base_irr, base_pb = run_case(cfg)

    rev_deltas = [-0.20, -0.10, 0.0, 0.10, 0.20]
    sens_revenue = [run_case(cfg, revenue_mult=1 + d) for d in rev_deltas]

    rate_deltas_pct = [-0.20, -0.10, 0.0, 0.10, 0.20]
    rate_deltas = [cfg["discount_rate"] * d for d in rate_deltas_pct]

    sens_matrix = []
    for d_rev in rev_deltas:
        row = []
        for d_rate in rate_deltas:
            n, _, _ = run_case(cfg, revenue_mult=1 + d_rev, rate_delta=d_rate)
            row.append(n)
        sens_matrix.append(row)

    report = build_report(
        cfg, base_npv, base_irr, base_pb, sens_revenue, sens_matrix, rev_deltas, rate_deltas, src_path
    )

    print(f"NPV co so: {fmt_money(base_npv)} | IRR: {(base_irr*100):.1f}%" if base_irr is not None else f"NPV co so: {fmt_money(base_npv)} | IRR: n/a")
    print(f"Thoi gian hoan von: {fmt(base_pb)} nam")

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(report, encoding="utf-8")
        print(f"Da ghi bao cao: {out_path.resolve()}")
    else:
        print(report)


if __name__ == "__main__":
    main()
