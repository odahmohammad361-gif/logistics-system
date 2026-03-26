"""
PDF generator for all invoice document types.
Uses WeasyPrint to render HTML → PDF.
Supports Arabic (RTL) and English (LTR).
"""
from __future__ import annotations
import base64
import os
from decimal import Decimal
from typing import Optional
from weasyprint import HTML, CSS
from app.utils.number_to_words import amount_to_words_en, amount_to_words_ar

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


def _img_b64(path: Optional[str]) -> str:
    """Return base64-encoded image src for embedding in HTML."""
    if not path:
        return ""
    full = os.path.join(UPLOAD_DIR, path) if not os.path.isabs(path) else path
    if not os.path.exists(full):
        return ""
    with open(full, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext = full.rsplit(".", 1)[-1].lower()
    mime = "image/png" if ext == "png" else "image/jpeg"
    return f"data:{mime};base64,{data}"


def _fmt(val) -> str:
    if val is None:
        return ""
    return f"{Decimal(str(val)):,.2f}"


DOC_TITLES = {
    "price_offer": ("PRICE OFFER", "عرض سعر"),
    "PI":          ("PROFORMA INVOICE", "فاتورة أولية"),
    "CI":          ("COMMERCIAL INVOICE", "فاتورة تجارية"),
    "PL":          ("PACKING LIST", "قائمة التعبئة والتغليف"),
    "SC":          ("SALES CONTRACT", "عقد بيع"),
}

LABELS = {
    "en": {
        "seller": "Seller:", "buyer": "Buyer:",
        "invoice_no": "INVOICE NO.:", "date": "DATE:",
        "origin": "ORIGIN:", "payment_term": "PAYMENT TERM:",
        "shipping_term": "SHIPPING TERM:", "port_loading": "Port of Loading:",
        "port_discharge": "Place of Delivery:", "container_no": "CONTAINER NO.:",
        "seal_no": "SEAL NO.:", "bl_no": "B/L NO.:",
        "description": "DESCRIPTION", "details": "Details\n(Material, Sizes,\nColors, Packing)",
        "image": "IMAGE", "weight": "WEIGHT\nKG", "hs_code": "HS CODE",
        "qty": "QTY", "unit_value": "UNIT\nVALUE\n(USD)", "total_value": "TOTAL VALUE\n(USD)",
        "ctns": "CTNS", "cbm": "Maas.\n(CBM)", "total": "TOTAL",
        "say": "SAY:", "bank_info": "Seller information for bank:",
        "account_name": "ACCOUNT NAME:", "account_no": "ACCOUNT NO:",
        "swift": "SWIFT:", "bank_name": "BANK NAME:", "bank_address": "ADDRESS:",
        "authorized": "Authorized Signature(s)", "notes": "Notes:",
        "vessel": "VESSEL:", "voyage": "VOYAGE NO.:",
    },
    "ar": {
        "seller": "البائع:", "buyer": "المشتري:",
        "invoice_no": "رقم الفاتورة:", "date": "التاريخ:",
        "origin": "المنشأ:", "payment_term": "شروط الدفع:",
        "shipping_term": "شروط الشحن:", "port_loading": "ميناء الشحن:",
        "port_discharge": "ميناء التفريغ:", "container_no": "رقم الحاوية:",
        "seal_no": "رقم الختم:", "bl_no": "رقم بوليصة الشحن:",
        "description": "الوصف", "details": "التفاصيل\n(المادة، المقاسات،\nالألوان، التعبئة)",
        "image": "الصورة", "weight": "الوزن\nكجم", "hs_code": "رمز HS",
        "qty": "الكمية", "unit_value": "سعر\nالوحدة\n(دولار)", "total_value": "القيمة\nالإجمالية\n(دولار)",
        "ctns": "الكراتين", "cbm": "الحجم\nم³", "total": "الإجمالي",
        "say": "المبلغ كتابةً:", "bank_info": "بيانات البنك:",
        "account_name": "اسم الحساب:", "account_no": "رقم الحساب:",
        "swift": "SWIFT:", "bank_name": "اسم البنك:", "bank_address": "العنوان:",
        "authorized": "التوقيع المعتمد", "notes": "ملاحظات:",
        "vessel": "السفينة:", "voyage": "رقم الرحلة:",
    },
}

CSS_STYLE = """
@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'Noto Naskh Arabic', Arial, sans-serif;
    font-size: 10px;
    color: #222;
    background: #fff;
    padding: 18px 22px;
    direction: {DIR};
}

.doc-wrapper {
    border: 2px solid #8B0000;
    padding: 12px 14px;
    min-height: 260mm;
    position: relative;
}

/* Background image */
.doc-bg {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
    opacity: 0.08;
    pointer-events: none;
}

/* Stamp overlay positions */
.stamp-overlay {
    position: absolute;
    z-index: 10;
}
.stamp-top-left    { top: 8px; left: 8px; }
.stamp-top-right   { top: 8px; right: 8px; }
.stamp-bottom-left { bottom: 8px; left: 8px; }
/* bottom-right is handled in the signature area (default) */

/* Header */
.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}
.company-name {
    font-size: 14px;
    font-weight: bold;
    text-transform: uppercase;
}
.company-website { font-size: 9px; color: #555; }
.logo-img { max-height: 60px; max-width: 80px; }

.doc-title {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    text-decoration: underline;
    margin: 8px 0;
}

/* Parties */
.parties {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 9px;
}
.party-box { flex: 1; }
.party-label { font-weight: bold; font-size: 10px; margin-bottom: 2px; }

/* Meta info */
.meta-block {
    font-size: 9.5px;
    margin-bottom: 8px;
    line-height: 1.7;
}
.meta-block b { font-weight: bold; }

/* Table */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 9px;
}
thead tr {
    background: #8B0000;
    color: #fff;
    text-align: center;
}
thead th {
    padding: 5px 3px;
    border: 1px solid #aaa;
    white-space: pre-line;
    font-size: 8.5px;
}
tbody tr { border-bottom: 1px solid #ddd; }
tbody tr:nth-child(even) { background: #fff5f5; }
td {
    padding: 5px 4px;
    border: 1px solid #ddd;
    vertical-align: middle;
    text-align: center;
}
td.text-left { text-align: left; }
td.text-right { text-align: right; }

.product-img { max-height: 45px; max-width: 60px; }

.total-row {
    background: #f9f9f9;
    font-weight: bold;
}
.total-row td { border-top: 2px solid #8B0000; }

/* Say / amount in words */
.say-box {
    border: 1px solid #ddd;
    padding: 5px 8px;
    font-size: 9px;
    margin-bottom: 8px;
    background: #fff8f8;
}

/* Bank info */
.bank-info {
    font-size: 9px;
    margin-bottom: 10px;
    line-height: 1.7;
}
.bank-title { font-weight: bold; text-decoration: underline; margin-bottom: 3px; }

/* Signature / stamp */
.signature-area {
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    margin-top: 12px;
    gap: 20px;
}
.stamp-img { max-height: 80px; max-width: 120px; }
.sig-label { font-size: 9px; text-align: center; border-top: 1px solid #888; padding-top: 3px; margin-top: 4px; }

/* SC specific */
.sc-section { margin-bottom: 8px; font-size: 9px; line-height: 1.7; }
.sc-section h3 { font-size: 10px; font-weight: bold; margin-bottom: 3px; }
.sc-section ul { padding-left: 14px; }
.sc-section li { margin-bottom: 2px; }

@page {
    size: A4;
    margin: 10mm 8mm;
}
"""

# Stamp position → CSS class
_STAMP_POS_CLASS = {
    "top-left":     "stamp-overlay stamp-top-left",
    "top-right":    "stamp-overlay stamp-top-right",
    "bottom-left":  "stamp-overlay stamp-bottom-left",
    "bottom-right": None,  # rendered in signature area (default)
}


def _build_html(inv, company, lang: str) -> str:
    L = LABELS[lang]
    is_ar = lang == "ar"
    dir_attr = "rtl" if is_ar else "ltr"
    css = CSS_STYLE.replace("{DIR}", dir_attr)

    inv_type = inv.invoice_type.value if hasattr(inv.invoice_type, "value") else inv.invoice_type
    title_en, title_ar = DOC_TITLES.get(inv_type, (inv_type, inv_type))
    title = title_ar if is_ar else title_en

    logo_src = _img_b64(company.logo_path if company else None)
    stamp_src = _img_b64(inv.stamp_image_path or (company.stamp_path if company else None))

    # Background image
    bg_src = _img_b64(getattr(inv, "document_background_path", None))
    bg_style = f'background-image: url("{bg_src}");' if bg_src else ""

    # Stamp position
    stamp_position = getattr(inv, "stamp_position", "bottom-right") or "bottom-right"
    stamp_pos_class = _STAMP_POS_CLASS.get(stamp_position)
    # For non-bottom-right positions: render as overlay inside doc-wrapper
    stamp_overlay_html = ""
    show_stamp_in_signature = True
    if stamp_pos_class is not None and stamp_src:
        stamp_overlay_html = f'<div class="{stamp_pos_class}"><img src="{stamp_src}" class="stamp-img"></div>'
        show_stamp_in_signature = False

    # Company block
    co_name = (company.name_ar if is_ar and company.name_ar else company.name) if company else "—"
    co_website = company.website if company else ""
    co_addr = (company.address_ar if is_ar and company.address_ar else company.address) if company else ""
    co_phone = company.phone if company else ""
    co_email = company.email if company else ""

    # Client block
    cl = inv.client
    cl_name = (cl.name_ar or cl.name) if is_ar else cl.name
    cl_company = (cl.company_name_ar or cl.company_name) if is_ar else cl.company_name
    cl_addr = cl.address or ""
    cl_phone = cl.phone or ""
    cl_email = cl.email or ""

    logo_html = f'<img src="{logo_src}" class="logo-img">' if logo_src else ""
    stamp_html = f'<img src="{stamp_src}" class="stamp-img">' if (stamp_src and show_stamp_in_signature) else ""

    # Meta rows
    meta_lines = []
    if inv.port_of_loading or inv.port_of_discharge:
        meta_lines.append(
            f"The invoice is prepared and transported <u>From</u> port of "
            f"{inv.port_of_loading or '—'} <u>To</u> port of {inv.port_of_discharge or '—'}"
        )
    if inv.origin:
        meta_lines.append(f"<b>{L['origin']}</b> {inv.origin}")
    if inv.payment_terms:
        meta_lines.append(f"<b>{L['payment_term']}</b> {inv.payment_terms}")
    if inv.shipping_term:
        meta_lines.append(f"<b>{L['shipping_term']}</b> {inv.shipping_term}")
    meta_lines.append(f"<b>{L['invoice_no']}</b> {inv.invoice_number}")
    meta_lines.append(f"<b>{L['date']}</b> {inv.issue_date.strftime('%Y/%m/%d')}")

    # Packing list extras — try container link first, then invoice fields
    pl_lines = []
    if inv_type == "PL":
        # Pull from linked container if available and invoice field is empty
        linked = getattr(inv, "container", None)
        container_no = inv.container_no or (linked.container_number if linked else None)
        seal_no = inv.seal_no or (linked.seal_no if linked else None)
        bl_number = inv.bl_number or (linked.bl_number if linked else None)
        vessel = inv.vessel_name
        voyage = inv.voyage_number

        if container_no:
            pl_lines.append(f"<b>{L['container_no']}</b> {container_no}")
        if seal_no:
            pl_lines.append(f"<b>{L['seal_no']}</b> {seal_no}")
        if bl_number:
            pl_lines.append(f"<b>{L['bl_no']}</b> {bl_number}")
        if vessel:
            pl_lines.append(f"<b>{L['vessel']}</b> {vessel}")
        if voyage:
            pl_lines.append(f"<b>{L['voyage']}</b> {voyage}")

    # Items table
    is_pl = inv_type == "PL"

    if not is_pl:
        thead_cols = [
            L["description"], L["details"], L["image"],
            L["weight"], L["hs_code"], L["qty"],
            L["unit_value"], L["total_value"],
        ]
    else:
        thead_cols = [
            "Mark &\nNumbers", L["description"], L["ctns"],
            L["qty"], "G.w.\n(KGS)", L["cbm"],
        ]

    thead_html = "".join(f"<th>{c}</th>" for c in thead_cols)

    rows_html = ""
    total_ctns = 0
    total_weight = Decimal("0")
    total_qty = Decimal("0")
    total_cbm = Decimal("0")
    total_val = Decimal("0")

    for item in inv.items:
        desc = (item.description_ar or item.description) if is_ar else item.description
        details = (item.details_ar or item.details) if is_ar else (item.details or "")
        img_src = _img_b64(item.product_image_path)
        img_html = f'<img src="{img_src}" class="product-img">' if img_src else ""

        w = Decimal(str(item.gross_weight or 0))
        q = Decimal(str(item.quantity or 0))
        cbm = Decimal(str(item.cbm or 0))
        val = Decimal(str(item.total_price or 0))
        ctns = item.cartons or 0

        total_ctns += ctns
        total_weight += w
        total_qty += q
        total_cbm += cbm
        total_val += val

        if not is_pl:
            rows_html += f"""
            <tr>
                <td class="text-left"><b>{desc}</b></td>
                <td class="text-left">{details}</td>
                <td>{img_html}</td>
                <td>{_fmt(w) if w else ""}</td>
                <td>{item.hs_code or ""}</td>
                <td>{_fmt(q)}</td>
                <td>${_fmt(item.unit_price)}</td>
                <td>${_fmt(val)}</td>
            </tr>"""
        else:
            rows_html += f"""
            <tr>
                <td>N/M</td>
                <td class="text-left"><b>{desc}</b></td>
                <td>{ctns}</td>
                <td>{_fmt(q)}</td>
                <td>{_fmt(w) if w else ""}</td>
                <td>{_fmt(cbm) if cbm else ""}</td>
            </tr>"""

    # Total row
    if not is_pl:
        total_row = f"""
        <tr class="total-row">
            <td colspan="2"><b>{L['total']}</b></td>
            <td></td>
            <td><b>{_fmt(total_weight)}</b></td>
            <td></td>
            <td><b>{_fmt(total_qty)}</b></td>
            <td></td>
            <td><b>${_fmt(total_val)}</b></td>
        </tr>"""
    else:
        total_row = f"""
        <tr class="total-row">
            <td><b>{L['total']}</b></td>
            <td></td>
            <td><b>{total_ctns}</b></td>
            <td><b>{_fmt(total_qty)}</b></td>
            <td><b>{_fmt(total_weight)}</b></td>
            <td><b>{_fmt(total_cbm)}</b></td>
        </tr>"""

    # Amount in words
    amount_en = amount_to_words_en(float(inv.total))
    amount_ar = amount_to_words_ar(float(inv.total))
    say_text = amount_ar if is_ar else amount_en

    # Bank info
    bank_html = ""
    has_bank = any([inv.bank_account_name, inv.bank_account_no, inv.bank_swift])
    if has_bank and inv_type not in ("PL",):
        bname = inv.bank_account_name or (company.bank_account_name if company else "")
        bno = inv.bank_account_no or (company.bank_account_no if company else "")
        bswift = inv.bank_swift or (company.bank_swift if company else "")
        bbank = inv.bank_name or (company.bank_name if company else "")
        baddr = inv.bank_address or (company.bank_address if company else "")
        bank_html = f"""
        <div class="bank-info">
            <div class="bank-title">{L['bank_info']}</div>
            {f'<div><b>{L["account_name"]}</b> {bname}</div>' if bname else ''}
            {f'<div><b>{L["account_no"]}</b> {bno}</div>' if bno else ''}
            {f'<div><b>{L["swift"]}</b> {bswift}</div>' if bswift else ''}
            {f'<div><b>{L["bank_name"]}</b> {bbank}</div>' if bbank else ''}
            {f'<div><b>{L["bank_address"]}</b> {baddr}</div>' if baddr else ''}
        </div>"""

    # SC extra sections
    sc_html = ""
    if inv_type == "SC":
        sc_html = f"""
        <div class="sc-section">
            <h3>3. {('شروط الدفع' if is_ar else 'Payment Terms')}</h3>
            <ul><li>{inv.payment_terms or '—'}</li></ul>
        </div>
        <div class="sc-section">
            <h3>4. {('شروط التسليم' if is_ar else 'Delivery Terms')}</h3>
            <ul>
                <li><b>{L['port_loading']}</b> {inv.port_of_loading or '—'}</li>
                <li><b>{L['port_discharge']}</b> {inv.port_of_discharge or '—'}</li>
                <li><b>Incoterm:</b> {inv.shipping_term or '—'}</li>
            </ul>
        </div>
        <div class="sc-section">
            <h3>5. {('التعبئة والتغليف' if is_ar else 'Packing & Marking')}</h3>
            <ul><li>{'تعبئة قياسية مناسبة للشحن البحري.' if is_ar else 'Standard export packing suitable for sea shipment.'}</li></ul>
        </div>
        <div class="sc-section">
            <h3>6. {('القانون الحاكم' if is_ar else 'Governing Law')}</h3>
            <p>{'يخضع هذا العقد لقوانين جمهورية الصين الشعبية.' if is_ar else 'This contract is governed by the laws of the People\'s Republic of China.'}</p>
        </div>"""

    notes_html = f'<div class="say-box"><b>{L["notes"]}</b> {inv.notes or ""}</div>' if inv.notes else ""

    html = f"""<!DOCTYPE html>
<html lang="{'ar' if is_ar else 'en'}" dir="{dir_attr}">
<head>
<meta charset="UTF-8">
<style>{css}</style>
</head>
<body>
<div class="doc-wrapper">

  <!-- Background image overlay -->
  {f'<div class="doc-bg" style="{bg_style}"></div>' if bg_style else ''}

  <!-- Stamp overlay (non-bottom-right positions) -->
  {stamp_overlay_html}

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">{co_name}</div>
      <div class="company-website">{co_website}</div>
    </div>
    {logo_html}
  </div>

  <div class="doc-title">{title}</div>

  <!-- Parties -->
  <div class="parties">
    <div class="party-box">
      <div class="party-label">{L['seller']}</div>
      <div>{co_name}</div>
      <div>{co_addr}</div>
      {f'<div>{co_email}</div>' if co_email else ''}
      {f'<div>{co_phone}</div>' if co_phone else ''}
    </div>
    <div class="party-box">
      <div class="party-label">{L['buyer']}</div>
      {f'<div><b>{cl_company}</b></div>' if cl_company else ''}
      <div>{cl_name}</div>
      <div>{cl_addr}</div>
      {f'<div>{cl_email}</div>' if cl_email else ''}
      {f'<div>{cl_phone}</div>' if cl_phone else ''}
    </div>
  </div>

  <!-- Meta -->
  <div class="meta-block">
    {"".join(f"<div>{line}</div>" for line in meta_lines)}
    {"".join(f"<div>{line}</div>" for line in pl_lines)}
  </div>

  <!-- Items Table -->
  <table>
    <thead><tr>{thead_html}</tr></thead>
    <tbody>{rows_html}{total_row}</tbody>
  </table>

  <!-- Amount in words -->
  <div class="say-box"><b>{L['say']}</b> {say_text}</div>

  {sc_html}
  {bank_html}
  {notes_html}

  <!-- Signature / Stamp (bottom-right or default) -->
  <div class="signature-area">
    <div>
      {stamp_html}
      <div class="sig-label">{L['authorized']}</div>
    </div>
  </div>

</div>
</body>
</html>"""
    return html


def generate_pdf(inv, company, lang: str = "en") -> bytes:
    """Generate PDF bytes for an invoice."""
    html_str = _build_html(inv, company, lang)
    pdf = HTML(string=html_str).write_pdf(
        stylesheets=[CSS(string="@page { size: A4; margin: 10mm 8mm; }")]
    )
    return pdf
