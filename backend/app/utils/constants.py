"""
Logistics constants: ports, container limits, shipping/payment terms.
Used by both the reference API and validation logic.
"""

SHIPPING_TERMS = ["FOB", "CFR", "CIF", "EXW", "DDP", "FCA", "DAP", "DDU"]
PAYMENT_TERMS = ["T/T", "L/C", "Cash", "D/P", "D/A", "100% payment before shipping", "100% payment after shipping"]
STAMP_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"]

PORTS = {
    "China": {
        "sea": [
            "Nansha, Guangzhou",
            "Guangzhou",
            "Qingdao",
            "Shanghai",
            "Ningbo",
            "Yiwu",
            "Tianjin",
            "Shenzhen (Yantian)",
        ],
        "air": [
            "Guangzhou Baiyun International Airport (CAN)",
            "Shanghai Pudong International Airport (PVG)",
            "Beijing Capital International Airport (PEK)",
            "Shenzhen Bao'an International Airport (SZX)",
        ],
    },
    "Jordan": {
        "sea": [
            "Aqaba Port",
        ],
        "air": [
            "Queen Alia International Airport, Amman (AMM)",
            "King Hussein Airport, Aqaba (AQJ)",
        ],
    },
    "Iraq": {
        "sea": [
            "Basra UM QASR",
            "Umm Qasr Port",
        ],
        "air": [
            "Baghdad International Airport (BGW)",
            "Basra International Airport (BSR)",
            "Erbil International Airport (EBL)",
            "Sulaymaniyah International Airport (ISU)",
        ],
    },
    "Saudi Arabia": {
        "sea": [
            "Jeddah Islamic Port",
            "Dammam (King Abdulaziz Seaport)",
            "Jubail Commercial Port",
        ],
        "air": [
            "Riyadh King Khalid International Airport (RUH)",
            "Jeddah King Abdulaziz International Airport (JED)",
            "Dammam King Fahd International Airport (DMM)",
        ],
    },
}

# Container capacity limits
CONTAINER_LIMITS = {
    "20GP":  {"max_weight_tons": 28.0, "max_cbm": 28.0},
    "40FT":  {"max_weight_tons": 28.0, "max_cbm": 68.0},
    "40HQ":  {"max_weight_tons": 28.0, "max_cbm": 76.0},
    "AIR":   {"max_weight_tons": None, "max_cbm": None},  # varies per airline/flight
}

# IATA volumetric weight divisor
AIR_VOLUMETRIC_DIVISOR = 6000  # L(cm) × W(cm) × H(cm) / 6000 = volumetric kg
