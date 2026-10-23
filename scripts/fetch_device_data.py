#!/usr/bin/env python3
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = "https://trust.mi.com/"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "devices.json"

HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Origin": "https://trust.mi.com",
    "User-Agent": "HyperIntervals-Website-Data/1.0",
}


def request_json(path, payload=None, referer="https://trust.mi.com/"):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL + path,
        data=data,
        headers={**HEADERS, "Referer": referer},
        method="GET" if payload is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def normalized_name(raw):
    aliases = {
        "leica leitzphone powered by xiaomi": "Xiaomi 17 Ultra by Leica",
        "xiaomi pad mini": "REDMI K Pad",
        "xiaomi 14t pro": "Redmi K70 Ultra",
        "xiaomi 13t pro": "Redmi K60 Ultra",
        "xiaomi 12t pro": "Redmi K50 Ultra",
        "poco x8 pro max": "REDMI Turbo 5 Max",
        "poco x8 pro": "REDMI Turbo 5",
        "poco m6 pro 5g": "Redmi 12/12R 5G/Note 12R",
        "poco x4 pro 5g": "Redmi Note 11E Pro",
        "poco f8 pro": "REDMI K90",
        "poco f8 ultra": "REDMI K90 Pro Max",
        "poco f7": "REDMI Turbo 4 Pro",
        "poco f7 pro": "REDMI K80",
        "poco f7 ultra": "REDMI K80 Pro",
        "poco x7 pro": "REDMI Turbo 4",
        "poco m6": "Redmi 13",
        "poco f6": "Redmi Turbo 3",
        "poco f6 pro": "Redmi K70",
        "poco f5": "Redmi Note 12 Turbo",
        "poco f5 pro": "Redmi K60",
        "poco x5 pro 5g": "Redmi Note 12 Pro Speed",
        "poco m5": "Redmi 11 Prime 4G",
        "poco f4": "Redmi K40S",
        "poco f4 gt": "Redmi K50 Gaming",
        "poco x4 gt": "Redmi Note 11T Pro/Pro+",
    }
    clean = " ".join(str(raw or "").replace("\u00a0", " ").split())
    return aliases.get(clean.lower(), clean)


def brand_for(name, raw_brand=""):
    value = f"{raw_brand} {name}".upper()
    if "REDMI" in value:
        return "REDMI"
    if "POCO" in value:
        return "POCO"
    return "Xiaomi"


def month(value):
    """只取到「月」。仅用于按月比较（is_active），不要拿它输出日期。"""
    text = str(value or "")
    return text[:7] if len(text) >= 7 else text


def date_of(value):
    """保留到「日」：`2026-09-01T06:42:53.000Z` -> `2026-09-01`。

    数据源本来就带完整年月日（只有 AER 是手填的，基本只到月，如 `2025-3`），
    以前这里用 month() 把「日」截掉了 —— 和 App 端的老毛病一样。
    月/日补零；解析不出来就原样返回，不丢数据。
    """
    text = str(value or "").split("T")[0].strip()
    parts = text.split("-")
    if len(parts) >= 2 and len(parts[0]) == 4 and parts[0].isdigit():
        try:
            out = f"{parts[0]}-{int(parts[1]):02d}"
        except ValueError:
            return text
        if len(parts) >= 3 and parts[2].strip().isdigit():
            out += f"-{int(parts[2]):02d}"
        return out
    return text


def is_active(status, end_date):
    """判断设备是否仍在维护期。

    AER 接口 2026-10 之后不再返回 status 字段（只按 status:1 过滤请求），
    此时 status 为 None，只能按「终止日期是否已过」判断，否则会把整批
    在维护期的设备误判成「更新终止」。
    """
    normalized = month(end_date)
    current_month = datetime.now().strftime("%Y-%m")
    if status is None:
        return bool(normalized) and normalized >= current_month
    return status == 1 and (not normalized or normalized >= current_month)


def fetch_aer():
    response = request_json(
        "bff/aer-certifications/findAll",
        {"orderBy": True, "status": 1},
        "https://trust.mi.com/misrc/updates/phone?tab=aerdata",
    )
    result = []
    for item in response.get("items") or []:
        name = normalized_name(item.get("deviceName"))
        if not name:
            continue
        result.append({
            "name": name,
            "brand": brand_for(name),
            "releaseDate": date_of(item.get("releaseDate")),
            "updateEndDate": date_of(item.get("securityUpdateEol")),
            "updateFrequency": item.get("updateFrequency") or "",
            "initialOs": item.get("shippedVersion") or "",
            "futureOs": item.get("futureVersion") or "",
            "active": is_active(item.get("status"), item.get("securityUpdateEol")),
        })
    return result


def fetch_support(path, referer, is_iot=False):
    result = []
    page = 1
    page_size = 100
    while True:
        response = request_json(path, {"page": page, "pageSize": page_size}, referer)
        items = response.get("data") or []
        for item in items:
            name = normalized_name(item.get("productName") or item.get("productNameEn"))
            if not name:
                continue
            result.append({
                "name": name,
                "brand": brand_for(name, item.get("brand") or item.get("brandEn") or ""),
                "releaseDate": date_of(item.get("launchTime")),
                "updateEndDate": date_of(item.get("eolTime")),
                "updateFrequency": "",
                "initialOs": "",
                "futureOs": "",
                "active": is_active(item.get("status"), item.get("eolTime")),
                **({"deviceType": item.get("brand") or ""} if is_iot else {}),
            })
        if len(items) < page_size:
            break
        page += 1
    return result


def detect_brand(value):
    value = str(value or "").strip().upper()
    if "REDMI" in value:
        return "REDMI"
    if "POCO" in value:
        return "POCO"
    if "XIAOMI" in value or value == "MI":
        return "Xiaomi"
    return None


def first_string(value, keys):
    normalized = {"".join(ch for ch in key.lower() if ch.isalnum()) for key in keys}
    for key, child in value.items():
        clean_key = "".join(ch for ch in key.lower() if ch.isalnum())
        if clean_key in normalized and isinstance(child, (str, int, float)):
            text = str(child).strip()
            if text:
                return text
    return ""


def collect_eol(value, inherited_brand=None, output=None):
    output = output if output is not None else []
    if isinstance(value, list):
        for child in value:
            if isinstance(child, str) and inherited_brand and child.strip():
                output.append({"brand": inherited_brand, "name": child.strip(), "date": ""})
            else:
                collect_eol(child, inherited_brand, output)
    elif isinstance(value, dict):
        brand = detect_brand(first_string(value, ["brand", "brandName", "brandEn", "manufacturer"])) or inherited_brand
        name = first_string(value, ["deviceName", "phoneName", "productName", "productNameEn", "product", "model", "modelName", "phone", "name", "title"])
        date = first_string(value, ["eol", "eolDate", "eolTime", "eos", "eosDate", "eosTime", "endOfLifeDate", "endOfSupportDate", "supportEndDate", "endDate", "securityUpdateEol", "date"])
        if brand and name:
            output.append({"brand": brand, "name": name, "date": date})
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                collect_eol(child, detect_brand(key) or brand, output)
    return output


def fetch_eol():
    response = request_json(
        "bff/eos-products/phones?type=Xiaomi-Redmi-POCO",
        referer="https://trust.mi.com/misrc/updates/phone?tab=policy",
    )
    unique = {}
    for item in collect_eol(response):
        key = (item["brand"], item["name"])
        if key not in unique or (not unique[key]["date"] and item["date"]):
            unique[key] = item
    return list(unique.values())


def main():
    payload = {
        "generatedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "aer": fetch_aer(),
        "productSupport": fetch_support(
            "bff/psti/phone/online",
            "https://trust.mi.com/misrc/updates/detail?tab=phone",
        ),
        "iotSupport": fetch_support(
            "bff/psti/iot/online",
            "https://trust.mi.com/zh-CN/misrc/updates/detail?tab=iot",
            is_iot=True,
        ),
        "eol": fetch_eol(),
    }
    empty = [key for key in ("aer", "productSupport", "iotSupport", "eol") if not payload[key]]
    if empty:
        raise RuntimeError("Empty data sources: " + ", ".join(empty))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Generated", OUTPUT)
    for key in ("aer", "productSupport", "iotSupport", "eol"):
        print(f"{key}: {len(payload[key])}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, urllib.error.URLError) as error:
        print(f"Failed to generate website data: {error}", file=sys.stderr)
        raise
